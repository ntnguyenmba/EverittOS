'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useTranslation } from '@/components/locale-provider';
import { fetchDashboardRevenueMetrics, formatCurrency, type DashboardDateRange, type DashboardRevenueMetrics } from '@/lib/dashboard-metrics';
import { ensureOrganizationForUser } from '@/lib/workspace-client';
import { supabase } from '@/lib/supabase';

type DashboardRevenueSnapshotProps = {
  metrics: DashboardRevenueMetrics;
  loading?: boolean;
};

type FinancialBreakdownItem = {
  label: string;
  value: number | null;
  displayValue: string;
  href: string;
};

type MetricItem = {
  label: string;
  value: string;
  href: string;
  help?: string;
};

const RANGE_OPTIONS: { value: DashboardDateRange; label: string }[] = [
  { value: 'month', label: 'This month' },
  { value: 'quarter', label: 'This quarter' },
  { value: 'year', label: 'This year' },
  { value: 'last_year', label: 'Last year' },
  { value: 'all_time', label: 'All time' }
];

export function DashboardRevenueSnapshot({ metrics, loading }: DashboardRevenueSnapshotProps) {
  const { t } = useTranslation();
  const [range, setRange] = useState<DashboardDateRange>('month');
  const [rangeMetrics, setRangeMetrics] = useState(metrics);
  const [rangeLoading, setRangeLoading] = useState(false);

  useEffect(() => {
    if (range === 'month') setRangeMetrics(metrics);
  }, [metrics, range]);

  useEffect(() => {
    if (range === 'month') return;
    let cancelled = false;

    async function loadRange() {
      setRangeLoading(true);
      const {
        data: { user }
      } = await supabase.auth.getUser();

      if (!user) {
        if (!cancelled) setRangeLoading(false);
        return;
      }

      const org = await ensureOrganizationForUser(user.id);
      const next = await fetchDashboardRevenueMetrics(supabase, org?.organizationId || null, range);

      if (!cancelled) {
        setRangeMetrics(next);
        setRangeLoading(false);
      }
    }

    void loadRange();
    return () => {
      cancelled = true;
    };
  }, [range]);

  const activeMetrics = range === 'month' ? metrics : rangeMetrics;
  const cashCollected = activeMetrics.cashCollected ?? activeMetrics.revenueThisMonth ?? 0;
  const bookedRevenue = activeMetrics.bookedRevenue ?? 0;
  const pendingIncoming = activeMetrics.pendingIncoming ?? activeMetrics.outstandingInvoices ?? 0;
  const overdueAmount = activeMetrics.overdueAmount ?? 0;
  const contractorPay = activeMetrics.contractorPayThisMonth || 0;
  const unpaidContractorPay = activeMetrics.unpaidContractorPay || 0;
  const pendingContractorPay = activeMetrics.pendingContractorPay || 0;
  const otherExpenses = activeMetrics.otherExpensesThisMonth || 0;
  const grossProfit = activeMetrics.netEstimateThisMonth || 0;
  const netCashFlow = activeMetrics.netCashFlow ?? (cashCollected - contractorPay - otherExpenses);
  const hasRecordedCosts = contractorPay > 0 || otherExpenses > 0;
  const profitMargin = hasRecordedCosts && bookedRevenue > 0 ? (grossProfit / bookedRevenue) * 100 : null;
  const comparisonBase = Math.max(cashCollected, bookedRevenue, pendingIncoming, contractorPay, otherExpenses, Math.abs(netCashFlow), 1);
  const rangeLabel = RANGE_OPTIONS.find((option) => option.value === range)?.label || 'This month';

  const financialBreakdown: FinancialBreakdownItem[] = [
    { label: 'Cash collected', value: cashCollected, displayValue: formatCurrency(cashCollected), href: '/analytics' },
    { label: 'Booked revenue', value: bookedRevenue, displayValue: formatCurrency(bookedRevenue), href: '/invoices' },
    { label: 'Pending incoming', value: pendingIncoming, displayValue: formatCurrency(pendingIncoming), href: '/invoices' },
    { label: 'Net cash flow', value: netCashFlow, displayValue: formatCurrency(netCashFlow), href: '/analytics' }
  ];

  const items: MetricItem[] = [
    { label: `Cash collected · ${rangeLabel}`, value: formatCurrency(cashCollected), href: '/analytics', help: 'Payments actually received during the selected period, based on the payment date.' },
    { label: `Booked revenue · ${rangeLabel}`, value: formatCurrency(bookedRevenue), href: '/invoices', help: 'Invoice value booked during the selected period, plus completed job revenue that has not been invoiced.' },
    { label: 'Pending incoming', value: formatCurrency(pendingIncoming), href: '/invoices', help: 'Current unpaid and partially paid customer invoice balances.' },
    { label: 'Overdue amount', value: formatCurrency(overdueAmount), href: '/invoices', help: 'Current unpaid balances whose due date has passed.' },
    { label: 'Overdue invoices', value: String(activeMetrics.overdueInvoiceCount), href: '/invoices' },
    { label: 'Outstanding invoices', value: String(activeMetrics.outstandingInvoiceCount ?? 0), href: '/invoices' },
    { label: 'Average days to payment', value: activeMetrics.averageDaysToPayment === null || activeMetrics.averageDaysToPayment === undefined ? 'Not enough data' : `${activeMetrics.averageDaysToPayment} days`, href: '/invoices', help: 'Average number of days from invoice date to recorded payment date for payments in the selected period.' },
    { label: `Contractor cost · ${rangeLabel}`, value: contractorPay > 0 ? formatCurrency(contractorPay) : 'Not entered', href: '/contractor-pay?status=all', help: 'Contractor labor recorded during the selected period, whether paid or still owed.' },
    { label: 'Contractor pay owed', value: formatCurrency(unpaidContractorPay), href: '/contractor-pay?status=unpaid' },
    { label: 'Contractor pay pending', value: formatCurrency(pendingContractorPay), href: '/contractor-pay?status=pending' },
    { label: `Other expenses · ${rangeLabel}`, value: formatCurrency(otherExpenses), href: '/expenses' },
    { label: `Gross profit · ${rangeLabel}`, value: hasRecordedCosts ? formatCurrency(grossProfit) : 'Pending costs', href: '/analytics', help: 'Booked revenue minus contractor costs and other expenses for the selected period.' },
    { label: `Net cash flow · ${rangeLabel}`, value: formatCurrency(netCashFlow), href: '/analytics', help: 'Cash collected minus contractor costs and other expenses for the selected period.' },
    { label: 'Profit margin', value: profitMargin === null ? 'Pending costs' : `${profitMargin.toFixed(1)}%`, href: '/analytics' },
    { label: `Jobs completed · ${rangeLabel}`, value: String(activeMetrics.jobsCompletedThisMonth), href: '/jobs?status=completed' },
    { label: `Jobs · ${rangeLabel}`, value: String(activeMetrics.totalJobs), href: '/jobs' },
    { label: t('dashboard.revenue.upcomingJobs'), value: String(activeMetrics.upcomingJobs), href: '/schedule' },
    { label: t('dashboard.revenue.activeCustomers'), value: String(activeMetrics.activeCustomers), href: '/customers' },
    { label: `Bookings · ${rangeLabel}`, value: String(activeMetrics.bookingCountThisMonth), href: '/bookings' },
    { label: `Messages · ${rangeLabel}`, value: String(activeMetrics.messageCount), href: '/messages' },
    { label: `Reports · ${rangeLabel}`, value: String(activeMetrics.reportCount), href: '/jobs' }
  ];

  const isLoading = Boolean(loading || rangeLoading);

  return (
    <section className="card dashboard-today-card" aria-label={t('dashboard.revenue.title')}>
      <div className="dashboard-section-head" style={{ alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <div>
          <h2>{t('dashboard.revenue.title')}</h2>
          <p className="muted" style={{ margin: '6px 0 0' }}>Cash uses payment dates, booked revenue uses invoice or completed-job dates, and pending balances show what is owed now.</p>
        </div>
        <div className="inline-actions" style={{ marginLeft: 'auto' }}>
          <label className="sr-only" htmlFor="dashboard-date-range">Dashboard period</label>
          <select id="dashboard-date-range" className="input" value={range} onChange={(event) => setRange(event.target.value as DashboardDateRange)} style={{ width: 'auto', minWidth: 150 }}>
            {RANGE_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
          </select>
          <Link href="/analytics" className="dashboard-section-link">{t('dashboard.revenue.viewAnalytics')}</Link>
        </div>
      </div>

      {isLoading ? <p className="loading-state" role="status">{t('common.loading')}</p> : null}

      {!isLoading ? (
        <>
          <div className="settings-card" style={{ marginBottom: 18 }}>
            <div className="job-financials-head">
              <div>
                <h3>Revenue and cash position</h3>
                <p className="muted">Collected cash, booked work, pending customer payments, and net cash flow for {rangeLabel.toLowerCase()}.</p>
              </div>
              <strong>{profitMargin === null ? 'Pending costs' : `${profitMargin.toFixed(1)}% margin`}</strong>
            </div>
            <div style={{ display: 'grid', gap: 14 }}>
              {financialBreakdown.map((item) => {
                const width = item.value === null ? 0 : Math.max(0, Math.min(100, (Math.abs(item.value) / comparisonBase) * 100));
                return (
                  <Link key={item.label} href={item.href} style={{ color: 'inherit', textDecoration: 'none' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, marginBottom: 6 }}>
                      <span>{item.label}</span>
                      <strong>{item.displayValue}</strong>
                    </div>
                    <div aria-hidden="true" style={{ background: 'var(--surface-subtle, rgba(127, 127, 127, 0.14))', borderRadius: 999, height: 10, overflow: 'hidden' }}>
                      <div style={{ background: item.value !== null && item.value < 0 ? 'var(--danger, currentColor)' : 'var(--accent, currentColor)', borderRadius: 999, height: '100%', minWidth: item.value === null || item.value === 0 ? 0 : 4, width: `${width}%` }} />
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>

          <div className="dashboard-revenue-grid">
            {items.map((item) => (
              <Link key={item.label} href={item.href} className="dashboard-revenue-metric" title={item.help} aria-label={item.help ? `${item.label}. ${item.help}` : item.label}>
                <span className="dashboard-revenue-metric-label">{item.label}</span>
                <strong className="dashboard-revenue-metric-value">{item.value}</strong>
                {item.help ? <span className="muted" style={{ fontSize: 12, lineHeight: 1.4 }}>{item.help}</span> : null}
              </Link>
            ))}
          </div>
        </>
      ) : null}
    </section>
  );
}
