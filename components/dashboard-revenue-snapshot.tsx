'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useTranslation } from '@/components/locale-provider';
import {
  fetchDashboardRevenueMetrics,
  formatCurrency,
  rangeBounds,
  type DashboardDateRange,
  type DashboardRevenueMetrics
} from '@/lib/dashboard-metrics';
import { getJobOperationalDate } from '@/lib/job-operational-date';
import { DASHBOARD_LINKS } from '@/lib/dashboard-links';
import { ensureOrganizationForUser } from '@/lib/workspace-client';
import { supabase } from '@/lib/supabase';

type DashboardRevenueSnapshotProps = {
  metrics: DashboardRevenueMetrics;
  todayJobs: number;
  loading?: boolean;
};

type PeriodFinance = {
  revenue: number;
  contractorCost: number;
};

const DASHBOARD_RANGE_STORAGE_KEY = 'everittos-dashboard-range';
const VALID_RANGES: DashboardDateRange[] = ['today', 'week', 'month', 'year', 'all_time'];

const copy = {
  en: {
    period: 'Period', today: 'Today', week: 'This Week', month: 'This Month', year: 'This Year', allTime: 'All Time',
    collected: 'Money received', customerBalanceDue: 'Customers owe', cashAfterPaidCosts: 'Money kept',
    jobsToday: 'Jobs today', jobsWeek: 'Jobs this week', jobsMonth: 'Jobs this month', jobsYear: 'Jobs this year', jobsAllTime: 'All jobs',
    jobsDesc: 'Jobs in this period.',
    financialDetails: 'Money details', contractorsPaid: 'Paid contractors', totalContractorCost: 'Contractor costs',
    expectedRevenue: 'Job revenue', expectedProfit: 'Profit', businessExpenses: 'Business expenses',
    collectedDesc: 'Money customers paid you.', currentBalances: 'Money customers still owe.', periodBalances: 'Money customers still owe for this period.',
    cashDesc: 'Money received minus costs already paid.', contractorsPaidDesc: 'Money already paid to contractors.',
    contractorCostDesc: 'What the work costs you, paid or not.',
    expectedRevenueDesc: 'Total value of the jobs in this period.',
    expectedProfitDesc: 'What is left after contractor costs and expenses.', expensesDesc: 'Fuel, supplies, software, and other costs.'
  },
  es: {
    period: 'Período', today: 'Hoy', week: 'Esta semana', month: 'Este mes', year: 'Este año', allTime: 'Todo el tiempo',
    collected: 'Dinero recibido', customerBalanceDue: 'Clientes deben', cashAfterPaidCosts: 'Dinero restante',
    jobsToday: 'Trabajos de hoy', jobsWeek: 'Trabajos de esta semana', jobsMonth: 'Trabajos de este mes', jobsYear: 'Trabajos de este año', jobsAllTime: 'Todos los trabajos',
    jobsDesc: 'Trabajos de este período.',
    financialDetails: 'Detalles de dinero', contractorsPaid: 'Contratistas pagados', totalContractorCost: 'Costos de contratistas',
    expectedRevenue: 'Ingresos de trabajos', expectedProfit: 'Ganancia', businessExpenses: 'Gastos del negocio',
    collectedDesc: 'Dinero que los clientes te pagaron.', currentBalances: 'Dinero que los clientes todavía deben.', periodBalances: 'Dinero que los clientes todavía deben de este período.',
    cashDesc: 'Dinero recibido menos costos ya pagados.', contractorsPaidDesc: 'Dinero ya pagado a contratistas.',
    contractorCostDesc: 'Lo que cuesta el trabajo, pagado o pendiente.',
    expectedRevenueDesc: 'Valor total de los trabajos de este período.',
    expectedProfitDesc: 'Lo que queda después de contratistas y gastos.', expensesDesc: 'Combustible, suministros, software y otros costos.'
  },
  vi: {
    period: 'Khoảng thời gian', today: 'Hôm nay', week: 'Tuần này', month: 'Tháng này', year: 'Năm nay', allTime: 'Tất cả thời gian',
    collected: 'Tiền đã nhận', customerBalanceDue: 'Khách còn nợ', cashAfterPaidCosts: 'Tiền còn lại',
    jobsToday: 'Công việc hôm nay', jobsWeek: 'Công việc tuần này', jobsMonth: 'Công việc tháng này', jobsYear: 'Công việc năm nay', jobsAllTime: 'Tất cả công việc',
    jobsDesc: 'Công việc trong khoảng thời gian này.',
    financialDetails: 'Chi tiết tiền', contractorsPaid: 'Đã trả nhà thầu', totalContractorCost: 'Chi phí nhà thầu',
    expectedRevenue: 'Doanh thu công việc', expectedProfit: 'Lợi nhuận', businessExpenses: 'Chi phí kinh doanh',
    collectedDesc: 'Tiền khách đã trả cho bạn.', currentBalances: 'Tiền khách vẫn còn nợ.', periodBalances: 'Tiền khách vẫn còn nợ trong khoảng này.',
    cashDesc: 'Tiền đã nhận trừ các khoản đã trả.', contractorsPaidDesc: 'Tiền đã trả cho nhà thầu.',
    contractorCostDesc: 'Chi phí của công việc, dù đã trả hay chưa.',
    expectedRevenueDesc: 'Tổng giá trị công việc trong khoảng này.',
    expectedProfitDesc: 'Số tiền còn lại sau chi phí nhà thầu và chi phí khác.', expensesDesc: 'Xăng, vật tư, phần mềm và các chi phí khác.'
  }
} as const;

type MetricItem = {
  label: string;
  value: string;
  href: string;
  description?: string;
};

function amount(value: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.max(0, parsed) : 0;
}

async function loadPeriodFinance(organizationId: string, range: DashboardDateRange): Promise<PeriodFinance | null> {
  const { start, end } = rangeBounds(range);
  const [jobsResult, laborResult, invoicesResult, paymentsResult] = await Promise.all([
    supabase
      .from('jobs')
      .select('id, status, revenue_amount, expected_contractor_cost, created_at, start_date, scheduled_start, completed_at, due_date')
      .eq('organization_id', organizationId),
    supabase.from('job_labor').select('job_id, total_cost').eq('organization_id', organizationId),
    supabase
      .from('invoices')
      .select('job_id, amount, status, payment_status')
      .eq('organization_id', organizationId),
    supabase.from('job_payments').select('job_id, amount').eq('organization_id', organizationId)
  ]);

  if (jobsResult.error || laborResult.error || invoicesResult.error || paymentsResult.error) return null;

  const laborByJob = new Map<string, number>();
  for (const row of laborResult.data || []) {
    const jobId = String(row.job_id || '');
    if (!jobId) continue;
    laborByJob.set(jobId, (laborByJob.get(jobId) || 0) + amount(row.total_cost));
  }

  const invoiceByJob = new Map<string, number>();
  for (const row of invoicesResult.data || []) {
    const status = String(row.status || '').toLowerCase();
    const paymentStatus = String(row.payment_status || '').toLowerCase();
    if (['cancelled', 'canceled', 'draft', 'void', 'voided', 'deleted'].includes(status)) continue;
    if (['cancelled', 'canceled'].includes(paymentStatus)) continue;
    const jobId = String(row.job_id || '');
    if (!jobId) continue;
    invoiceByJob.set(jobId, (invoiceByJob.get(jobId) || 0) + amount(row.amount));
  }

  const paymentsByJob = new Map<string, number>();
  for (const row of paymentsResult.data || []) {
    const jobId = String(row.job_id || '');
    if (!jobId) continue;
    paymentsByJob.set(jobId, (paymentsByJob.get(jobId) || 0) + amount(row.amount));
  }

  let revenue = 0;
  let contractorCost = 0;

  for (const job of jobsResult.data || []) {
    const status = String(job.status || '').toLowerCase();
    if (['cancelled', 'canceled'].includes(status)) continue;
    const operationalDate = getJobOperationalDate(job);
    const inSelectedRange =
      range === 'all_time' ||
      Boolean(
        operationalDate &&
          (!start || operationalDate >= start) &&
          (!end || operationalDate < end)
      );
    if (!inSelectedRange) continue;

    const jobId = String(job.id || '');
    const verifiedRevenue = Math.max(
      amount(job.revenue_amount),
      invoiceByJob.get(jobId) || 0,
      paymentsByJob.get(jobId) || 0
    );
    const verifiedContractorCost = Math.max(
      amount(job.expected_contractor_cost),
      laborByJob.get(jobId) || 0
    );

    revenue += verifiedRevenue;
    contractorCost += verifiedContractorCost;
  }

  return {
    revenue: Number(revenue.toFixed(2)),
    contractorCost: Number(contractorCost.toFixed(2))
  };
}

export function DashboardRevenueSnapshot({ metrics, todayJobs, loading }: DashboardRevenueSnapshotProps) {
  const { locale } = useTranslation();
  const c = copy[locale];
  const [range, setRange] = useState<DashboardDateRange>('month');
  const [activeMetrics, setActiveMetrics] = useState(metrics);
  const [periodFinance, setPeriodFinance] = useState<PeriodFinance | null>(null);
  const [rangeLoading, setRangeLoading] = useState(false);
  const [showFinancialDetails, setShowFinancialDetails] = useState(false);

  useEffect(() => {
    const saved = window.localStorage.getItem(DASHBOARD_RANGE_STORAGE_KEY) as DashboardDateRange | null;
    if (saved && VALID_RANGES.includes(saved)) setRange(saved);
  }, []);

  useEffect(() => {
    window.localStorage.setItem(DASHBOARD_RANGE_STORAGE_KEY, range);
  }, [range]);

  useEffect(() => {
    if (range === 'month') setActiveMetrics(metrics);
  }, [metrics, range]);

  useEffect(() => {
    if (loading) return;
    let cancelled = false;

    async function loadRange() {
      setRangeLoading(true);
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          if (!cancelled) setRangeLoading(false);
          return;
        }
        const org = await ensureOrganizationForUser(user.id);
        const organizationId = org?.organizationId || null;
        const [next, verified] = await Promise.all([
          range === 'month'
            ? Promise.resolve(metrics)
            : fetchDashboardRevenueMetrics(supabase, organizationId, range),
          organizationId ? loadPeriodFinance(organizationId, range) : Promise.resolve(null)
        ]);
        if (!cancelled) {
          setActiveMetrics(next);
          setPeriodFinance(verified);
          setRangeLoading(false);
        }
      } catch {
        if (!cancelled) setRangeLoading(false);
      }
    }

    void loadRange();
    return () => {
      cancelled = true;
    };
  }, [range, loading, metrics]);

  const collected = activeMetrics.paidToYou ?? activeMetrics.cashCollected ?? 0;
  const outstanding = range === 'all_time' ? activeMetrics.stillOwed ?? 0 : activeMetrics.periodOutstanding ?? activeMetrics.stillOwed ?? 0;
  const cashAfterPaidCosts = activeMetrics.cashAfterPaidCosts ?? activeMetrics.cashAfterExpenses ?? activeMetrics.netCashFlow ?? 0;
  const contractorPaid = activeMetrics.contractorPaymentsPaid ?? 0;
  const contractorCost = periodFinance?.contractorCost ?? activeMetrics.contractorPayThisMonth ?? 0;
  const expectedRevenue = periodFinance?.revenue ?? activeMetrics.expectedRevenue ?? 0;
  const expenses = activeMetrics.otherExpensesThisMonth ?? 0;
  const expectedProfit = Number((expectedRevenue - contractorCost - expenses).toFixed(2));
  const selectedJobs = activeMetrics.totalJobs ?? (range === 'today' ? todayJobs : 0);
  const busy = Boolean(loading || rangeLoading);

  const rangeOptions: Array<{ id: DashboardDateRange; label: string }> = [
    { id: 'today', label: c.today },
    { id: 'week', label: c.week },
    { id: 'month', label: c.month },
    { id: 'year', label: c.year },
    { id: 'all_time', label: c.allTime }
  ];

  const jobsLabel =
    range === 'today'
      ? c.jobsToday
      : range === 'week'
        ? c.jobsWeek
        : range === 'month'
          ? c.jobsMonth
          : range === 'year'
            ? c.jobsYear
            : c.jobsAllTime;

  const primaryItems: MetricItem[] = [
    { label: c.collected, value: formatCurrency(collected), href: DASHBOARD_LINKS.paidToYou, description: c.collectedDesc },
    { label: c.customerBalanceDue, value: formatCurrency(outstanding), href: DASHBOARD_LINKS.stillOwed, description: range === 'all_time' ? c.currentBalances : c.periodBalances },
    { label: c.cashAfterPaidCosts, value: formatCurrency(cashAfterPaidCosts), href: DASHBOARD_LINKS.cashAfterExpenses, description: c.cashDesc },
    { label: jobsLabel, value: String(selectedJobs), href: '/jobs', description: c.jobsDesc }
  ];

  const detailItems: MetricItem[] = [
    { label: c.contractorsPaid, value: formatCurrency(contractorPaid), href: DASHBOARD_LINKS.contractorPay, description: c.contractorsPaidDesc },
    { label: c.totalContractorCost, value: formatCurrency(contractorCost), href: DASHBOARD_LINKS.contractorPay, description: c.contractorCostDesc },
    { label: c.expectedRevenue, value: formatCurrency(expectedRevenue), href: DASHBOARD_LINKS.estimatedProfit, description: c.expectedRevenueDesc },
    { label: c.expectedProfit, value: formatCurrency(expectedProfit), href: DASHBOARD_LINKS.estimatedProfit, description: c.expectedProfitDesc },
    { label: c.businessExpenses, value: formatCurrency(expenses), href: DASHBOARD_LINKS.otherExpenses, description: c.expensesDesc }
  ];

  return (
    <section aria-label="Dashboard" aria-busy={busy}>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 14 }}>
        <label className="sr-only" htmlFor="dashboard-period">{c.period}</label>
        <select id="dashboard-period" className="input" value={range} disabled={busy} onChange={(event) => setRange(event.target.value as DashboardDateRange)} style={{ width: 'auto', minWidth: 140 }}>
          {rangeOptions.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}
        </select>
      </div>

      <div className="dashboard-revenue-grid" style={{ opacity: busy ? 0.58 : 1 }}>
        {primaryItems.map((item) => (
          <Link key={item.label} href={item.href} className="dashboard-revenue-metric is-primary" style={{ minHeight: 120, pointerEvents: busy ? 'none' : 'auto' }}>
            <span className="dashboard-revenue-metric-label">{item.label}</span>
            <strong className="dashboard-revenue-metric-value">{item.value}</strong>
            {item.description ? <span className="muted" style={{ marginTop: 8 }}>{item.description}</span> : null}
          </Link>
        ))}
      </div>

      <div style={{ marginTop: 18 }}>
        <button type="button" className="button secondary" disabled={busy} aria-expanded={showFinancialDetails} onClick={() => setShowFinancialDetails((current) => !current)}>
          {c.financialDetails}
        </button>
      </div>

      {showFinancialDetails ? (
        <div className="dashboard-revenue-grid" style={{ marginTop: 14, opacity: busy ? 0.58 : 1 }}>
          {detailItems.map((item) => (
            <Link key={item.label} href={item.href} className="dashboard-revenue-metric" style={{ minHeight: 100, pointerEvents: busy ? 'none' : 'auto' }}>
              <span className="dashboard-revenue-metric-label">{item.label}</span>
              <strong className="dashboard-revenue-metric-value">{item.value}</strong>
              {item.description ? <span className="muted" style={{ marginTop: 8 }}>{item.description}</span> : null}
            </Link>
          ))}
        </div>
      ) : null}
    </section>
  );
}
