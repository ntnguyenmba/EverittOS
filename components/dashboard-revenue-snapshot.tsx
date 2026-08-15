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
import { fetchOrganizationContext } from '@/lib/organization';
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
    collected: 'Money received', customerBalanceDue: 'Still owed', cashAfterPaidCosts: 'Cash after paid costs',
    jobsToday: 'Jobs today', jobsWeek: 'Jobs this week', jobsMonth: 'Jobs this month', jobsYear: 'Jobs this year', jobsAllTime: 'All jobs',
    jobsDesc: 'Jobs scheduled in this period.', showFinancialDetails: 'Show more money details', hideFinancialDetails: 'Hide money details', contractorsPaid: 'Contractors paid',
    totalContractorCost: 'Job contractor costs', expectedRevenue: 'Scheduled job revenue', expectedProfit: 'Job profit', businessExpenses: 'Business expenses',
    collectedDesc: 'Customer payments received in this period.', currentBalances: 'Current unpaid customer balances.', periodBalances: 'Customer balances tied to work in this period.',
    cashDesc: 'Money received minus contractor payments and business expenses already paid.', contractorsPaidDesc: 'Contractor payments actually paid in this period.',
    contractorCostDesc: 'Contractor cost tied to jobs in this period, whether paid yet or not.', expectedRevenueDesc: 'Customer revenue tied to jobs scheduled in this period.',
    expectedProfitDesc: 'Scheduled job revenue minus job contractor costs and business expenses for this period.', expensesDesc: 'Business expenses recorded in this period.'
  },
  es: {
    dashboard: 'Resumen de dinero',
    period: 'Período', today: 'Hoy', week: 'Esta semana', month: 'Este mes', year: 'Este año', allTime: 'Todo el tiempo',
    collected: 'Dinero recibido', customerBalanceDue: 'Aún pendiente', cashAfterPaidCosts: 'Efectivo después de costos pagados',
    jobsToday: 'Trabajos de hoy', jobsWeek: 'Trabajos de esta semana', jobsMonth: 'Trabajos de este mes', jobsYear: 'Trabajos de este año', jobsAllTime: 'Todos los trabajos',
    jobsDesc: 'Trabajos programados en este período.', showFinancialDetails: 'Mostrar más detalles de dinero', hideFinancialDetails: 'Ocultar detalles de dinero', contractorsPaid: 'Contratistas pagados',
    totalContractorCost: 'Costos de contratistas por trabajo', expectedRevenue: 'Ingresos de trabajos programados', expectedProfit: 'Ganancia de trabajos', businessExpenses: 'Gastos del negocio',
    collectedDesc: 'Pagos de clientes recibidos en este período.', currentBalances: 'Saldos actuales pendientes de clientes.', periodBalances: 'Saldos de clientes vinculados al trabajo de este período.',
    cashDesc: 'Dinero recibido menos pagos a contratistas y gastos del negocio ya pagados.', contractorsPaidDesc: 'Pagos a contratistas realmente pagados en este período.',
    contractorCostDesc: 'Costo de contratistas vinculado a trabajos de este período, esté pagado o no.', expectedRevenueDesc: 'Ingresos de clientes vinculados a trabajos programados en este período.',
    expectedProfitDesc: 'Ingresos de trabajos menos costos de contratistas y gastos del negocio de este período.', expensesDesc: 'Gastos del negocio registrados en este período.'
  },
  vi: {
    dashboard: 'Tổng quan tiền',
    period: 'Khoảng thời gian', today: 'Hôm nay', week: 'Tuần này', month: 'Tháng này', year: 'Năm nay', allTime: 'Tất cả thời gian',
    collected: 'Tiền đã nhận', customerBalanceDue: 'Còn phải thu', cashAfterPaidCosts: 'Tiền mặt sau chi phí đã trả',
    jobsToday: 'Công việc hôm nay', jobsWeek: 'Công việc tuần này', jobsMonth: 'Công việc tháng này', jobsYear: 'Công việc năm nay', jobsAllTime: 'Tất cả công việc',
    jobsDesc: 'Công việc được lên lịch trong khoảng thời gian này.', showFinancialDetails: 'Hiện thêm chi tiết tiền', hideFinancialDetails: 'Ẩn chi tiết tiền', contractorsPaid: 'Đã trả nhà thầu',
    totalContractorCost: 'Chi phí nhà thầu theo công việc', expectedRevenue: 'Doanh thu công việc đã lên lịch', expectedProfit: 'Lợi nhuận công việc', businessExpenses: 'Chi phí kinh doanh',
    collectedDesc: 'Các khoản thanh toán từ khách đã nhận trong khoảng thời gian này.', currentBalances: 'Số dư khách hàng hiện còn nợ.', periodBalances: 'Số dư khách hàng gắn với công việc trong khoảng thời gian này.',
    cashDesc: 'Tiền đã nhận trừ các khoản đã trả cho nhà thầu và chi phí kinh doanh.', contractorsPaidDesc: 'Khoản thanh toán nhà thầu đã thực sự trả trong khoảng thời gian này.',
    contractorCostDesc: 'Chi phí nhà thầu gắn với công việc trong khoảng thời gian này, dù đã trả hay chưa.', expectedRevenueDesc: 'Doanh thu khách hàng gắn với công việc được lên lịch trong khoảng thời gian này.',
    expectedProfitDesc: 'Doanh thu công việc trừ chi phí nhà thầu và chi phí kinh doanh trong khoảng thời gian này.', expensesDesc: 'Chi phí kinh doanh được ghi nhận trong khoảng thời gian này.'
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
        // Period changes must not use the short 800ms workspace helper timeout.
        // A transient timeout there returns null, and the finance engine correctly
        // returns an all-zero snapshot for a missing organization id.
        const org = await fetchOrganizationContext(user.id);
        if (!org?.organizationId) {
          // Keep the last known-good metrics instead of replacing real data with zeros.
          return;
        }
        const next = await fetchDashboardRevenueMetrics(supabase, org.organizationId, range);
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
          <Link key={item.label} href={item.href} target="_blank" rel="noopener noreferrer" className="dashboard-revenue-metric is-primary" style={{ minHeight: 120, pointerEvents: busy ? 'none' : 'auto' }}>
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
            <Link key={item.label} href={item.href} target="_blank" rel="noopener noreferrer" className="dashboard-revenue-metric" style={{ minHeight: 100, pointerEvents: busy ? 'none' : 'auto' }}>
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
