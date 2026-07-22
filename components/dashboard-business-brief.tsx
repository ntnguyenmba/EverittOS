'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { formatCurrency, type DashboardRevenueMetrics } from '@/lib/dashboard-metrics';
import { scopeJobsForWorkspace } from '@/lib/jobs-query';
import { supabase } from '@/lib/supabase';

type BriefCounts = {
  overdueJobs: number;
  unpaidInvoices: number;
  leadsNeedingFollowUp: number;
  jobsToday: number;
  bookingsToday: number;
};

type DashboardBusinessBriefProps = {
  organizationId: string;
  metrics: DashboardRevenueMetrics;
};

function todayDate(): string {
  return new Date().toISOString().slice(0, 10);
}

function todayStart(): string {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}

function todayEnd(): string {
  const d = new Date();
  d.setHours(23, 59, 59, 999);
  return d.toISOString();
}

export function DashboardBusinessBrief({ organizationId, metrics }: DashboardBusinessBriefProps) {
  const [loading, setLoading] = useState(true);
  const [counts, setCounts] = useState<BriefCounts>({
    overdueJobs: 0,
    unpaidInvoices: 0,
    leadsNeedingFollowUp: 0,
    jobsToday: 0,
    bookingsToday: 0
  });

  useEffect(() => {
    let active = true;

    async function loadBrief() {
      if (!organizationId) {
        setLoading(false);
        return;
      }

      setLoading(true);
      const today = todayDate();
      const {
        data: { user }
      } = await supabase.auth.getUser();

      if (!user) {
        setLoading(false);
        return;
      }

      const todayJobsQuery = scopeJobsForWorkspace(
        supabase
          .from('jobs')
          .select('id', { count: 'exact', head: true })
          .or(`start_date.eq.${today},due_date.eq.${today}`),
        user.id,
        organizationId,
        undefined
      );
      const overdueJobsQuery = scopeJobsForWorkspace(
        supabase
          .from('jobs')
          .select('id', { count: 'exact', head: true })
          .lt('due_date', today)
          .not('status', 'in', '("done","complete","completed","cancelled","canceled","closed")'),
        user.id,
        organizationId,
        undefined
      );
      const leadsQuery = supabase
        .from('customers')
        .select('id', { count: 'exact', head: true })
        .eq('organization_id', organizationId)
        .eq('record_type', 'lead')
        .in('pipeline_stage', ['open', 'contacted', 'qualified', 'proposal_sent', 'negotiation', 'reopened']);
      const invoicesQuery = supabase
        .from('invoices')
        .select('id', { count: 'exact', head: true })
        .eq('organization_id', organizationId)
        .in('status', ['sent', 'open', 'overdue', 'unpaid', 'past_due']);
      const bookingsQuery = supabase
        .from('bookings')
        .select('id', { count: 'exact', head: true })
        .eq('organization_id', organizationId)
        .gte('starts_at', todayStart())
        .lte('starts_at', todayEnd())
        .not('status', 'eq', 'cancelled');

      const [todayJobs, overdueJobs, leads, invoices, bookings] = await Promise.all([
        todayJobsQuery,
        overdueJobsQuery,
        leadsQuery,
        invoicesQuery,
        bookingsQuery
      ]);

      if (!active) return;
      setCounts({
        overdueJobs: overdueJobs.count || 0,
        unpaidInvoices: invoices.count || 0,
        leadsNeedingFollowUp: leads.count || 0,
        jobsToday: todayJobs.count || 0,
        bookingsToday: bookings.count || 0
      });
      setLoading(false);
    }

    void loadBrief();
    return () => {
      active = false;
    };
  }, [organizationId]);

  const scheduleToday = counts.jobsToday + counts.bookingsToday;
  const hasUrgentWork = counts.overdueJobs > 0 || counts.unpaidInvoices > 0 || counts.leadsNeedingFollowUp > 0;
  const summary = loading
    ? 'Checking what needs attention today.'
    : hasUrgentWork
      ? 'Start with overdue jobs, unpaid invoices, and open requests.'
      : 'Nothing urgent needs attention right now.';

  const items = [
    { label: 'Paid this month', value: formatCurrency(metrics.revenueThisMonth), href: '/analytics' },
    { label: 'Unpaid invoices', value: loading ? '...' : String(counts.unpaidInvoices), href: '/invoices' },
    { label: 'Overdue jobs', value: loading ? '...' : String(counts.overdueJobs), href: '/jobs' },
    { label: 'Requests to follow up', value: loading ? '...' : String(counts.leadsNeedingFollowUp), href: '/leads' },
    { label: 'Scheduled today', value: loading ? '...' : String(scheduleToday), href: '/schedule' }
  ];

  return (
    <section className="card dashboard-brief-card" aria-label="Today's overview">
      <div className="dashboard-brief-head">
        <div>
          <p className="dashboard-eyebrow">Today</p>
          <h2>{summary}</h2>
        </div>
        <Link href="/dashboard" className="dashboard-brief-ask">
          Ask Everitt
        </Link>
      </div>
      <div className="dashboard-brief-grid">
        {items.map((item) => (
          <Link key={item.label} href={item.href} className="dashboard-brief-item">
            <span>{item.label}</span>
            <strong>{item.value}</strong>
          </Link>
        ))}
      </div>
    </section>
  );
}
