'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense } from 'react';
import { AppShell } from '@/components/app-shell';
import { useTranslation } from '@/components/locale-provider';
import { PageHeader } from '@/components/page-header';
import { ScheduleViews, type ScheduleJob } from '@/components/schedule-views';
import { useAppFeedback } from '@/components/feedback/use-app-feedback';
import { ensureOrganizationForUser } from '@/lib/workspace-client';
import { scopeJobsForWorkspace } from '@/lib/jobs-query';
import { combineDateAndTime } from '@/lib/schedule-times';
import { canAssignJobs, normalizeRole, type UserRole } from '@/lib/roles';
import { limitsForPlan } from '@/lib/everittos-limits';
import { normalizePlan, type EverittosPlan } from '@/lib/everittos-plans';
import { daysAheadIso, todayIso } from '@/lib/date-filters';
import { logClientActivity } from '@/lib/activity';
import { loadScheduleVisits, loadWorkerNames } from '@/lib/schedule-page-loader';
import { supabase } from '@/lib/supabase';

function SchedulePageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const rangeFilter = searchParams.get('range');
  const memberFilter = searchParams.get('member');
  const { t } = useTranslation();
  const appFeedback = useAppFeedback();
  const [plan, setPlan] = useState<EverittosPlan>('free');
  const [role, setRole] = useState<UserRole>('owner');
  const [jobs, setJobs] = useState<ScheduleJob[]>([]);
  const [workerNames, setWorkerNames] = useState<Record<string, string>>({});
  const [canAssign, setCanAssign] = useState(false);
  const [orgId, setOrgId] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  async function load() {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      router.push('/login');
      return;
    }

    const { data: profile } = await supabase.from('profiles').select('plan, role').eq('id', user.id).maybeSingle();
    const p = normalizePlan(profile?.plan);
    setPlan(p);

    const org = await ensureOrganizationForUser(user.id);
    const workspaceRole = normalizeRole(org?.role || profile?.role);
    const organizationId = org?.organizationId || '';
    setRole(workspaceRole);
    setOrgId(organizationId);
    setCanAssign(limitsForPlan(p).crewAssignment && canAssignJobs(workspaceRole));

    const jobsQuery = scopeJobsForWorkspace(
      supabase
        .from('jobs')
        .select('id, title, customer_name, status, start_date, due_date, scheduled_start, scheduled_end, assigned_to')
        .not('status', 'eq', 'cancelled')
        .order('due_date', { ascending: true, nullsFirst: false }),
      user.id,
      organizationId,
      workspaceRole
    );

    const { data, error: fetchError } = await jobsQuery;
    if (fetchError) {
      setLoading(false);
      setError(fetchError.message);
      return;
    }

    let rows = (data || []) as ScheduleJob[];
    if (memberFilter) rows = rows.filter((job) => job.assigned_to === memberFilter);

    const [expandedRows, workers] = await Promise.all([
      loadScheduleVisits(supabase, rows, organizationId),
      loadWorkerNames(supabase, user.id, organizationId)
    ]);
    setJobs(expandedRows);
    setWorkerNames(workers);
    setLoading(false);
  }

  useEffect(() => {
    void load();
  }, [memberFilter]);

  const visibleJobs = useMemo(() => {
    if (rangeFilter !== 'upcoming') return jobs;
    const today = todayIso();
    const end = daysAheadIso(7);
    return jobs.filter(
      (j) =>
        j.status !== 'completed' &&
        j.status !== 'cancelled' &&
        ((j.visit_date && j.visit_date >= today && j.visit_date <= end) ||
          (j.due_date && j.due_date >= today && j.due_date <= end) ||
          (j.start_date && j.start_date >= today && j.start_date <= end))
    );
  }, [jobs, rangeFilter]);

  async function assignWorker(jobId: string, workerId: string | null) {
    const res = await fetch('/api/schedule/update', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jobId, assigned_to: workerId })
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      const msg = json.error || 'Unable to update assignment.';
      setError(msg);
      appFeedback.error(msg);
      return;
    }
    setError('');
    appFeedback.success('Assignment updated.');
    if (orgId) await logClientActivity(orgId, 'job', jobId, 'schedule_changed', workerId ? 'Worker assigned on schedule' : 'Worker unassigned');
    load();
  }

  async function rescheduleJob(jobId: string, dateKey: string) {
    const res = await fetch('/api/schedule/update', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jobId,
        start_date: dateKey,
        due_date: dateKey,
        scheduled_start: combineDateAndTime(dateKey, '09:00'),
        scheduled_end: combineDateAndTime(dateKey, '17:00')
      })
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      const msg = json.error || 'Unable to reschedule job.';
      setError(msg);
      appFeedback.error(msg);
      return;
    }
    setError('');
    appFeedback.success('Schedule updated.');
    if (orgId) await logClientActivity(orgId, 'job', jobId, 'schedule_changed', `Moved to ${dateKey}`);
    load();
  }

  return (
    <AppShell plan={plan} role={role}>
      <PageHeader
        title={t('ux.pageTitles.schedule')}
        subtitle="Jobs and visits by day, time, and assignment."
        action={<Link className="btn btn-primary" href="/schedule/new">Schedule work</Link>}
      />

      {loading && <div className="card"><p className="loading-state">{t('common.loading')}</p></div>}
      {error && <p className="auth-message auth-message-error" role="alert">{error}</p>}
      {!loading && !error && visibleJobs.length === 0 && (
        <div className="card empty-action-card" style={{ marginTop: 18 }}>
          <h3>Nothing scheduled</h3>
          <p className="muted">Create a job first, then schedule each visit so it appears on the calendar.</p>
          <div className="settings-actions">
            <Link className="btn btn-primary" href="/jobs/new">Create job</Link>
            <Link className="btn" href="/schedule/new">Schedule existing job</Link>
          </div>
        </div>
      )}
      {!loading && !error && visibleJobs.length > 0 && (
        <div className="card" style={{ marginTop: 18 }}>
          <ScheduleViews jobs={visibleJobs} workerNames={workerNames} canAssign={canAssign} onAssign={assignWorker} onReschedule={canAssign ? rescheduleJob : undefined} />
        </div>
      )}
    </AppShell>
  );
}

export default function SchedulePage() {
  return (
    <Suspense>
      <SchedulePageContent />
    </Suspense>
  );
}
