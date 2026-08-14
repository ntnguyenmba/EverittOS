'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { ExportMenu } from '@/components/export-menu';
import { useAppFeedback } from '@/components/feedback/use-app-feedback';
import { useTranslation } from '@/components/locale-provider';
import {
  calculateJobRevenue,
  calculateMoneyKept,
  calculateEstimatedProfit,
  customersOweForRange,
  fetchDashboardRevenueMetrics,
  formatCurrency,
  type DashboardDateRange,
  type DashboardRevenueMetrics
} from '@/lib/dashboard-metrics';
import { DASHBOARD_LINKS } from '@/lib/dashboard-links';
import { getExportCopy } from '@/lib/i18n/export-copy';
import { ensureOrganizationForUser } from '@/lib/workspace-client';
import { supabase } from '@/lib/supabase';

type DashboardRevenueSnapshotProps = {
  metrics: DashboardRevenueMetrics;
  loading?: boolean;
};

type MetricItem = {
  label: string;
  value: string;
  href: string;
  description?: string;
};

const DASHBOARD_RANGE_STORAGE_KEY = 'everittos-dashboard-range';
const VALID_RANGES: DashboardDateRange[] = ['today', 'week', 'month', 'year', 'all_time'];

const copy = {
  en: {
    dashboard: 'Money overview',
    period: 'Period', today: 'Today', week: 'This Week', month: 'This Month', year: 'This Year', allTime: 'All Time',
    collected: 'Money in', customerBalanceDue: 'Still owed', cashAfterPaidCosts: 'Money kept',
    jobsToday: 'Jobs today', jobsWeek: 'Jobs this week', jobsMonth: 'Jobs this month', jobsYear: 'Jobs this year', jobsAllTime: 'All jobs',
    jobsDesc: 'Jobs in this period.', showFinancialDetails: 'Show more money details', hideFinancialDetails: 'Hide money details', contractorsPaid: 'Paid contractors',
    totalContractorCost: 'Contractor costs', expectedRevenue: 'Job revenue', expectedProfit: 'Profit', businessExpenses: 'Business expenses',
    collectedDesc: 'Money customers paid you.', currentBalances: 'Money customers still owe.', periodBalances: 'Money customers still owe for this period.',
    cashDesc: 'Money received minus costs already paid.', contractorsPaidDesc: 'Money already paid to contractors.',
    contractorCostDesc: 'What the work costs you, paid or not.', expectedRevenueDesc: 'Money received plus money customers still owe.',
    expectedProfitDesc: 'What is left after contractor costs and expenses.', expensesDesc: 'Fuel, supplies, software, and other costs.'
  },
  es: {
    dashboard: 'Resumen de dinero',
    period: 'Período', today: 'Hoy', week: 'Esta semana', month: 'Este mes', year: 'Este año', allTime: 'Todo el tiempo',
    collected: 'Dinero recibido', customerBalanceDue: 'Aún pendiente', cashAfterPaidCosts: 'Dinero restante',
    jobsToday: 'Trabajos de hoy', jobsWeek: 'Trabajos de esta semana', jobsMonth: 'Trabajos de este mes', jobsYear: 'Trabajos de este año', jobsAllTime: 'Todos los trabajos',
    jobsDesc: 'Trabajos de este período.', showFinancialDetails: 'Mostrar más detalles de dinero', hideFinancialDetails: 'Ocultar detalles de dinero', contractorsPaid: 'Contratistas pagados',
    totalContractorCost: 'Costos de contratistas', expectedRevenue: 'Ingresos de trabajos', expectedProfit: 'Ganancia', businessExpenses: 'Gastos del negocio',
    collectedDesc: 'Dinero que los clientes te pagaron.', currentBalances: 'Dinero que los clientes todavía deben.', periodBalances: 'Dinero que los clientes todavía deben de este período.',
    cashDesc: 'Dinero recibido menos costos ya pagados.', contractorsPaidDesc: 'Dinero ya pagado a contratistas.',
    contractorCostDesc: 'Lo que cuesta el trabajo, pagado o pendiente.', expectedRevenueDesc: 'Dinero recibido más dinero que los clientes todavía deben.',
    expectedProfitDesc: 'Lo que queda después de contratistas y gastos.', expensesDesc: 'Combustible, suministros, software y otros costos.'
  },
  vi: {
    dashboard: 'Tổng quan tiền',
    period: 'Khoảng thời gian', today: 'Hôm nay', week: 'Tuần này', month: 'Tháng này', year: 'Năm nay', allTime: 'Tất cả thời gian',
    collected: 'Tiền vào', customerBalanceDue: 'Còn phải thu', cashAfterPaidCosts: 'Tiền còn lại',
    jobsToday: 'Công việc hôm nay', jobsWeek: 'Công việc tuần này', jobsMonth: 'Công việc tháng này', jobsYear: 'Công việc năm nay', jobsAllTime: 'Tất cả công việc',
    jobsDesc: 'Công việc trong khoảng thời gian này.', showFinancialDetails: 'Hiện thêm chi tiết tiền', hideFinancialDetails: 'Ẩn chi tiết tiền', contractorsPaid: 'Đã trả nhà thầu',
    totalContractorCost: 'Chi phí nhà thầu', expectedRevenue: 'Doanh thu công việc', expectedProfit: 'Lợi nhuận', businessExpenses: 'Chi phí kinh doanh',
    collectedDesc: 'Tiền khách đã trả cho bạn.', currentBalances: 'Tiền khách vẫn còn nợ.', periodBalances: 'Tiền khách vẫn còn nợ trong khoảng này.',
    cashDesc: 'Tiền đã nhận trừ các khoản đã trả.', contractorsPaidDesc: 'Tiền đã trả cho nhà thầu.',
    contractorCostDesc: 'Chi phí của công việc, dù đã trả hay chưa.', expectedRevenueDesc: 'Tiền đã nhận cộng với tiền khách vẫn còn nợ.',
    expectedProfitDesc: 'Số tiền còn lại sau chi phí nhà thầu và chi phí khác.', expensesDesc: 'Xăng, vật tư, phần mềm và các chi phí khác.'
  }
} as const;

export function DashboardRevenueSnapshot({ metrics, loading }: DashboardRevenueSnapshotProps) {
  const { locale } = useTranslation();
  const c = copy[locale];
  const exportCopy = getExportCopy(locale);
  const appFeedback = useAppFeedback();
  const [range, setRange] = useState<DashboardDateRange>('month');
  const [activeMetrics, setActiveMetrics] = useState(metrics);
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
        if (!user) return;
        const org = await ensureOrganizationForUser(user.id);
        const next = await fetchDashboardRevenueMetrics(supabase, org?.organizationId || null, range);
        if (!cancelled) setActiveMetrics(next);
      } finally {
        if (!cancelled) setRangeLoading(false);
      }
    }

    void loadRange();
    return () => { cancelled = true; };
  }, [range, loading]);

  const collected = activeMetrics.paidToYou ?? activeMetrics.cashCollected ?? 0;
  const outstanding = customersOweForRange(
    range,
    activeMetrics.stillOwed ?? 0,
    activeMetrics.periodOutstanding ?? activeMetrics.stillOwed ?? 0
  );
  const contractorPaid = activeMetrics.contractorPaymentsPaid ?? 0;
  const contractorCost = activeMetrics.contractorPayThisMonth ?? 0;
  const expenses = activeMetrics.otherExpensesThisMonth ?? 0;

  const calculatedRevenue = calculateJobRevenue(collected, outstanding);
  const calculatedMoneyKept = calculateMoneyKept({
    moneyReceived: collected,
    paidContractors: contractorPaid,
    businessExpenses: expenses
  });
  const calculatedProfit = calculateEstimatedProfit({
    expectedRevenue: calculatedRevenue,
    contractorPay: contractorCost,
    otherExpenses: expenses
  });

  const expectedRevenue = Number.isFinite(activeMetrics.expectedRevenue)
    ? activeMetrics.expectedRevenue
    : calculatedRevenue;
  const cashAfterPaidCosts = Number.isFinite(activeMetrics.cashAfterPaidCosts)
    ? activeMetrics.cashAfterPaidCosts
    : calculatedMoneyKept;
  const expectedProfit = Number.isFinite(activeMetrics.estimatedProfit)
    ? activeMetrics.estimatedProfit
    : calculatedProfit;

  const selectedJobs = activeMetrics.totalJobs ?? 0;
  const busy = Boolean(loading || rangeLoading);
  const jobsPeriod =
    range === 'all_time' ? 'all' : range === 'today' || range === 'week' || range === 'month' || range === 'year' ? range : 'all';

  const rangeOptions: Array<{ id: DashboardDateRange; label: string }> = [
    { id: 'today', label: c.today }, { id: 'week', label: c.week }, { id: 'month', label: c.month },
    { id: 'year', label: c.year }, { id: 'all_time', label: c.allTime }
  ];

  const jobsLabel = range === 'today' ? c.jobsToday : range === 'week' ? c.jobsWeek : range === 'month' ? c.jobsMonth : range === 'year' ? c.jobsYear : c.jobsAllTime;

  const primaryItems: MetricItem[] = [
    { label: c.collected, value: formatCurrency(collected), href: DASHBOARD_LINKS.paidToYou, description: c.collectedDesc },
    { label: c.businessExpenses, value: formatCurrency(expenses), href: DASHBOARD_LINKS.otherExpenses, description: c.expensesDesc },
    { label: c.totalContractorCost, value: formatCurrency(contractorCost), href: DASHBOARD_LINKS.contractorPay, description: c.contractorCostDesc },
    { label: c.expectedProfit, value: formatCurrency(expectedProfit), href: DASHBOARD_LINKS.estimatedProfit, description: c.expectedProfitDesc }
  ];

  const detailItems: MetricItem[] = [
    { label: c.cashAfterPaidCosts, value: formatCurrency(cashAfterPaidCosts), href: DASHBOARD_LINKS.cashAfterExpenses, description: c.cashDesc },
    { label: c.contractorsPaid, value: formatCurrency(contractorPaid), href: DASHBOARD_LINKS.contractorPay, description: c.contractorsPaidDesc },
    { label: c.customerBalanceDue, value: formatCurrency(outstanding), href: DASHBOARD_LINKS.stillOwed, description: range === 'all_time' ? c.currentBalances : c.periodBalances },
    { label: c.expectedRevenue, value: formatCurrency(expectedRevenue), href: DASHBOARD_LINKS.estimatedProfit, description: c.expectedRevenueDesc },
    { label: jobsLabel, value: String(selectedJobs), href: `/jobs?period=${jobsPeriod}`, description: c.jobsDesc }
  ];

  return (
    <section aria-label={c.dashboard} aria-busy={busy}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center', marginBottom: 14, flexWrap: 'wrap' }}>
        <strong>{c.dashboard}</strong>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <label className="sr-only" htmlFor="dashboard-period">{c.period}</label>
          <select id="dashboard-period" className="input" value={range} disabled={busy} onChange={(event) => setRange(event.target.value as DashboardDateRange)} style={{ width: 'auto', minWidth: 140 }}>
            {rangeOptions.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}
          </select>
          <ExportMenu
            endpoint="/api/exports/dashboard"
            query={{ range }}
            locale={locale}
            disabled={busy}
            onError={(message) => appFeedback.error(message || exportCopy.exportFailed)}
            onSuccess={(format) => {
              if (format === 'share') appFeedback.success(exportCopy.shareSent);
            }}
          />
        </div>
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
        <button type="button" className="button secondary" disabled={busy} aria-expanded={showFinancialDetails} onClick={() => setShowFinancialDetails((current) => !current)}>{showFinancialDetails ? c.hideFinancialDetails : c.showFinancialDetails}</button>
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
