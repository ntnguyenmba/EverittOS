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

type ScheduleFilter = 'today' | 'upcoming' | 'needs_schedule' | 'all';

function jobDate(job: ScheduleJob) {
  return String(job.scheduled_start || job.start_date || job.due_date || '').slice(0, 10);
}

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
  const [scheduleFilter, setScheduleFilter] = useState<ScheduleFilter>(rangeFilter === 'upcoming' ? 'upcoming' : 'today');

  const load = useCallback(async () => {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
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
      const { data: settings } = await supabase.from('organization_settings').select('timezone').eq('organization_id', organizationId).maybeSingle();
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
      if (memberFilter && (worker.id === memberFilter || worker.auth_user_id === memberFilter)) workerIdsForMember.push(worker.id);
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
        const { data: assignmentRows } = await supabase.from('job_assignments').select('job_id, worker_id').in('worker_id', workerIdsForMember);
        buildAssignmentWorkerIdsByJob(assignmentRows || []).forEach((ids, jobId) => assignmentWorkerIdsByJob.set(jobId, ids));
      }
      const identity = { userId: memberFilter, workerIds: workerIdsForMember.length ? workerIdsForMember : [memberFilter] };
      rows = rows.filter((job) => isJobAssignedToWorker(job, identity, assignmentWorkerIdsByJob));
    }
    setJobs(rows);
  }, [memberFilter, router]);

  useEffect(() => { void load(); }, [load]);

  const today = todayIso();
  const upcomingEnd = daysAheadIso(7);
  const todayCount = useMemo(() => jobs.filter((job) => jobDate(job) === today).length, [jobs, today]);
  const upcomingCount = useMemo(() => jobs.filter((job) => { const date = jobDate(job); return Boolean(date && date >= today && date <= upcomingEnd); }).length, [jobs, today, upcomingEnd]);
  const needsScheduleCount = useMemo(() => jobs.filter((job) => !jobDate(job)).length, [jobs]);

  const visibleJobs = useMemo(() => {
    const rows = jobs.filter((job) => {
      const date = jobDate(job);
      if (scheduleFilter === 'today') return date === today;
      if (scheduleFilter === 'upcoming') return Boolean(date && date >= today && date <= upcomingEnd);
      if (scheduleFilter === 'needs_schedule') return !date;
      return true;
    });

    return [...rows].sort((a, b) => {
      const aDate = jobDate(a);
      const bDate = jobDate(b);
      if (!aDate && bDate) return -1;
      if (aDate && !bDate) return 1;
      return aDate.localeCompare(bDate);
    });
  }, [jobs, scheduleFilter, today, upcomingEnd]);

  async function saveWorkspaceTimeZone() {
    if (!orgId || !isManagerRole(role)) return;
    setSavingTimeZone(true);
    const timeZone = normalizeTimeZone(workspaceTimeZone);
    const { error: saveError } = await supabase.from('organization_settings').upsert({ organization_id: orgId, timezone: timeZone }, { onConflict: 'organization_id' });
    setSavingTimeZone(false);
    if (saveError) {
      appFeedback.error(saveError.message || 'Unable to save calendar timezone.');
      return;
    }
    setWorkspaceTimeZone(timeZone);
    appFeedback.success('Calendar timezone saved. Connected calendars will use this timezone for jobs without their own timezone.');
  }

  async function assignWorker(jobId: string, workerId: string | null) {
    const res = await fetch('/api/schedule/update', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ jobId, assigned_to: workerId }) });
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
      body: JSON.stringify({ jobId, start_date: dateKey, due_date: dateKey, scheduled_start: combineDateAndTime(dateKey, '09:00'), scheduled_end: combineDateAndTime(dateKey, '17:00') })
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

  const filters: Array<{ id: ScheduleFilter; label: string; count?: number }> = [
    { id: 'today', label: 'Today', count: todayCount },
    { id: 'upcoming', label: 'Next 7 days', count: upcomingCount },
    { id: 'needs_schedule', label: 'Needs schedule', count: needsScheduleCount },
    { id: 'all', label: 'All' }
  ];

  return (
    <AppShell plan={plan} role={role}>
      <PageHeader title="Jobs calendar" action={<div className="settings-actions"><Link className="btn" href="/jobs">List view</Link><Link className="btn btn-primary" href="/jobs/new">New job</Link></div>} />
      <p className="muted">Start with today, then upcoming work and anything that still needs a date.</p>

      <div className="job-detail-actions" style={{ marginTop: 16, marginBottom: 16, gap: 8, flexWrap: 'wrap' }}>
        {filters.map((filter) => (
          <button key={filter.id} type="button" className={scheduleFilter === filter.id ? 'btn btn-primary' : 'btn'} onClick={() => setScheduleFilter(filter.id)} aria-pressed={scheduleFilter === filter.id}>
            {filter.label}{typeof filter.count === 'number' ? ` · ${filter.count}` : ''}
          </button>
        ))}
      </div>

      {needsScheduleCount > 0 ? (
        <div className="card" style={{ marginBottom: 16, borderColor: 'rgba(158,83,58,.25)' }}>
          <strong>{needsScheduleCount} job{needsScheduleCount === 1 ? '' : 's'} still need a schedule</strong>
          <p className="muted" style={{ margin: '6px 0 10px' }}>Set dates now so work does not disappear from the calendar.</p>
          <button type="button" className="btn" onClick={() => setScheduleFilter('needs_schedule')}>Review unscheduled jobs</button>
        </div>
      ) : null}

      {loading ? <div className="card"><p className="loading-state">Loading…</p></div> : null}
      {error ? <p className="auth-message auth-message-error" role="alert">{error}</p> : null}
      {!loading && !error && visibleJobs.length === 0 ? (
        <div className="card empty-action-card" style={{ marginTop: 18 }}>
          <h3>{scheduleFilter === 'today' ? 'No jobs today' : scheduleFilter === 'needs_schedule' ? 'Everything has a schedule' : 'No jobs in this view'}</h3>
          <Link className="btn btn-primary" href="/jobs/new">Create job</Link>
        </div>
      ) : null}
      {!loading && !error && visibleJobs.length > 0 ? (
        <div className="card" style={{ marginTop: 18 }}>
          <ScheduleViews jobs={visibleJobs} workerNames={workerNames} canAssign={canAssign} onAssign={assignWorker} onReschedule={canAssign ? rescheduleJob : undefined} />
        </div>
      ) : null}

      <details className="card" style={{ marginTop: 18 }}>
        <summary style={{ cursor: 'pointer', fontWeight: 700 }}>Calendar settings</summary>
        <div style={{ marginTop: 16 }}>
          <h3 style={{ marginTop: 0 }}>Calendar timezone</h3>
          <p className="muted">Default timezone for calendar feeds and jobs without their own timezone.</p>
          <div className="grid-2" style={{ alignItems: 'end' }}>
            <div className="form-group">
              <label htmlFor="jobs-calendar-timezone">Default calendar timezone</label>
              <select id="jobs-calendar-timezone" className="input" value={workspaceTimeZone} disabled={!isManagerRole(role) || savingTimeZone} onChange={(event) => setWorkspaceTimeZone(event.target.value)}>
                {TIME_ZONE_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
              </select>
            </div>
            {isManagerRole(role) ? <button className="btn btn-primary" type="button" disabled={savingTimeZone} onClick={() => void saveWorkspaceTimeZone()}>{savingTimeZone ? 'Saving…' : 'Save timezone'}</button> : null}
          </div>
          <div style={{ marginTop: 18 }}><ScheduleCalendarConnections role={role} /></div>
        </div>
      </details>
    </AppShell>
  );
}

export default function JobsCalendarPage() {
  return <Suspense><JobsCalendarContent /></Suspense>;
}
