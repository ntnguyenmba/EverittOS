'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useTranslation } from '@/components/locale-provider';
import {
  fetchDashboardRevenueMetrics,
  formatCurrency,
  type DashboardDateRange,
  type DashboardRevenueMetrics
} from '@/lib/dashboard-metrics';
import { DASHBOARD_LINKS } from '@/lib/dashboard-links';
import { ensureOrganizationForUser } from '@/lib/workspace-client';
import { supabase } from '@/lib/supabase';

type DashboardRevenueSnapshotProps = {
  metrics: DashboardRevenueMetrics;
  todayJobs: number;
  loading?: boolean;
};

const DASHBOARD_RANGE_STORAGE_KEY = 'everittos-dashboard-range';
const VALID_RANGES: DashboardDateRange[] = ['today', 'week', 'month', 'year', 'all_time'];

const copy = {
  en: {
    period: 'Period', today: 'Today', week: 'This Week', month: 'This Month', year: 'This Year', allTime: 'All Time',
    collected: 'Collected', customerBalanceDue: 'Customer balance due', cashAfterPaidCosts: 'Cash after paid costs',
    jobsToday: "Today's Jobs", jobsWeek: 'Jobs This Week', jobsMonth: 'Jobs This Month', jobsYear: 'Jobs This Year', jobsAllTime: 'All-Time Jobs',
    jobsDesc: 'Non-cancelled jobs whose working date falls in the selected period.',
    financialDetails: 'Financial Details', contractorsPaid: 'Contractors paid', totalContractorCost: 'Total contractor cost',
    expectedRevenue: 'Expected revenue', expectedProfit: 'Expected profit', businessExpenses: 'Business expenses',
    collectedDesc: 'Customer payments received in this period.', currentBalances: 'All current customer balances.', periodBalances: 'Customer balances tied to this period.',
    cashDesc: 'Collected minus contractor payments paid and expenses paid.', contractorsPaidDesc: 'Contractor payments actually marked paid in this period.',
    contractorCostDesc: 'All contractor labor tied to this period, whether paid or still awaiting payment.',
    expectedRevenueDesc: 'Expected customer revenue for this period, including invoiced and direct job payment activity without double counting.',
    expectedProfitDesc: 'Expected revenue minus total contractor cost and business expenses.', expensesDesc: 'Non-contractor business expenses recorded in this period.',
    scheduledRevenue: 'Scheduled revenue',
    scheduledRevenueDesc: 'Expected client price on currently generated future visits only in the selected period. Not money already collected.',
    expectedContractorExpense: 'Expected contractor expense',
    expectedContractorExpenseDesc: 'Expected contractor pay on generated active visits in the selected period.',
    expectedAdditionalExpenses: 'Expected additional expenses',
    expectedAdditionalExpensesDesc: 'Expected non-labor expenses on generated active visits in the selected period.',
    scheduledExpectedProfit: 'Scheduled expected profit',
    scheduledExpectedProfitDesc: 'Scheduled revenue minus expected contractor pay and additional expenses.',
    recurringJobs: 'Recurring visits',
    recurringJobsDesc: 'Generated recurring occurrences in the selected period.',
    oneTimeJobs: 'One-time jobs',
    oneTimeJobsDesc: 'One-time jobs in the selected period.'
  },
  es: {
    period: 'Período', today: 'Hoy', week: 'Esta semana', month: 'Este mes', year: 'Este año', allTime: 'Todo el tiempo',
    collected: 'Cobrado', customerBalanceDue: 'Saldo pendiente del cliente', cashAfterPaidCosts: 'Efectivo después de costos pagados',
    jobsToday: 'Trabajos de hoy', jobsWeek: 'Trabajos de esta semana', jobsMonth: 'Trabajos de este mes', jobsYear: 'Trabajos de este año', jobsAllTime: 'Todos los trabajos',
    jobsDesc: 'Trabajos no cancelados cuya fecha de trabajo pertenece al período seleccionado.',
    financialDetails: 'Detalles financieros', contractorsPaid: 'Contratistas pagados', totalContractorCost: 'Costo total de contratistas',
    expectedRevenue: 'Ingresos esperados', expectedProfit: 'Ganancia esperada', businessExpenses: 'Gastos del negocio',
    collectedDesc: 'Pagos de clientes recibidos en este período.', currentBalances: 'Todos los saldos actuales de clientes.', periodBalances: 'Saldos de clientes relacionados con este período.',
    cashDesc: 'Cobrado menos pagos a contratistas y gastos pagados.', contractorsPaidDesc: 'Pagos a contratistas marcados como pagados en este período.',
    contractorCostDesc: 'Toda la mano de obra de contratistas asociada con este período, pagada o pendiente.',
    expectedRevenueDesc: 'Ingresos esperados de clientes para este período sin duplicar facturas ni pagos directos.',
    expectedProfitDesc: 'Ingresos esperados menos costo total de contratistas y gastos del negocio.', expensesDesc: 'Gastos del negocio no relacionados con contratistas registrados en este período.',
    scheduledRevenue: 'Ingresos programados',
    scheduledRevenueDesc: 'Precio esperado del cliente en visitas futuras generadas dentro del período seleccionado. No es dinero cobrado.',
    expectedContractorExpense: 'Gasto esperado de contratista',
    expectedContractorExpenseDesc: 'Pago esperado al contratista en visitas activas generadas del período.',
    expectedAdditionalExpenses: 'Gastos adicionales esperados',
    expectedAdditionalExpensesDesc: 'Gastos no laborales esperados en visitas activas generadas del período.',
    scheduledExpectedProfit: 'Ganancia esperada programada',
    scheduledExpectedProfitDesc: 'Ingresos programados menos pago esperado al contratista y gastos adicionales.',
    recurringJobs: 'Visitas recurrentes',
    recurringJobsDesc: 'Ocurrencias recurrentes generadas dentro del período seleccionado.',
    oneTimeJobs: 'Trabajos únicos',
    oneTimeJobsDesc: 'Trabajos únicos dentro del período seleccionado.'
  },
  vi: {
    period: 'Khoảng thời gian', today: 'Hôm nay', week: 'Tuần này', month: 'Tháng này', year: 'Năm nay', allTime: 'Tất cả thời gian',
    collected: 'Đã thu', customerBalanceDue: 'Số dư khách hàng còn nợ', cashAfterPaidCosts: 'Tiền mặt sau chi phí đã trả',
    jobsToday: 'Công việc hôm nay', jobsWeek: 'Công việc tuần này', jobsMonth: 'Công việc tháng này', jobsYear: 'Công việc năm nay', jobsAllTime: 'Tất cả công việc',
    jobsDesc: 'Các công việc chưa hủy có ngày thực hiện nằm trong khoảng thời gian đã chọn.',
    financialDetails: 'Chi tiết tài chính', contractorsPaid: 'Đã trả nhà thầu', totalContractorCost: 'Tổng chi phí nhà thầu',
    expectedRevenue: 'Doanh thu dự kiến', expectedProfit: 'Lợi nhuận dự kiến', businessExpenses: 'Chi phí kinh doanh',
    collectedDesc: 'Khoản thanh toán của khách hàng đã nhận trong khoảng thời gian này.', currentBalances: 'Tất cả số dư hiện tại của khách hàng.', periodBalances: 'Số dư khách hàng liên quan đến khoảng thời gian này.',
    cashDesc: 'Tiền đã thu trừ khoản đã trả cho nhà thầu và chi phí đã thanh toán.', contractorsPaidDesc: 'Khoản thanh toán cho nhà thầu đã được đánh dấu là đã trả trong khoảng thời gian này.',
    contractorCostDesc: 'Toàn bộ chi phí lao động nhà thầu trong khoảng thời gian này, dù đã trả hay đang chờ thanh toán.',
    expectedRevenueDesc: 'Doanh thu khách hàng dự kiến trong khoảng thời gian này, không tính trùng hóa đơn và thanh toán trực tiếp.',
    expectedProfitDesc: 'Doanh thu dự kiến trừ tổng chi phí nhà thầu và chi phí kinh doanh.', expensesDesc: 'Chi phí kinh doanh không phải nhà thầu được ghi nhận trong khoảng thời gian này.',
    scheduledRevenue: 'Doanh thu đã lên lịch',
    scheduledRevenueDesc: 'Giá khách dự kiến trên các lần ghé thăm tương lai đã tạo trong khoảng thời gian đã chọn. Không phải tiền đã thu.',
    expectedContractorExpense: 'Chi phí nhà thầu dự kiến',
    expectedContractorExpenseDesc: 'Tiền công nhà thầu dự kiến trên các lần ghé thăm đang hoạt động trong kỳ.',
    expectedAdditionalExpenses: 'Chi phí phát sinh dự kiến',
    expectedAdditionalExpensesDesc: 'Chi phí ngoài lao động dự kiến trên các lần ghé thăm đang hoạt động trong kỳ.',
    scheduledExpectedProfit: 'Lợi nhuận dự kiến đã lên lịch',
    scheduledExpectedProfitDesc: 'Doanh thu đã lên lịch trừ tiền công nhà thầu và chi phí phát sinh dự kiến.',
    recurringJobs: 'Lịch định kỳ',
    recurringJobsDesc: 'Các lần định kỳ đã tạo trong khoảng thời gian đã chọn.',
    oneTimeJobs: 'Công việc một lần',
    oneTimeJobsDesc: 'Công việc một lần trong khoảng thời gian đã chọn.'
  }
} as const;

type MetricItem = {
  label: string;
  value: string;
  href: string;
  description?: string;
};

export function DashboardRevenueSnapshot({ metrics, todayJobs, loading }: DashboardRevenueSnapshotProps) {
  const { locale } = useTranslation();
  const c = copy[locale];
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
      if (range === 'month') return;
      setRangeLoading(true);
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          if (!cancelled) setRangeLoading(false);
          return;
        }
        const org = await ensureOrganizationForUser(user.id);
        const next = await fetchDashboardRevenueMetrics(supabase, org?.organizationId || null, range);
        if (!cancelled) {
          setActiveMetrics(next);
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
  }, [range, loading]);

  const collected = activeMetrics.paidToYou ?? activeMetrics.cashCollected ?? 0;
  const outstanding = range === 'all_time' ? activeMetrics.stillOwed ?? 0 : activeMetrics.periodOutstanding ?? activeMetrics.stillOwed ?? 0;
  const cashAfterPaidCosts = activeMetrics.cashAfterPaidCosts ?? activeMetrics.cashAfterExpenses ?? activeMetrics.netCashFlow ?? 0;
  const contractorPaid = activeMetrics.contractorPaymentsPaid ?? 0;
  const contractorCost = activeMetrics.contractorPayThisMonth ?? 0;
  const recordedExpectedRevenue = activeMetrics.expectedRevenue ?? 0;
  const expectedRevenue = range === 'all_time' ? Math.max(recordedExpectedRevenue, collected + outstanding) : recordedExpectedRevenue;
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
    { label: c.businessExpenses, value: formatCurrency(expenses), href: DASHBOARD_LINKS.otherExpenses, description: c.expensesDesc },
    {
      label: c.scheduledRevenue,
      value: formatCurrency(activeMetrics.scheduledRevenue ?? 0),
      href: '/schedule',
      description: c.scheduledRevenueDesc
    },
    {
      label: c.expectedContractorExpense,
      value: formatCurrency(activeMetrics.scheduledExpectedContractorExpense ?? 0),
      href: '/schedule',
      description: c.expectedContractorExpenseDesc
    },
    {
      label: c.expectedAdditionalExpenses,
      value: formatCurrency(activeMetrics.scheduledExpectedAdditionalExpenses ?? 0),
      href: '/schedule',
      description: c.expectedAdditionalExpensesDesc
    },
    {
      label: c.scheduledExpectedProfit,
      value: formatCurrency(activeMetrics.scheduledExpectedProfit ?? 0),
      href: '/schedule',
      description: c.scheduledExpectedProfitDesc
    },
    {
      label: c.recurringJobs,
      value: String(activeMetrics.recurringOccurrenceCount ?? 0),
      href: '/schedule',
      description: c.recurringJobsDesc
    },
    {
      label: c.oneTimeJobs,
      value: String(activeMetrics.oneTimeJobCount ?? 0),
      href: '/jobs',
      description: c.oneTimeJobsDesc
    }
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
