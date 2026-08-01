'use client';

import Link from 'next/link';
import { Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { AppShell } from '@/components/app-shell';
import { PageHeader } from '@/components/page-header';
import { ScheduleViews, type ScheduleJob } from '@/components/schedule-views';
import { ScheduleCalendarConnections } from '@/components/schedule-calendar-connections';
import { useAppFeedback } from '@/components/feedback/use-app-feedback';
import { ensureOrganizationForUser } from '@/lib/workspace-client';
import { scopeJobsForWorkspace } from '@/lib/jobs-query';
import { combineDateAndTime } from '@/lib/schedule-times';
import { canAssignJobs, isManagerRole, normalizeRole, type UserRole } from '@/lib/roles';
import { limitsForPlan } from '@/lib/everittos-limits';
import { normalizePlan, type EverittosPlan } from '@/lib/everittos-plans';
import { daysAheadIso, todayIso } from '@/lib/date-filters';
import { logClientActivity } from '@/lib/activity';
import { TIME_ZONE_OPTIONS, normalizeTimeZone } from '@/lib/time-zones';
import { supabase } from '@/lib/supabase';
import { buildAssignmentWorkerIdsByJob, isJobAssignedToWorker } from '@/lib/worker-assignment';

function JobsCalendarContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const rangeFilter = searchParams.get('range');
  const memberFilter = searchParams.get('member');
  const appFeedback = useAppFeedback();
  const [plan, setPlan] = useState<EverittosPlan>('free');
  const [role, setRole] = useState<UserRole>('owner');
  const [jobs, setJobs] = useState<ScheduleJob[]>([]);
  const [workerNames, setWorkerNames] = useState<Record<string, string>>({});
  const [canAssign, setCanAssign] = useState(false);
  const [orgId, setOrgId] = useState('');
  const [workspaceTimeZone, setWorkspaceTimeZone] = useState('America/Chicago');
  const [savingTimeZone, setSavingTimeZone] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    const {
      data: { user }
    } = await supabase.auth.getUser();
    if (!user) {
      router.push('/login');
      return;
    }

    const { data: profile } = await supabase.from('profiles').select('plan, role').eq('id', user.id).maybeSingle();
    const currentPlan = normalizePlan(profile?.plan);
    setPlan(currentPlan);

    const org = await ensureOrganizationForUser(user.id);
    const workspaceRole = normalizeRole(org?.role || profile?.role);
    const organizationId = org?.organizationId || '';
    setRole(workspaceRole);
    setOrgId(organizationId);
    setCanAssign(limitsForPlan(currentPlan).crewAssignment && canAssignJobs(workspaceRole));

    if (organizationId) {
      const { data: settings } = await supabase
        .from('organization_settings')
        .select('timezone')
        .eq('organization_id', organizationId)
        .maybeSingle();
      setWorkspaceTimeZone(normalizeTimeZone(settings?.timezone || 'America/Chicago'));
    }

    const jobsQuery = scopeJobsForWorkspace(
      supabase
        .from('jobs')
        .select('id, title, customer_name, status, start_date, due_date, scheduled_start, scheduled_end, assigned_to, timezone')
        .not('status', 'eq', 'cancelled')
        .not('status', 'eq', 'canceled')
        .not('status', 'eq', 'completed')
        .order('due_date', { ascending: true, nullsFirst: false }),
      user.id,
      organizationId,
      workspaceRole
    );

    const { data, error: fetchError } = await jobsQuery;

    let workersQuery = supabase.from('workers').select('id, name, auth_user_id').order('name');
    if (organizationId) workersQuery = workersQuery.eq('organization_id', organizationId);
    else workersQuery = workersQuery.eq('user_id', user.id);

    const { data: workers } = await workersQuery;
    const names: Record<string, string> = {};
    const workerIdsForMember: string[] = [];
    (workers || []).forEach((worker: { id: string; name: string; auth_user_id?: string | null }) => {
      names[worker.id] = worker.name;
      if (memberFilter && (worker.id === memberFilter || worker.auth_user_id === memberFilter)) {
        workerIdsForMember.push(worker.id);
      }
    });
    setWorkerNames(names);

    setLoading(false);
    if (fetchError) {
      setError(fetchError.message);
      return;
    }

    let rows = (data || []) as ScheduleJob[];
    if (memberFilter) {
      const assignmentWorkerIdsByJob = new Map<string, string[]>();
      if (workerIdsForMember.length) {
        const { data: assignmentRows } = await supabase
          .from('job_assignments')
          .select('job_id, worker_id')
          .in('worker_id', workerIdsForMember);
        buildAssignmentWorkerIdsByJob(assignmentRows || []).forEach((ids, jobId) => {
          assignmentWorkerIdsByJob.set(jobId, ids);
        });
      }
      const identity = { userId: memberFilter, workerIds: workerIdsForMember.length ? workerIdsForMember : [memberFilter] };
      rows = rows.filter((job) => isJobAssignedToWorker(job, identity, assignmentWorkerIdsByJob));
    }
    setJobs(rows);
  }, [memberFilter, router]);

  useEffect(() => {
    void load();
  }, [load]);

  const visibleJobs = useMemo(() => {
    if (rangeFilter !== 'upcoming') return jobs;
    const today = todayIso();
    const end = daysAheadIso(7);
    return jobs.filter(
      (job) =>
        job.status !== 'completed' &&
        job.status !== 'cancelled' &&
        ((job.due_date && job.due_date >= today && job.due_date <= end) ||
          (job.start_date && job.start_date >= today && job.start_date <= end))
    );
  }, [jobs, rangeFilter]);

  async function saveWorkspaceTimeZone() {
    if (!orgId || !isManagerRole(role)) return;
    setSavingTimeZone(true);
    const timeZone = normalizeTimeZone(workspaceTimeZone);
    const { error: saveError } = await supabase
      .from('organization_settings')
      .upsert(
        { organization_id: orgId, timezone: timeZone },
        { onConflict: 'organization_id' }
      );
    setSavingTimeZone(false);
    if (saveError) {
      appFeedback.error(saveError.message || 'Unable to save calendar timezone.');
      return;
    }
    setWorkspaceTimeZone(timeZone);
    appFeedback.success('Calendar timezone saved. Connected calendars will use this timezone for jobs without their own timezone.');
  }

  async function assignWorker(jobId: string, workerId: string | null) {
    const res = await fetch('/api/schedule/update', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jobId, assigned_to: workerId })
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      const message = json.error || 'Unable to update assignment.';
      setError(message);
      appFeedback.error(message);
      return;
    }
    setError('');
    appFeedback.success('Assignment updated.');
    if (orgId) await logClientActivity(orgId, 'job', jobId, 'schedule_changed', workerId ? 'Worker assigned on jobs calendar' : 'Worker unassigned');
    void load();
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
      const message = json.error || 'Unable to reschedule job.';
      setError(message);
      appFeedback.error(message);
      return;
    }
    setError('');
    appFeedback.success('Job date updated.');
    if (orgId) await logClientActivity(orgId, 'job', jobId, 'schedule_changed', `Moved to ${dateKey}`);
    void load();
  }

  return (
    <AppShell plan={plan} role={role}>
      <PageHeader
        title="Jobs calendar"
        action={
          <div className="settings-actions">
            <Link className="btn" href="/jobs">List view</Link>
            <Link className="btn btn-primary" href="/jobs/new">New job</Link>
          </div>
        }
      />
      <p className="muted">View and move scheduled jobs, connect external calendars, and manage timezone settings in one place.</p>

      <section className="card" style={{ marginTop: 18 }}>
        <h3 style={{ marginTop: 0 }}>Calendar timezone</h3>
        <p className="muted">This is the default timezone for calendar feeds and jobs that do not have their own timezone. A job-specific timezone still takes priority.</p>
        <div className="grid-2" style={{ alignItems: 'end' }}>
          <div className="form-group">
            <label htmlFor="jobs-calendar-timezone">Default calendar timezone</label>
            <select
              id="jobs-calendar-timezone"
              className="input"
              value={workspaceTimeZone}
              disabled={!isManagerRole(role) || savingTimeZone}
              onChange={(event) => setWorkspaceTimeZone(event.target.value)}
            >
              {TIME_ZONE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </div>
          {isManagerRole(role) ? (
            <button className="btn btn-primary" type="button" disabled={savingTimeZone} onClick={() => void saveWorkspaceTimeZone()}>
              {savingTimeZone ? 'Saving…' : 'Save timezone'}
            </button>
          ) : null}
        </div>
      </section>

      {loading ? <div className="card"><p className="loading-state">Loading…</p></div> : null}
      {error ? <p className="auth-message auth-message-error" role="alert">{error}</p> : null}
      {!loading && !error && visibleJobs.length === 0 ? (
        <div className="card empty-action-card" style={{ marginTop: 18 }}>
          <h3>No scheduled jobs</h3>
          <Link className="btn btn-primary" href="/jobs/new">Create job</Link>
        </div>
      ) : null}
      {!loading && !error && visibleJobs.length > 0 ? (
        <div className="card" style={{ marginTop: 18 }}>
          <ScheduleViews
            jobs={visibleJobs}
            workerNames={workerNames}
            canAssign={canAssign}
            onAssign={assignWorker}
            onReschedule={canAssign ? rescheduleJob : undefined}
          />
        </div>
      ) : null}

      <section style={{ marginTop: 18 }}>
        <ScheduleCalendarConnections role={role} />
      </section>
    </AppShell>
  );
}

export default function JobsCalendarPage() {
  return <Suspense><JobsCalendarContent /></Suspense>;
}
