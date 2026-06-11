'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { EmptyState } from '@/components/empty-state';
import { AppShell } from '@/components/app-shell';
import { ScheduleViews, type ScheduleJob } from '@/components/schedule-views';
import { EMPTY_COPY } from '@/lib/empty-copy';
import { fetchOrganizationContext } from '@/lib/organization';
import { canAssignJobs, normalizeRole } from '@/lib/roles';
import { limitsForPlan } from '@/lib/everittos-limits';
import { normalizePlan, type EverittosPlan } from '@/lib/everittos-plans';
import { logClientActivity } from '@/lib/activity';
import { supabase } from '@/lib/supabase';

export default function SchedulePage() {
  const router = useRouter();
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
      <h2>Schedule</h2>
        <p>
          Calendar, daily, weekly, and upcoming job views.{' '}
          <Link href="/settings/integrations">Connect Google Calendar</Link> to sync scheduled jobs.
        </p>

        {loading && <div className="card">Loading schedule...</div>}
        {error && <div className="card">{error}</div>}
        {!loading && !error && jobs.length === 0 && (
          <div className="card" style={{ marginTop: 18 }}>
            <EmptyState title={EMPTY_COPY.schedule.title} description={EMPTY_COPY.schedule.description} />
          </div>
        )}
        {!loading && !error && jobs.length > 0 && (
          <div className="card" style={{ marginTop: 18 }}>
            <ScheduleViews
              jobs={jobs}
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
