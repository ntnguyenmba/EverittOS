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
    collected: 'Collected', balanceDue: 'Balance Due', cash: 'Cash', jobsToday: "Today's Jobs", jobsWeek: 'Jobs This Week',
    jobsMonth: 'Jobs This Month', jobsYear: 'Jobs This Year', jobsAllTime: 'All-Time Jobs',
    financialDetails: 'Financial Details', revenue: 'Revenue', costs: 'Costs', profit: 'Profit', priorities: "Today's Priorities",
    expectedRevenue: 'Expected Revenue', scheduledRevenue: 'Scheduled Revenue', contractorCost: 'Contractor Cost',
    contractorsPaid: 'Contractors Paid', expenses: 'Expenses', expectedProfit: 'Expected Profit', scheduledProfit: 'Scheduled Profit',
    scheduledLabor: 'Scheduled Labor', scheduledExpenses: 'Scheduled Expenses', recurringJobs: 'Recurring Jobs', oneTimeJobs: 'One-Time Jobs',
    unpaidInvoices: 'unpaid invoices', overdueInvoices: 'overdue invoices', recurringVisits: 'recurring visits scheduled', jobsInPeriod: 'jobs in this period',
    noUrgentItems: 'Nothing urgent needs attention.',
    collectedDesc: 'Customer payments received in this period.', balanceDesc: 'Customer balances tied to the selected period.',
    cashDesc: 'Collected minus paid contractor costs and paid expenses.', jobsDesc: 'Non-cancelled jobs in the selected period.',
    expectedRevenueDesc: 'Expected customer revenue without double counting.', scheduledRevenueDesc: 'Expected revenue from generated future visits.',
    contractorCostDesc: 'All contractor labor tied to this period.', contractorsPaidDesc: 'Contractor payments marked paid in this period.',
    expensesDesc: 'Non-contractor business expenses.', expectedProfitDesc: 'Expected revenue minus contractor cost and expenses.',
    scheduledProfitDesc: 'Scheduled revenue minus scheduled labor and expenses.', scheduledLaborDesc: 'Expected contractor pay on generated active visits.',
    scheduledExpensesDesc: 'Expected non-labor expenses on generated active visits.'
  },
  es: {
    period: 'Período', today: 'Hoy', week: 'Esta semana', month: 'Este mes', year: 'Este año', allTime: 'Todo el tiempo',
    collected: 'Cobrado', balanceDue: 'Saldo pendiente', cash: 'Efectivo', jobsToday: 'Trabajos de hoy', jobsWeek: 'Trabajos de esta semana',
    jobsMonth: 'Trabajos de este mes', jobsYear: 'Trabajos de este año', jobsAllTime: 'Todos los trabajos',
    financialDetails: 'Detalles financieros', revenue: 'Ingresos', costs: 'Costos', profit: 'Ganancia', priorities: 'Prioridades de hoy',
    expectedRevenue: 'Ingresos esperados', scheduledRevenue: 'Ingresos programados', contractorCost: 'Costo de contratistas',
    contractorsPaid: 'Contratistas pagados', expenses: 'Gastos', expectedProfit: 'Ganancia esperada', scheduledProfit: 'Ganancia programada',
    scheduledLabor: 'Mano de obra programada', scheduledExpenses: 'Gastos programados', recurringJobs: 'Trabajos recurrentes', oneTimeJobs: 'Trabajos únicos',
    unpaidInvoices: 'facturas sin pagar', overdueInvoices: 'facturas vencidas', recurringVisits: 'visitas recurrentes programadas', jobsInPeriod: 'trabajos en este período',
    noUrgentItems: 'Nada urgente necesita atención.',
    collectedDesc: 'Pagos de clientes recibidos en este período.', balanceDesc: 'Saldos de clientes relacionados con el período seleccionado.',
    cashDesc: 'Cobrado menos costos pagados a contratistas y gastos pagados.', jobsDesc: 'Trabajos no cancelados en el período seleccionado.',
    expectedRevenueDesc: 'Ingresos esperados sin duplicar pagos.', scheduledRevenueDesc: 'Ingresos esperados de visitas futuras generadas.',
    contractorCostDesc: 'Toda la mano de obra de contratistas del período.', contractorsPaidDesc: 'Pagos a contratistas marcados como pagados.',
    expensesDesc: 'Gastos del negocio no relacionados con contratistas.', expectedProfitDesc: 'Ingresos esperados menos costos y gastos.',
    scheduledProfitDesc: 'Ingresos programados menos mano de obra y gastos.', scheduledLaborDesc: 'Pago esperado a contratistas en visitas activas.',
    scheduledExpensesDesc: 'Gastos no laborales esperados en visitas activas.'
  },
  vi: {
    period: 'Khoảng thời gian', today: 'Hôm nay', week: 'Tuần này', month: 'Tháng này', year: 'Năm nay', allTime: 'Tất cả thời gian',
    collected: 'Đã thu', balanceDue: 'Số dư còn nợ', cash: 'Tiền mặt', jobsToday: 'Công việc hôm nay', jobsWeek: 'Công việc tuần này',
    jobsMonth: 'Công việc tháng này', jobsYear: 'Công việc năm nay', jobsAllTime: 'Tất cả công việc',
    financialDetails: 'Chi tiết tài chính', revenue: 'Doanh thu', costs: 'Chi phí', profit: 'Lợi nhuận', priorities: 'Ưu tiên hôm nay',
    expectedRevenue: 'Doanh thu dự kiến', scheduledRevenue: 'Doanh thu đã lên lịch', contractorCost: 'Chi phí nhà thầu',
    contractorsPaid: 'Đã trả nhà thầu', expenses: 'Chi phí', expectedProfit: 'Lợi nhuận dự kiến', scheduledProfit: 'Lợi nhuận đã lên lịch',
    scheduledLabor: 'Nhân công đã lên lịch', scheduledExpenses: 'Chi phí đã lên lịch', recurringJobs: 'Công việc định kỳ', oneTimeJobs: 'Công việc một lần',
    unpaidInvoices: 'hóa đơn chưa thanh toán', overdueInvoices: 'hóa đơn quá hạn', recurringVisits: 'lịch định kỳ sắp tới', jobsInPeriod: 'công việc trong kỳ này',
    noUrgentItems: 'Không có việc khẩn cấp cần chú ý.',
    collectedDesc: 'Khoản thanh toán của khách hàng đã nhận trong kỳ.', balanceDesc: 'Số dư khách hàng trong khoảng thời gian đã chọn.',
    cashDesc: 'Tiền đã thu trừ chi phí nhà thầu và chi phí đã trả.', jobsDesc: 'Công việc chưa hủy trong khoảng thời gian đã chọn.',
    expectedRevenueDesc: 'Doanh thu dự kiến không tính trùng.', scheduledRevenueDesc: 'Doanh thu dự kiến từ các lần ghé thăm tương lai.',
    contractorCostDesc: 'Toàn bộ chi phí lao động nhà thầu trong kỳ.', contractorsPaidDesc: 'Khoản trả nhà thầu đã được đánh dấu đã trả.',
    expensesDesc: 'Chi phí kinh doanh không phải nhà thầu.', expectedProfitDesc: 'Doanh thu dự kiến trừ chi phí và tiền công.',
    scheduledProfitDesc: 'Doanh thu đã lên lịch trừ nhân công và chi phí.', scheduledLaborDesc: 'Tiền công nhà thầu dự kiến trên các lần ghé thăm đang hoạt động.',
    scheduledExpensesDesc: 'Chi phí ngoài lao động dự kiến trên các lần ghé thăm đang hoạt động.'
  }
} as const;

type MetricItem = {
  label: string;
  value: string;
  href: string;
  description: string;
  tone?: 'default' | 'positive' | 'warning' | 'attention';
};

type MetricGroup = {
  title: string;
  items: MetricItem[];
};

function MetricCard({ item, busy, primary = false }: { item: MetricItem; busy: boolean; primary?: boolean }) {
  return (
    <Link
      href={item.href}
      title={item.description}
      aria-label={`${item.label}: ${item.value}. ${item.description}`}
      className={`dashboard-revenue-metric${primary ? ' is-primary' : ''} dashboard-metric-tone-${item.tone || 'default'}`}
      style={{ minHeight: primary ? 116 : 82, pointerEvents: busy ? 'none' : 'auto' }}
    >
      <span className="dashboard-revenue-metric-label">
        {item.label}
        <span aria-hidden="true" title={item.description} style={{ marginLeft: 6, opacity: 0.55 }}>?</span>
      </span>
      <strong className="dashboard-revenue-metric-value">{item.value}</strong>
    </Link>
  );
}

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
  const outstanding = range === 'all_time'
    ? activeMetrics.stillOwed ?? 0
    : activeMetrics.periodOutstanding ?? activeMetrics.stillOwed ?? 0;
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

  const jobsLabel = range === 'today'
    ? c.jobsToday
    : range === 'week'
      ? c.jobsWeek
      : range === 'month'
        ? c.jobsMonth
        : range === 'year'
          ? c.jobsYear
          : c.jobsAllTime;

  const primaryItems: MetricItem[] = [
    { label: c.collected, value: formatCurrency(collected), href: DASHBOARD_LINKS.paidToYou, description: c.collectedDesc, tone: 'positive' },
    { label: c.balanceDue, value: formatCurrency(outstanding), href: DASHBOARD_LINKS.stillOwed, description: c.balanceDesc, tone: outstanding > 0 ? 'warning' : 'default' },
    { label: c.cash, value: formatCurrency(cashAfterPaidCosts), href: DASHBOARD_LINKS.cashAfterExpenses, description: c.cashDesc, tone: cashAfterPaidCosts >= 0 ? 'positive' : 'attention' },
    { label: jobsLabel, value: String(selectedJobs), href: '/jobs', description: c.jobsDesc, tone: selectedJobs === 0 ? 'attention' : 'default' }
  ];

  const financialGroups: MetricGroup[] = [
    {
      title: c.revenue,
      items: [
        { label: c.expectedRevenue, value: formatCurrency(expectedRevenue), href: DASHBOARD_LINKS.estimatedProfit, description: c.expectedRevenueDesc },
        { label: c.scheduledRevenue, value: formatCurrency(activeMetrics.scheduledRevenue ?? 0), href: '/schedule', description: c.scheduledRevenueDesc }
      ]
    },
    {
      title: c.costs,
      items: [
        { label: c.contractorCost, value: formatCurrency(contractorCost), href: DASHBOARD_LINKS.contractorPay, description: c.contractorCostDesc },
        { label: c.contractorsPaid, value: formatCurrency(contractorPaid), href: DASHBOARD_LINKS.contractorPay, description: c.contractorsPaidDesc },
        { label: c.expenses, value: formatCurrency(expenses), href: DASHBOARD_LINKS.otherExpenses, description: c.expensesDesc },
        { label: c.scheduledLabor, value: formatCurrency(activeMetrics.scheduledExpectedContractorExpense ?? 0), href: '/schedule', description: c.scheduledLaborDesc },
        { label: c.scheduledExpenses, value: formatCurrency(activeMetrics.scheduledExpectedAdditionalExpenses ?? 0), href: '/schedule', description: c.scheduledExpensesDesc }
      ]
    },
    {
      title: c.profit,
      items: [
        { label: c.expectedProfit, value: formatCurrency(expectedProfit), href: DASHBOARD_LINKS.estimatedProfit, description: c.expectedProfitDesc, tone: expectedProfit >= 0 ? 'positive' : 'attention' },
        { label: c.scheduledProfit, value: formatCurrency(activeMetrics.scheduledExpectedProfit ?? 0), href: '/schedule', description: c.scheduledProfitDesc, tone: (activeMetrics.scheduledExpectedProfit ?? 0) >= 0 ? 'positive' : 'attention' }
      ]
    }
  ];

  const priorities = [
    activeMetrics.overdueInvoiceCount ? { value: activeMetrics.overdueInvoiceCount, label: c.overdueInvoices, href: '/invoices' } : null,
    activeMetrics.outstandingInvoiceCount ? { value: activeMetrics.outstandingInvoiceCount, label: c.unpaidInvoices, href: '/invoices' } : null,
    activeMetrics.recurringOccurrenceCount ? { value: activeMetrics.recurringOccurrenceCount, label: c.recurringVisits, href: '/schedule' } : null,
    selectedJobs ? { value: selectedJobs, label: c.jobsInPeriod, href: '/jobs' } : null
  ].filter(Boolean) as Array<{ value: number; label: string; href: string }>;

  return (
    <section aria-label="Dashboard" aria-busy={busy}>
      <div className="dashboard-period-pills" role="group" aria-label={c.period}>
        {rangeOptions.map((option) => (
          <button
            key={option.id}
            type="button"
            className={range === option.id ? 'active' : undefined}
            disabled={busy}
            aria-pressed={range === option.id}
            onClick={() => setRange(option.id)}
          >
            {option.label}
          </button>
        ))}
      </div>

      <div className="dashboard-revenue-grid dashboard-primary-grid" style={{ opacity: busy ? 0.58 : 1 }}>
        {primaryItems.map((item) => <MetricCard key={item.label} item={item} busy={busy} primary />)}
      </div>

      <section className="dashboard-priorities" aria-labelledby="dashboard-priorities-title">
        <div className="dashboard-section-heading">
          <div>
            <span className="dashboard-section-kicker">Operations</span>
            <h3 id="dashboard-priorities-title">{c.priorities}</h3>
          </div>
        </div>
        {priorities.length ? (
          <div className="dashboard-priority-list">
            {priorities.map((item) => (
              <Link key={`${item.label}-${item.value}`} href={item.href} className="dashboard-priority-row">
                <strong>{item.value}</strong>
                <span>{item.label}</span>
                <span aria-hidden="true">→</span>
              </Link>
            ))}
          </div>
        ) : (
          <p className="muted" style={{ margin: 0 }}>{c.noUrgentItems}</p>
        )}
      </section>

      <div style={{ marginTop: 18 }}>
        <button
          type="button"
          className="button secondary"
          disabled={busy}
          aria-expanded={showFinancialDetails}
          onClick={() => setShowFinancialDetails((current) => !current)}
        >
          {c.financialDetails}
        </button>
      </div>

      {showFinancialDetails ? (
        <div className="dashboard-financial-groups" style={{ opacity: busy ? 0.58 : 1 }}>
          {financialGroups.map((group) => (
            <section key={group.title} className="dashboard-financial-group" aria-label={group.title}>
              <h3>{group.title}</h3>
              <div className="dashboard-financial-list">
                {group.items.map((item) => <MetricCard key={item.label} item={item} busy={busy} />)}
              </div>
            </section>
          ))}
          <section className="dashboard-financial-group" aria-label="Business snapshot">
            <h3>Business Snapshot</h3>
            <div className="dashboard-financial-list">
              <MetricCard item={{ label: c.recurringJobs, value: String(activeMetrics.recurringOccurrenceCount ?? 0), href: '/schedule', description: c.recurringVisits }} busy={busy} />
              <MetricCard item={{ label: c.oneTimeJobs, value: String(activeMetrics.oneTimeJobCount ?? 0), href: '/jobs', description: c.jobsInPeriod }} busy={busy} />
            </div>
          </section>
        </div>
      ) : null}

      <style jsx global>{`
        .dashboard-period-pills {
          display: flex;
          width: fit-content;
          max-width: 100%;
          margin: 0 0 16px auto;
          padding: 4px;
          gap: 3px;
          overflow-x: auto;
          border: 1px solid rgba(43, 54, 62, 0.12);
          border-radius: 999px;
          background: rgba(255,255,255,0.68);
          backdrop-filter: blur(10px);
        }
        .dashboard-period-pills button {
          min-height: 34px;
          padding: 6px 13px;
          border: 0;
          border-radius: 999px;
          background: transparent;
          color: var(--text-secondary);
          font-size: 13px;
          font-weight: 600;
          white-space: nowrap;
          cursor: pointer;
        }
        .dashboard-period-pills button.active {
          background: var(--navy-primary);
          color: var(--text-on-dark);
          box-shadow: 0 3px 12px rgba(35, 48, 61, 0.16);
        }
        .dashboard-primary-grid .dashboard-revenue-metric-value {
          font-size: clamp(30px, 4vw, 42px);
        }
        .dashboard-revenue-metric {
          position: relative;
          overflow: hidden;
        }
        .dashboard-revenue-metric::before {
          content: '';
          position: absolute;
          inset: 0 auto 0 0;
          width: 3px;
          background: transparent;
        }
        .dashboard-metric-tone-positive::before { background: rgba(74, 99, 84, 0.72); }
        .dashboard-metric-tone-warning::before { background: rgba(151, 112, 52, 0.72); }
        .dashboard-metric-tone-attention::before { background: rgba(143, 72, 63, 0.72); }
        .dashboard-priorities {
          margin-top: 18px;
          padding: 20px;
          border: 1px solid rgba(43, 54, 62, 0.12);
          border-radius: 18px;
          background: rgba(255,255,255,0.78);
          backdrop-filter: blur(10px);
        }
        .dashboard-section-heading h3,
        .dashboard-financial-group h3 {
          margin: 0;
          font-family: var(--font-display, Georgia, serif);
          font-size: 22px;
          font-weight: 500;
        }
        .dashboard-section-kicker {
          display: block;
          margin-bottom: 3px;
          color: var(--text-secondary);
          font-size: 11px;
          font-weight: 700;
          letter-spacing: 0.14em;
          text-transform: uppercase;
        }
        .dashboard-priority-list {
          display: grid;
          margin-top: 14px;
          border-top: 1px solid var(--line);
        }
        .dashboard-priority-row {
          display: grid;
          grid-template-columns: auto 1fr auto;
          align-items: center;
          gap: 12px;
          min-height: 48px;
          border-bottom: 1px solid var(--line);
        }
        .dashboard-priority-row strong {
          min-width: 34px;
          font-size: 20px;
          color: var(--text);
        }
        .dashboard-priority-row span:last-child { color: var(--muted); }
        .dashboard-financial-groups {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 14px;
          margin-top: 14px;
        }
        .dashboard-financial-group {
          padding: 16px;
          border: 1px solid rgba(43, 54, 62, 0.12);
          border-radius: 16px;
          background: rgba(255,255,255,0.72);
          backdrop-filter: blur(10px);
        }
        .dashboard-financial-list {
          display: grid;
          gap: 8px;
          margin-top: 12px;
        }
        .dashboard-financial-list .dashboard-revenue-metric {
          min-height: 76px !important;
          padding: 13px 14px;
          box-shadow: none;
          background: rgba(255,255,255,0.68);
        }
        .dashboard-financial-list .dashboard-revenue-metric-value {
          font-size: 25px;
        }
        @media (max-width: 900px) {
          .dashboard-financial-groups { grid-template-columns: 1fr 1fr; }
        }
        @media (max-width: 620px) {
          .dashboard-period-pills {
            width: 100%;
            margin-left: 0;
          }
          .dashboard-period-pills button { flex: 1 0 auto; }
          .dashboard-financial-groups { grid-template-columns: 1fr; }
          .dashboard-priorities { padding: 16px; }
        }
      `}</style>
    </section>
  );
}
