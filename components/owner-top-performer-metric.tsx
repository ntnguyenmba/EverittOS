'use client';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { rangeBounds, type DashboardDateRange } from '@/lib/dashboard-metrics';
import { getJobOperationalDate } from '@/lib/job-operational-date';
import { isAdminRole, normalizeRole } from '@/lib/roles';
import { ensureOrganizationForUser } from '@/lib/workspace-client';
import { supabase } from '@/lib/supabase';

const RANGE_KEY = 'everittos-dashboard-range';
const RANGES: DashboardDateRange[] = ['today', 'week', 'month', 'year', 'all_time'];

type Performer = {
  name: string;
  completedJobs: number;
};

function currentRange(): DashboardDateRange {
  const saved = window.localStorage.getItem(RANGE_KEY) as DashboardDateRange | null;
  return saved && RANGES.includes(saved) ? saved : 'month';
}

export function OwnerTopPerformerMetric() {
  const [host, setHost] = useState<HTMLElement | null>(null);
  const [range, setRange] = useState<DashboardDateRange>('month');
  const [performer, setPerformer] = useState<Performer | null>(null);
  const [allowed, setAllowed] = useState(false);

  useEffect(() => {
    let stopped = false;

    async function authorize() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user || stopped) return;
      const [profile, organization] = await Promise.all([
        supabase.from('profiles').select('role').eq('id', user.id).maybeSingle(),
        ensureOrganizationForUser(user.id)
      ]);
      const role = normalizeRole(organization?.role || profile.data?.role);
      if (!stopped) setAllowed(isAdminRole(role));
    }

    void authorize();
    return () => { stopped = true; };
  }, []);

  useEffect(() => {
    if (!allowed) return;

    function attach() {
      const grids = document.querySelectorAll<HTMLElement>('.dashboard-revenue-grid');
      const primaryGrid = grids.length > 1 ? grids[1] : grids[0];
      if (!primaryGrid) return;

      let node = primaryGrid.querySelector<HTMLElement>('[data-owner-top-performer-host]');
      if (!node) {
        node = document.createElement('div');
        node.dataset.ownerTopPerformerHost = 'true';
        node.style.display = 'contents';
        primaryGrid.appendChild(node);
      }
      setHost(node);
    }

    attach();
    const observer = new MutationObserver(attach);
    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, [allowed]);

  useEffect(() => {
    if (!allowed) return;
    setRange(currentRange());
    const timer = window.setInterval(() => {
      const next = currentRange();
      setRange((previous) => previous === next ? previous : next);
    }, 400);
    return () => window.clearInterval(timer);
  }, [allowed]);

  useEffect(() => {
    if (!allowed) return;
    let stopped = false;

    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user || stopped) return;
      const organization = await ensureOrganizationForUser(user.id);
      const organizationId = organization?.organizationId;
      if (!organizationId) {
        if (!stopped) setPerformer(null);
        return;
      }

      const [jobsResult, assignmentsResult, workersResult] = await Promise.all([
        supabase
          .from('jobs')
          .select('id, status, completed_at, start_date, scheduled_start, due_date, assigned_to')
          .eq('organization_id', organizationId),
        supabase.from('job_assignments').select('job_id, worker_id').eq('organization_id', organizationId),
        supabase.from('workers').select('id, name, email').eq('organization_id', organizationId)
      ]);

      if (jobsResult.error || assignmentsResult.error || workersResult.error || stopped) return;

      const workerNames = new Map<string, string>();
      for (const worker of workersResult.data || []) {
        const id = String(worker.id || '');
        if (id) workerNames.set(id, String(worker.name || worker.email || 'Team member'));
      }

      const workersByJob = new Map<string, string[]>();
      for (const assignment of assignmentsResult.data || []) {
        const jobId = String(assignment.job_id || '');
        const workerId = String(assignment.worker_id || '');
        if (!jobId || !workerId) continue;
        workersByJob.set(jobId, [...(workersByJob.get(jobId) || []), workerId]);
      }

      const { start, end } = rangeBounds(range);
      const counts = new Map<string, number>();
      for (const job of jobsResult.data || []) {
        if (!['completed', 'complete', 'finished', 'done'].includes(String(job.status || '').toLowerCase())) continue;
        const date = getJobOperationalDate(job);
        if (range !== 'all_time' && (!date || (start && date < start) || (end && date >= end))) continue;

        const assigned = workersByJob.get(String(job.id || '')) || [];
        const direct = String(job.assigned_to || '');
        const workerIds = assigned.length ? assigned : direct ? [direct] : [];
        for (const workerId of new Set(workerIds)) {
          if (!workerNames.has(workerId)) continue;
          counts.set(workerId, (counts.get(workerId) || 0) + 1);
        }
      }

      const top = [...counts.entries()].sort((a, b) => b[1] - a[1] || workerNames.get(a[0])!.localeCompare(workerNames.get(b[0])!))[0];
      if (!stopped) {
        setPerformer(top ? { name: workerNames.get(top[0]) || 'Team member', completedJobs: top[1] } : null);
      }
    }

    void load();
    return () => { stopped = true; };
  }, [allowed, range]);

  if (!host || !allowed) return null;

  return createPortal(
    <div className="dashboard-revenue-metric is-primary" style={{ minHeight: 120 }} aria-label="Top performer">
      <span className="dashboard-revenue-metric-label">Top performer</span>
      <strong className="dashboard-revenue-metric-value" style={{ fontSize: 'clamp(1.2rem, 2vw, 1.65rem)' }}>
        {performer?.name || 'No completed jobs'}
      </strong>
      <span className="muted" style={{ marginTop: 8 }}>
        {performer ? `${performer.completedJobs} completed ${performer.completedJobs === 1 ? 'job' : 'jobs'} in this period.` : 'No team member has completed a job in this period.'}
      </span>
    </div>,
    host
  );
}
