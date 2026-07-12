'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { ensureOrganizationForUser } from '@/lib/workspace-client';
import { supabase } from '@/lib/supabase';

type PersonalWorkMetricsProps = {
  role: string;
};

type JobRow = {
  id: string;
  user_id: string | null;
  assigned_to: string | null;
  status: string | null;
  created_at: string | null;
  start_date: string | null;
  due_date: string | null;
  completed_at: string | null;
  revenue_amount: number | string | null;
};

type LaborRow = {
  total_cost?: number | string | null;
  payment_status?: string | null;
  created_at?: string | null;
};

type PersonalMetrics = {
  totalJobs: number;
  activeJobs: number;
  completedJobs: number;
  dueToday: number;
  overdueJobs: number;
  photosUploaded: number;
  reportsCreated: number;
  recordedEarnings: number;
  paidEarnings: number;
  pendingPayout: number;
  earningsThisMonth: number;
  jobRevenueAllTime: number;
  jobRevenueThisMonth: number;
};

const EMPTY_METRICS: PersonalMetrics = {
  totalJobs: 0,
  activeJobs: 0,
  completedJobs: 0,
  dueToday: 0,
  overdueJobs: 0,
  photosUploaded: 0,
  reportsCreated: 0,
  recordedEarnings: 0,
  paidEarnings: 0,
  pendingPayout: 0,
  earningsThisMonth: 0,
  jobRevenueAllTime: 0,
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
  const visible = isManager || normalizedRole === 'contractor' || normalizedRole === 'employee' || normalizedRole === 'staff' || normalizedRole === 'worker';

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
      const workerIds = (workerRows || []).map((row) => String(row.id));
      const assigneeIds = Array.from(new Set([user.id, ...workerIds]));

      const assignmentJobIds = new Set<string>();
      if (workerIds.length > 0) {
        const { data: assignmentRows } = await supabase.from('job_assignments').select('job_id').in('worker_id', workerIds);
        for (const row of assignmentRows || []) assignmentJobIds.add(String(row.job_id));
      }

      let jobsQuery = supabase
        .from('jobs')
        .select('id, user_id, assigned_to, status, created_at, start_date, due_date, completed_at, revenue_amount')
        .limit(10000);
      jobsQuery = organizationId ? jobsQuery.eq('organization_id', organizationId) : jobsQuery.eq('user_id', user.id);

      const [jobsRes, photosRes, reportsRes, laborRes] = await Promise.all([
        jobsQuery,
        supabase.from('job_photos').select('id', { count: 'exact', head: true }).or(`user_id.eq.${user.id},uploaded_by.eq.${user.id}`),
        supabase.from('job_reports').select('id', { count: 'exact', head: true }).eq('user_id', user.id),
        workerIds.length > 0
          ? supabase.from('job_labor').select('total_cost, payment_status, created_at').in('worker_id', workerIds)
          : Promise.resolve({ data: [], error: null })
      ]);

      const jobs = ((jobsRes.data || []) as JobRow[]).filter((job) => {
        const createdByUser = job.user_id === user.id;
        const directlyAssigned = Boolean(job.assigned_to && assigneeIds.includes(job.assigned_to));
        const crewAssigned = assignmentJobIds.has(job.id);
        return createdByUser || directlyAssigned || crewAssigned;
      });

      const today = new Date().toISOString().slice(0, 10);
      const monthStart = monthStartIso();
      const activeJobs = jobs.filter((job) => !['completed', 'cancelled', 'canceled'].includes(String(job.status || '').toLowerCase()));
      const completedJobs = jobs.filter((job) => String(job.status || '').toLowerCase() === 'completed');
      const dueToday = activeJobs.filter((job) => rowDate(job.due_date || job.start_date) === today).length;
      const overdueJobs = activeJobs.filter((job) => {
        const date = rowDate(job.due_date || job.start_date);
        return Boolean(date && date < today);
      }).length;

      const laborRows = (laborRes.data || []) as LaborRow[];
      const recordedEarnings = laborRows.reduce((sum, row) => sum + numberValue(row.total_cost), 0);
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

      const jobRevenueAllTime = jobs.reduce((sum, job) => sum + numberValue(job.revenue_amount), 0);
      const jobRevenueThisMonth = jobs.reduce((sum, job) => {
        const date = rowDate(job.completed_at || job.start_date || job.created_at);
        return date >= monthStart ? sum + numberValue(job.revenue_amount) : sum;
      }, 0);

      if (!cancelled) {
        setMetrics({
          totalJobs: jobs.length,
          activeJobs: activeJobs.length,
          completedJobs: completedJobs.length,
          dueToday,
          overdueJobs,
          photosUploaded: photosRes.error ? 0 : photosRes.count || 0,
          reportsCreated: reportsRes.error ? 0 : reportsRes.count || 0,
          recordedEarnings,
          paidEarnings,
          pendingPayout,
          earningsThisMonth,
          jobRevenueAllTime,
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
    const workCards = [
      { label: 'My active jobs', value: String(metrics.activeJobs), href: '/jobs?mine=true&status=active' },
      { label: 'Due today', value: String(metrics.dueToday), href: '/schedule?mine=true' },
      { label: 'My completed jobs, all time', value: String(metrics.completedJobs), href: '/jobs?mine=true&status=completed' },
      { label: 'My overdue jobs', value: String(metrics.overdueJobs), href: '/jobs?mine=true&status=overdue' },
      { label: 'My photos uploaded', value: String(metrics.photosUploaded), href: '/photos?mine=true' },
      { label: 'My reports', value: String(metrics.reportsCreated), href: '/reports?mine=true' }
    ];

    if (isManager) {
      return [
        ...workCards,
        { label: 'Revenue from my jobs, this month', value: money(metrics.jobRevenueThisMonth), href: '/jobs?mine=true' },
        { label: 'Revenue from my jobs, all time', value: money(metrics.jobRevenueAllTime), href: '/jobs?mine=true' }
      ];
    }

    return [
      ...workCards,
      { label: 'My earnings, this month', value: money(metrics.earningsThisMonth), href: '/my-work' },
      { label: 'My earnings paid', value: money(metrics.paidEarnings), href: '/my-work' },
      { label: 'My pending payout', value: money(metrics.pendingPayout), href: '/my-work' },
      { label: 'My earnings recorded, all time', value: money(metrics.recordedEarnings), href: '/my-work' }
    ];
  }, [isManager, metrics]);

  if (!visible) return null;

  return (
    <section className="card" aria-label="My performance metrics">
      <div className="dashboard-section-head">
        <div>
          <h2>My metrics</h2>
          <p className="muted">
            {isManager
              ? 'Only jobs you created or manage are included. Shared access alone does not count as an assignment.'
              : 'Only jobs assigned to you and contractor pay recorded for you are included. Shared access alone does not count as an assignment.'}
          </p>
        </div>
        <Link href="/my-work" className="dashboard-section-link">Open my work</Link>
      </div>
      {loading ? <p className="loading-state">Loading your metrics...</p> : null}
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
    </section>
  );
}
