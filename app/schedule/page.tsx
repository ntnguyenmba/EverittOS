'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense } from 'react';
import { LocalizedEmptyState } from '@/components/localized-empty-state';
import { AppShell } from '@/components/app-shell';
import { useTranslation } from '@/components/locale-provider';
import { PageHeader } from '@/components/page-header';
import { ScheduleViews, type ScheduleJob } from '@/components/schedule-views';
import { fetchOrganizationContext } from '@/lib/organization';
import { canAssignJobs, normalizeRole } from '@/lib/roles';
import { limitsForPlan } from '@/lib/everittos-limits';
import { normalizePlan, type EverittosPlan } from '@/lib/everittos-plans';
import { daysAheadIso, todayIso } from '@/lib/date-filters';
import { logClientActivity } from '@/lib/activity';
import { supabase } from '@/lib/supabase';

function SchedulePageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const rangeFilter = searchParams.get('range');
  const { t } = useTranslation();
  const [plan, setPlan] = useState<EverittosPlan>('free');
  const [jobs, setJobs] = useState<ScheduleJob[]>([]);
  const [workerNames, setWorkerNames] = useState<Record<string, string>>({});
  const [canAssign, setCanAssign] = useState(false);
  const [orgId, setOrgId] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  async function load() {
    setLoading(true);
    const {
      data: { user }
    } = await supabase.auth.getUser();
    if (!user) {
      router.push('/login');
      return;
    }

    const { data: profile } = await supabase.from('profiles').select('plan, role').eq('id', user.id).maybeSingle();
    const p = normalizePlan(profile?.plan);
    setPlan(p);

    const org = await fetchOrganizationContext(user.id);
    setOrgId(org?.organizationId || '');
    setCanAssign(limitsForPlan(p).crewAssignment && canAssignJobs(normalizeRole(profile?.role)));

    const { data, error: fetchError } = await supabase
      .from('jobs')
      .select('id, title, customer_name, status, start_date, due_date, scheduled_start, scheduled_end, assigned_to')
      .not('status', 'eq', 'cancelled')
      .order('due_date', { ascending: true, nullsFirst: false });

    setLoading(false);
    if (fetchError) {
      setError(fetchError.message);
      return;
    }

    setJobs((data || []) as ScheduleJob[]);

    const { data: workers } = await supabase.from('workers').select('id, name');
    const map: Record<string, string> = {};
    (workers || []).forEach((w) => {
      map[w.id] = w.name;
    });
    setWorkerNames(map);
  }

  useEffect(() => {
    load();
  }, []);

  const visibleJobs = useMemo(() => {
    if (rangeFilter !== 'upcoming') return jobs;
    const today = todayIso();
    const end = daysAheadIso(7);
    return jobs.filter(
      (j) =>
        j.status !== 'completed' &&
        j.status !== 'cancelled' &&
        ((j.due_date && j.due_date >= today && j.due_date <= end) ||
          (j.start_date && j.start_date >= today && j.start_date <= end))
    );
  }, [jobs, rangeFilter]);

  async function assignWorker(jobId: string, workerId: string | null) {
    const res = await fetch('/api/schedule/update', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jobId, assigned_to: workerId })
    });
    if (!res.ok) {
      const json = await res.json();
      setError(json.error || 'Unable to update assignment.');
      return;
    }
    if (orgId) {
      await logClientActivity(orgId, 'job', jobId, 'schedule_changed', workerId ? 'Worker assigned on schedule' : 'Worker unassigned');
    }
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
        scheduled_start: `${dateKey}T09:00:00.000Z`,
        scheduled_end: `${dateKey}T17:00:00.000Z`
      })
    });
    if (!res.ok) {
      const json = await res.json();
      setError(json.error || 'Unable to reschedule job.');
      return;
    }
    if (orgId) {
      await logClientActivity(orgId, 'job', jobId, 'schedule_changed', `Moved to ${dateKey}`);
    }
    load();
  }

  return (
    <AppShell plan={plan}>
      <PageHeader title={t('ux.pageTitles.schedule')} subtitle={t('ux.helperSchedule')} />

        {loading && <div className="card"><p className="loading-state">{t('common.loading')}</p></div>}
        {error && <div className="card">{error}</div>}
        {!loading && !error && visibleJobs.length === 0 && (
          <div className="card" style={{ marginTop: 18 }}>
            <LocalizedEmptyState emptyKey="schedule" />
          </div>
        )}
        {!loading && !error && visibleJobs.length > 0 && (
          <div className="card" style={{ marginTop: 18 }}>
            <ScheduleViews
              jobs={visibleJobs}
              workerNames={workerNames}
              canAssign={canAssign}
              onAssign={assignWorker}
              onReschedule={canAssign ? rescheduleJob : undefined}
            />
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
