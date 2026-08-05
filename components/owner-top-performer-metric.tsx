'use client';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from '@/components/locale-provider';
import {
  filterValidJobsInPeriod,
  formatCurrency,
  isCompletedCountableJob,
  type DashboardDateRange,
  type JobCountRow
} from '@/lib/dashboard-metrics';
import { isAdminRole, normalizeRole } from '@/lib/roles';
import { ensureOrganizationForUser } from '@/lib/workspace-client';
import { supabase } from '@/lib/supabase';

const RANGE_KEY = 'everittos-dashboard-range';
const RANGES: DashboardDateRange[] = ['today', 'week', 'month', 'year', 'all_time'];

const copy = {
  en: {
    topPerformers: 'Top performers',
    topCustomers: 'Top customers',
    noCompletedJobs: 'No completed jobs',
    noCustomerRevenue: 'No customer revenue',
    completedJob: 'completed job',
    completedJobs: 'completed jobs',
    jobRevenue: 'job revenue',
    noTeamPeriod: 'No team member has completed a job in this period.',
    noCustomerPeriod: 'No customer revenue was found in this period.'
  },
  es: {
    topPerformers: 'Mejores trabajadores',
    topCustomers: 'Mejores clientes',
    noCompletedJobs: 'No hay trabajos terminados',
    noCustomerRevenue: 'No hay ingresos de clientes',
    completedJob: 'trabajo terminado',
    completedJobs: 'trabajos terminados',
    jobRevenue: 'ingresos de trabajos',
    noTeamPeriod: 'Ningún miembro del equipo terminó un trabajo en este período.',
    noCustomerPeriod: 'No se encontraron ingresos de clientes en este período.'
  },
  vi: {
    topPerformers: 'Nhân sự nổi bật',
    topCustomers: 'Khách hàng hàng đầu',
    noCompletedJobs: 'Chưa có công việc hoàn thành',
    noCustomerRevenue: 'Chưa có doanh thu khách hàng',
    completedJob: 'công việc đã hoàn thành',
    completedJobs: 'công việc đã hoàn thành',
    jobRevenue: 'doanh thu công việc',
    noTeamPeriod: 'Chưa có thành viên nào hoàn thành công việc trong khoảng này.',
    noCustomerPeriod: 'Chưa có doanh thu khách hàng trong khoảng này.'
  }
} as const;

type PerformerRanking = {
  id: string;
  name: string;
  completedJobs: number;
};

type CustomerRanking = {
  id: string;
  name: string;
  revenue: number;
};

function currentRange(): DashboardDateRange {
  const saved = window.localStorage.getItem(RANGE_KEY) as DashboardDateRange | null;
  return saved && RANGES.includes(saved) ? saved : 'month';
}

function amount(value: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.max(0, parsed) : 0;
}

export function OwnerTopPerformerMetric() {
  const { locale } = useTranslation();
  const c = copy[locale];
  const [host, setHost] = useState<HTMLElement | null>(null);
  const [range, setRange] = useState<DashboardDateRange>('month');
  const [performers, setPerformers] = useState<PerformerRanking[]>([]);
  const [customers, setCustomers] = useState<CustomerRanking[]>([]);
  const [allowed, setAllowed] = useState(false);

  useEffect(() => {
    let stopped = false;

    async function authorize() {
      const {
        data: { user }
      } = await supabase.auth.getUser();
      if (!user || stopped) return;
      const [profile, organization] = await Promise.all([
        supabase.from('profiles').select('role').eq('id', user.id).maybeSingle(),
        ensureOrganizationForUser(user.id)
      ]);
      const role = normalizeRole(organization?.role || profile.data?.role);
      if (!stopped) setAllowed(isAdminRole(role));
    }

    void authorize();
    return () => {
      stopped = true;
    };
  }, []);

  useEffect(() => {
    if (!allowed) return;

    function attach() {
      const grids = document.querySelectorAll<HTMLElement>('.dashboard-revenue-grid');
      const primaryGrid = grids.length > 1 ? grids[1] : grids[0];
      if (!primaryGrid) return;

      let node = primaryGrid.querySelector<HTMLElement>('[data-owner-rankings-host]');
      if (!node) {
        node = document.createElement('div');
        node.dataset.ownerRankingsHost = 'true';
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
      setRange((previous) => (previous === next ? previous : next));
    }, 400);
    return () => window.clearInterval(timer);
  }, [allowed]);

  useEffect(() => {
    if (!allowed) return;
    let stopped = false;

    async function load() {
      const {
        data: { user }
      } = await supabase.auth.getUser();
      if (!user || stopped) return;
      const organization = await ensureOrganizationForUser(user.id);
      const organizationId = organization?.organizationId;
      if (!organizationId) {
        if (!stopped) {
          setPerformers([]);
          setCustomers([]);
        }
        return;
      }

      const [jobsResult, assignmentsResult, workersResult, invoicesResult, paymentsResult] = await Promise.all([
        supabase
          .from('jobs')
          .select(
            'id, status, completed_at, start_date, scheduled_start, due_date, created_at, assigned_to, customer_id, customer_name, revenue_amount, is_skipped, recurring_series_id, occurrence_date'
          )
          .eq('organization_id', organizationId),
        supabase.from('job_assignments').select('job_id, worker_id').eq('organization_id', organizationId),
        supabase.from('workers').select('id, name, email').eq('organization_id', organizationId),
        supabase.from('invoices').select('job_id, amount, status, payment_status').eq('organization_id', organizationId),
        supabase.from('job_payments').select('job_id, amount').eq('organization_id', organizationId)
      ]);

      if (
        jobsResult.error ||
        assignmentsResult.error ||
        workersResult.error ||
        invoicesResult.error ||
        paymentsResult.error ||
        stopped
      ) {
        return;
      }

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

      const invoiceByJob = new Map<string, number>();
      for (const invoice of invoicesResult.data || []) {
        const status = String(invoice.status || '').toLowerCase();
        const paymentStatus = String(invoice.payment_status || '').toLowerCase();
        if (['cancelled', 'canceled', 'draft', 'void', 'voided', 'deleted'].includes(status)) continue;
        if (['cancelled', 'canceled'].includes(paymentStatus)) continue;
        const jobId = String(invoice.job_id || '');
        if (!jobId) continue;
        invoiceByJob.set(jobId, (invoiceByJob.get(jobId) || 0) + amount(invoice.amount));
      }

      const paymentsByJob = new Map<string, number>();
      for (const payment of paymentsResult.data || []) {
        const jobId = String(payment.job_id || '');
        if (!jobId) continue;
        paymentsByJob.set(jobId, (paymentsByJob.get(jobId) || 0) + amount(payment.amount));
      }

      // Same period + validity rules as the dashboard completed-job count.
      const periodJobs = filterValidJobsInPeriod((jobsResult.data || []) as JobCountRow[], range);
      const completedPeriodJobs = periodJobs.filter((job) => isCompletedCountableJob(job));
      const performerCounts = new Map<string, number>();
      const customerRevenue = new Map<string, { name: string; revenue: number }>();

      for (const job of completedPeriodJobs) {
        const jobId = String(job.id || '');
        if (!jobId) continue;

        const assigned = workersByJob.get(jobId) || [];
        const direct = String((job as { assigned_to?: string | null }).assigned_to || '');
        const workerIds = assigned.length ? assigned : direct ? [direct] : [];
        Array.from(new Set(workerIds)).forEach((workerId) => {
          if (!workerNames.has(workerId)) return;
          performerCounts.set(workerId, (performerCounts.get(workerId) || 0) + 1);
        });

        const customerId = String((job as { customer_id?: string | null }).customer_id || '').trim();
        const customerName = String((job as { customer_name?: string | null }).customer_name || '').trim();
        if (!customerId && !customerName) continue;
        const customerKey = customerId || `name:${customerName.toLowerCase()}`;
        // Completed revenue once per job — max of quote/invoice/payments, never invoice + job.
        const revenue = Math.max(
          amount((job as { revenue_amount?: unknown }).revenue_amount),
          invoiceByJob.get(jobId) || 0,
          paymentsByJob.get(jobId) || 0
        );
        if (revenue <= 0) continue;
        const existing = customerRevenue.get(customerKey);
        customerRevenue.set(customerKey, {
          name: customerName || existing?.name || 'Customer',
          revenue: Number(((existing?.revenue || 0) + revenue).toFixed(2))
        });
      }

      const nextPerformers = Array.from(performerCounts.entries())
        .map(([id, completedJobs]) => ({ id, name: workerNames.get(id) || 'Team member', completedJobs }))
        .sort((a, b) => b.completedJobs - a.completedJobs || a.name.localeCompare(b.name))
        .slice(0, 3);

      const nextCustomers = Array.from(customerRevenue.entries())
        .map(([id, value]) => ({ id, name: value.name, revenue: value.revenue }))
        .sort((a, b) => b.revenue - a.revenue || a.name.localeCompare(b.name))
        .slice(0, 3);

      if (!stopped) {
        setPerformers(nextPerformers);
        setCustomers(nextCustomers);
      }
    }

    void load();
    return () => {
      stopped = true;
    };
  }, [allowed, range]);

  if (!host || !allowed) return null;

  const rankingRowStyle = {
    display: 'grid',
    gridTemplateColumns: '28px minmax(0, 1fr) auto',
    gap: 10,
    alignItems: 'center',
    width: '100%'
  } as const;

  return createPortal(
    <>
      <div className="dashboard-revenue-metric is-primary" style={{ minHeight: 150 }} aria-label={c.topPerformers}>
        <span className="dashboard-revenue-metric-label">{c.topPerformers}</span>
        {performers.length ? (
          <div style={{ display: 'grid', gap: 10, marginTop: 12 }}>
            {performers.map((performer, index) => (
              <div key={performer.id} style={rankingRowStyle}>
                <strong>{index + 1}</strong>
                <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{performer.name}</span>
                <span className="muted">
                  {performer.completedJobs} {performer.completedJobs === 1 ? c.completedJob : c.completedJobs}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <>
            <strong className="dashboard-revenue-metric-value" style={{ fontSize: 'clamp(1.1rem, 2vw, 1.45rem)' }}>
              {c.noCompletedJobs}
            </strong>
            <span className="muted" style={{ marginTop: 8 }}>{c.noTeamPeriod}</span>
          </>
        )}
      </div>

      <div className="dashboard-revenue-metric is-primary" style={{ minHeight: 150 }} aria-label={c.topCustomers}>
        <span className="dashboard-revenue-metric-label">{c.topCustomers}</span>
        {customers.length ? (
          <div style={{ display: 'grid', gap: 10, marginTop: 12 }}>
            {customers.map((customer, index) => (
              <div key={customer.id} style={rankingRowStyle}>
                <strong>{index + 1}</strong>
                <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{customer.name}</span>
                <span className="muted">{formatCurrency(customer.revenue)}</span>
              </div>
            ))}
            <span className="muted" style={{ marginTop: 2 }}>{c.jobRevenue}</span>
          </div>
        ) : (
          <>
            <strong className="dashboard-revenue-metric-value" style={{ fontSize: 'clamp(1.1rem, 2vw, 1.45rem)' }}>
              {c.noCustomerRevenue}
            </strong>
            <span className="muted" style={{ marginTop: 8 }}>{c.noCustomerPeriod}</span>
          </>
        )}
      </div>
    </>,
    host
  );
}
