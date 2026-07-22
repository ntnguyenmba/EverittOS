'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { ensureOrganizationForUser } from '@/lib/workspace-client';
import { supabase } from '@/lib/supabase';
import {
  buildAssignmentWorkerIdsByJob,
  formatLocalDateOnly,
  getWorkerAssignmentSummary,
  isJobAssignedToWorker,
  normalizeJobStatus
} from '@/lib/worker-assignment';

type PersonalWorkMetricsProps = {
  role: string;
};

type JobRow = {
  id: string;
  title?: string | null;
  user_id: string | null;
  assigned_to: string | null;
  status: string | null;
  created_at: string | null;
  start_date: string | null;
  due_date: string | null;
  scheduled_start?: string | null;
  completed_at: string | null;
  revenue_amount: number | string | null;
};

type LaborRow = {
  total_cost?: number | string | null;
  payment_status?: string | null;
  created_at?: string | null;
};

type PersonalMetrics = {
  activeJobs: number;
  dueToday: number;
  overdueJobs: number;
  paidEarnings: number;
  pendingPayout: number;
  earningsThisMonth: number;
  jobRevenueThisMonth: number;
};

const EMPTY_METRICS: PersonalMetrics = {
  activeJobs: 0,
  dueToday: 0,
  overdueJobs: 0,
  paidEarnings: 0,
  pendingPayout: 0,
  earningsThisMonth: 0,
  jobRevenueThisMonth: 0
};

function money(value: number) {
  return new Intl.NumberFormat(undefined, {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0
  }).format(value);
}

function numberValue(value: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function monthStartIso(): string {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
}

function rowDate(value: string | null | undefined): string {
  return String(value || '').slice(0, 10);
}

export function PersonalWorkMetrics({ role }: PersonalWorkMetricsProps) {
  const [metrics, setMetrics] = useState<PersonalMetrics>(EMPTY_METRICS);
  const [loading, setLoading] = useState(true);
  const normalizedRole = role.trim().toLowerCase();
  const isManager = normalizedRole === 'manager';
  const visible =
    isManager ||
    normalizedRole === 'contractor' ||
    normalizedRole === 'employee' ||
    normalizedRole === 'staff' ||
    normalizedRole === 'worker';

  useEffect(() => {
    if (!visible) {
      setLoading(false);
      return;
    }

    let cancelled = false;

    async function load() {
      setLoading(true);
      const { data: authData } = await supabase.auth.getUser();
      const user = authData.user;
      if (!user) {
        if (!cancelled) setLoading(false);
        return;
      }

      const org = await ensureOrganizationForUser(user.id);
      const organizationId = org?.organizationId || null;
      const workerQuery = supabase.from('workers').select('id').eq('auth_user_id', user.id);
      const { data: workerRows } = organizationId ? await workerQuery.eq('organization_id', organizationId) : await workerQuery;
      const workerIds = (workerRows || []).map((row: { id: string }) => String(row.id));
      const identity = { userId: user.id, workerIds };

      let jobsQuery = supabase
        .from('jobs')
        .select('id, title, user_id, assigned_to, status, created_at, start_date, due_date, scheduled_start, completed_at, revenue_amount')
        .limit(10000);
      jobsQuery = organizationId ? jobsQuery.eq('organization_id', organizationId) : jobsQuery.eq('user_id', user.id);

      const [jobsRes, laborRes, assignmentRes] = await Promise.all([
        jobsQuery,
        workerIds.length > 0
          ? supabase.from('job_labor').select('total_cost, payment_status, created_at').in('worker_id', workerIds)
          : Promise.resolve({ data: [], error: null }),
        workerIds.length > 0
          ? supabase.from('job_assignments').select('job_id, worker_id').in('worker_id', workerIds)
          : Promise.resolve({ data: [], error: null })
      ]);

      const assignmentWorkerIdsByJob = buildAssignmentWorkerIdsByJob(assignmentRes.data || []);
      const jobs = ((jobsRes.data || []) as JobRow[]).filter((job) => {
        const createdByUser = job.user_id === user.id;
        return createdByUser || isJobAssignedToWorker(job, identity, assignmentWorkerIdsByJob);
      });

      const today = formatLocalDateOnly();
      const monthStart = monthStartIso();
      const assignmentSummary = getWorkerAssignmentSummary(jobs, identity, today, assignmentWorkerIdsByJob);
      const activeJobs = jobs.filter((job) => {
        const status = normalizeJobStatus(job.status);
        return status !== 'completed' && status !== 'cancelled';
      });

      const laborRows = (laborRes.data || []) as LaborRow[];
      const paidEarnings = laborRows.reduce((sum, row) => {
        const status = String(row.payment_status || 'unpaid').toLowerCase();
        return status === 'paid' ? sum + numberValue(row.total_cost) : sum;
      }, 0);
      const pendingPayout = laborRows.reduce((sum, row) => {
        const status = String(row.payment_status || 'unpaid').toLowerCase();
        return status === 'paid' ? sum : sum + numberValue(row.total_cost);
      }, 0);
      const earningsThisMonth = laborRows.reduce((sum, row) => {
        return rowDate(row.created_at) >= monthStart ? sum + numberValue(row.total_cost) : sum;
      }, 0);
      const jobRevenueThisMonth = jobs.reduce((sum, job) => {
        const date = rowDate(job.completed_at || job.start_date || job.created_at);
        return date >= monthStart ? sum + numberValue(job.revenue_amount) : sum;
      }, 0);

      if (!cancelled) {
        setMetrics({
          activeJobs: activeJobs.length,
          dueToday: assignmentSummary.dueToday,
          overdueJobs: assignmentSummary.overdue,
          paidEarnings,
          pendingPayout,
          earningsThisMonth,
          jobRevenueThisMonth
        });
        setLoading(false);
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [visible]);

  const cards = useMemo(() => {
    const moneyCard = isManager
      ? { label: 'Money this month', value: money(metrics.jobRevenueThisMonth), href: '/jobs?mine=true' }
      : { label: 'Pay this month', value: money(metrics.earningsThisMonth), href: '/my-work' };

    return [
      { label: 'Active jobs', value: String(metrics.activeJobs), href: '/jobs?mine=true&status=active' },
      { label: 'Jobs today', value: String(metrics.dueToday), href: '/schedule?mine=true' },
      { label: 'Overdue', value: String(metrics.overdueJobs), href: '/jobs?mine=true&status=overdue' },
      moneyCard
    ];
  }, [isManager, metrics]);

  if (!visible) return null;

  return (
    <section className="card" aria-label="My work">
      <div className="dashboard-section-head">
        <h2>My work</h2>
        <Link href="/my-work" className="dashboard-section-link">
          View all
        </Link>
      </div>
      {loading ? <p className="loading-state">Loading...</p> : null}
      {!loading ? (
        <div className="stats-grid">
          {cards.map((card) => (
            <Link key={card.label} href={card.href} className="stat-card" style={{ textDecoration: 'none' }}>
              <span>{card.label}</span>
              <strong>{card.value}</strong>
            </Link>
          ))}
        </div>
      ) : null}
      {!isManager && !loading && metrics.pendingPayout > 0 ? (
        <p className="muted" style={{ marginTop: 12 }}>
          Waiting for pay: {money(metrics.pendingPayout)} · Paid: {money(metrics.paidEarnings)}
        </p>
      ) : null}
    </section>
  );
}
