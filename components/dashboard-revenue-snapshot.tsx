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
      const { data: { user } } = await supabase.auth.getUser();
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
    return () => { cancelled = true; };
  }, [range]);

  const activeMetrics = range === 'month' ? metrics : rangeMetrics;
  const revenue = activeMetrics.revenueThisMonth || 0;
  const contractorPay = activeMetrics.contractorPayThisMonth || 0;
  const unpaidContractorPay = activeMetrics.unpaidContractorPay || 0;
  const pendingContractorPay = activeMetrics.pendingContractorPay || 0;
  const otherExpenses = activeMetrics.otherExpensesThisMonth || 0;
  const netProfit = activeMetrics.netEstimateThisMonth || 0;
  const hasRecordedCosts = contractorPay > 0 || otherExpenses > 0;
  const profitMargin = hasRecordedCosts && revenue > 0 ? (netProfit / revenue) * 100 : null;
  const comparisonBase = Math.max(revenue, contractorPay, otherExpenses, hasRecordedCosts ? Math.abs(netProfit) : 0, 1);
  const rangeLabel = RANGE_OPTIONS.find((option) => option.value === range)?.label || 'This month';

  const financialBreakdown: FinancialBreakdownItem[] = [
    { label: 'Client income', value: revenue, displayValue: formatCurrency(revenue), href: '/analytics' },
    { label: 'Contractor pay', value: contractorPay, displayValue: contractorPay > 0 ? formatCurrency(contractorPay) : 'Not entered', href: '/jobs' },
    { label: 'Other expenses', value: otherExpenses, displayValue: formatCurrency(otherExpenses), href: '/expenses' },
    { label: 'Gross profit', value: hasRecordedCosts ? netProfit : null, displayValue: hasRecordedCosts ? formatCurrency(netProfit) : 'Pending costs', href: '/analytics' }
  ];

  const items = [
    { label: `Revenue · ${rangeLabel}`, value: formatCurrency(revenue), href: '/analytics' },
    { label: `Contractor pay · ${rangeLabel}`, value: contractorPay > 0 ? formatCurrency(contractorPay) : 'Not entered', href: '/jobs' },
    { label: 'Unpaid contractor pay', value: formatCurrency(unpaidContractorPay), href: '/jobs' },
    { label: 'Pending contractor pay', value: formatCurrency(pendingContractorPay), href: '/jobs' },
    { label: `Other expenses · ${rangeLabel}`, value: formatCurrency(otherExpenses), href: '/expenses' },
    { label: `Gross profit · ${rangeLabel}`, value: hasRecordedCosts ? formatCurrency(netProfit) : 'Pending costs', href: '/analytics' },
    { label: 'Profit margin', value: profitMargin === null ? 'Pending contractor pay' : `${profitMargin.toFixed(1)}%`, href: '/analytics' },
    { label: t('dashboard.revenue.outstanding'), value: formatCurrency(activeMetrics.outstandingInvoices), href: '/invoices' },
    { label: t('dashboard.revenue.overdueInvoices'), value: String(activeMetrics.overdueInvoiceCount), href: '/invoices' },
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
          <p className="muted" style={{ margin: '6px 0 0' }}>All dashboard totals update with the selected period.</p>
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
                <h3>Income versus costs</h3>
                <p className="muted">Client income, contractor pay, other expenses, and gross profit for {rangeLabel.toLowerCase()}.</p>
              </div>
              <strong>{profitMargin === null ? 'Pending contractor pay' : `${profitMargin.toFixed(1)}% margin`}</strong>
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
              <Link key={item.label} href={item.href} className="dashboard-revenue-metric">
                <span className="dashboard-revenue-metric-label">{item.label}</span>
                <strong className="dashboard-revenue-metric-value">{item.value}</strong>
              </Link>
            ))}
          </div>
        </>
      ) : null}
    </section>
  );
}
