'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
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

const RANGE_OPTIONS: Array<{ id: DashboardDateRange; label: string }> = [
  { id: 'today', label: 'Today' },
  { id: 'week', label: 'This Week' },
  { id: 'month', label: 'This Month' },
  { id: 'year', label: 'This Year' },
  { id: 'all_time', label: 'All Time' }
];

type MetricItem = {
  label: string;
  value: string;
  href: string;
};

export function DashboardRevenueSnapshot({ metrics, todayJobs, loading }: DashboardRevenueSnapshotProps) {
  const [range, setRange] = useState<DashboardDateRange>('month');
  const [activeMetrics, setActiveMetrics] = useState(metrics);
  const [rangeLoading, setRangeLoading] = useState(false);
  const [showFinancialDetails, setShowFinancialDetails] = useState(false);

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
  const outstanding =
    range === 'all_time'
      ? activeMetrics.stillOwed ?? 0
      : activeMetrics.periodOutstanding ?? activeMetrics.stillOwed ?? 0;
  const available =
    activeMetrics.cashAfterPaidCosts ?? activeMetrics.cashAfterExpenses ?? activeMetrics.netCashFlow ?? 0;
  const contractorPaid = activeMetrics.contractorPaymentsPaid || 0;
  const contractorsOwed =
    range === 'all_time'
      ? activeMetrics.unpaidContractorPay || 0
      : activeMetrics.periodUnpaidContractorPay || activeMetrics.unpaidContractorPay || 0;
  const unbilled = activeMetrics.uninvoicedCompletedWork ?? 0;
  const expectedRevenue = activeMetrics.expectedRevenue ?? 0;
  const expectedProfit = activeMetrics.estimatedProfit ?? activeMetrics.netEstimateThisMonth ?? 0;
  const expenses = activeMetrics.otherExpensesThisMonth || 0;
  const busy = Boolean(loading || rangeLoading);

  const primaryItems: MetricItem[] = [
    { label: 'Collected', value: formatCurrency(collected), href: DASHBOARD_LINKS.paidToYou },
    { label: 'Outstanding', value: formatCurrency(outstanding), href: DASHBOARD_LINKS.stillOwed },
    { label: 'Available', value: formatCurrency(available), href: DASHBOARD_LINKS.cashAfterExpenses },
    { label: "Today's Jobs", value: String(todayJobs), href: '/schedule' }
  ];

  const detailItems: MetricItem[] = [
    { label: 'Paid to Contractors', value: formatCurrency(contractorPaid), href: DASHBOARD_LINKS.contractorPay },
    { label: 'Contractors Owed', value: formatCurrency(contractorsOwed), href: DASHBOARD_LINKS.contractorPayOwed },
    { label: 'Unbilled Revenue', value: formatCurrency(unbilled), href: DASHBOARD_LINKS.completedJobs },
    { label: 'Expected Revenue', value: formatCurrency(expectedRevenue), href: DASHBOARD_LINKS.estimatedProfit },
    { label: 'Expected Profit', value: formatCurrency(expectedProfit), href: DASHBOARD_LINKS.estimatedProfit },
    { label: 'Expenses', value: formatCurrency(expenses), href: DASHBOARD_LINKS.otherExpenses }
  ];

  return (
    <section aria-label="Dashboard" aria-busy={busy}>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 14 }}>
        <label className="sr-only" htmlFor="dashboard-period">
          Period
        </label>
        <select
          id="dashboard-period"
          className="input"
          value={range}
          disabled={busy}
          onChange={(event) => setRange(event.target.value as DashboardDateRange)}
          style={{ width: 'auto', minWidth: 140 }}
        >
          {RANGE_OPTIONS.map((option) => (
            <option key={option.id} value={option.id}>
              {option.label}
            </option>
          ))}
        </select>
      </div>

      <div className="dashboard-revenue-grid" style={{ opacity: busy ? 0.58 : 1 }}>
        {primaryItems.map((item) => (
          <Link
            key={item.label}
            href={item.href}
            className="dashboard-revenue-metric is-primary"
            style={{ minHeight: 120, pointerEvents: busy ? 'none' : 'auto' }}
          >
            <span className="dashboard-revenue-metric-label">{item.label}</span>
            <strong className="dashboard-revenue-metric-value">{item.value}</strong>
          </Link>
        ))}
      </div>

      <div style={{ marginTop: 18 }}>
        <button
          type="button"
          className="button secondary"
          disabled={busy}
          aria-expanded={showFinancialDetails}
          onClick={() => setShowFinancialDetails((current) => !current)}
        >
          Financial Details
        </button>
      </div>

      {showFinancialDetails ? (
        <div className="dashboard-revenue-grid" style={{ marginTop: 14, opacity: busy ? 0.58 : 1 }}>
          {detailItems.map((item) => (
            <Link
              key={item.label}
              href={item.href}
              className="dashboard-revenue-metric"
              style={{ minHeight: 100, pointerEvents: busy ? 'none' : 'auto' }}
            >
              <span className="dashboard-revenue-metric-label">{item.label}</span>
              <strong className="dashboard-revenue-metric-value">{item.value}</strong>
            </Link>
          ))}
        </div>
      ) : null}
    </section>
  );
}
