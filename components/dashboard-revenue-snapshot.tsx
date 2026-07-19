'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useTranslation } from '@/components/locale-provider';
import {
  calculateEstimatedProfitPercentage,
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
  loading?: boolean;
};

type FinancialBreakdownItem = {
  label: string;
  value: number | null;
  displayValue: string;
  href: string;
  help?: string;
};

type MetricItem = {
  label: string;
  value: string;
  href: string;
  help?: string;
  warning?: string;
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
  const paidToYou = activeMetrics.paidToYou ?? activeMetrics.cashCollected ?? activeMetrics.revenueThisMonth ?? 0;
  const customerInvoices = activeMetrics.customerInvoices ?? activeMetrics.bookedRevenue ?? 0;
  const uninvoicedCompletedWork = activeMetrics.uninvoicedCompletedWork ?? 0;
  const stillOwed = activeMetrics.stillOwed ?? activeMetrics.pendingIncoming ?? activeMetrics.outstandingInvoices ?? 0;
  const latePayments = activeMetrics.latePayments ?? activeMetrics.overdueAmount ?? 0;
  const contractorPay = activeMetrics.contractorPayThisMonth || 0;
  const contractorPaymentsPaid = activeMetrics.contractorPaymentsPaid || 0;
  const unpaidContractorPay = activeMetrics.unpaidContractorPay || 0;
  const pendingContractorPay = activeMetrics.pendingContractorPay || 0;
  const otherExpenses = activeMetrics.otherExpensesThisMonth || 0;
  const estimatedProfit =
    activeMetrics.estimatedProfit ??
    activeMetrics.netEstimateThisMonth ??
    Number((customerInvoices - contractorPay - otherExpenses).toFixed(2));
  const cashAfterExpenses =
    activeMetrics.cashAfterExpenses ??
    activeMetrics.netCashFlow ??
    Number((paidToYou - contractorPaymentsPaid - otherExpenses).toFixed(2));
  const profitPercentage = calculateEstimatedProfitPercentage(estimatedProfit, customerInvoices);
  const costsMissing = contractorPay <= 0 && otherExpenses <= 0 && customerInvoices > 0;
  const comparisonBase = Math.max(
    paidToYou,
    customerInvoices,
    stillOwed,
    contractorPay,
    otherExpenses,
    Math.abs(cashAfterExpenses),
    1
  );
  const rangeLabel = RANGE_OPTIONS.find((option) => option.value === range)?.label || 'This month';
  const stillOwedLabel = range === 'all_time' ? 'Still owed · All time' : 'Still owed · Current';

  const financialBreakdown: FinancialBreakdownItem[] = [
    {
      label: `Paid to you · ${rangeLabel}`,
      value: paidToYou,
      displayValue: formatCurrency(paidToYou),
      href: DASHBOARD_LINKS.paidToYou,
      help: 'Customer payments recorded during this period. Tap to open payment history.'
    },
    {
      label: `Customer invoices · ${rangeLabel}`,
      value: customerInvoices,
      displayValue: formatCurrency(customerInvoices),
      href: DASHBOARD_LINKS.customerInvoices,
      help: 'Total non-cancelled invoices created during this period.'
    },
    {
      label: stillOwedLabel,
      value: stillOwed,
      displayValue: formatCurrency(stillOwed),
      href: DASHBOARD_LINKS.stillOwed,
      help: 'Current unpaid balances across all non-cancelled invoices. Tap to open unpaid invoices.'
    },
    {
      label: `Cash after expenses · ${rangeLabel}`,
      value: cashAfterExpenses,
      displayValue: formatCurrency(cashAfterExpenses),
      href: DASHBOARD_LINKS.cashAfterExpenses,
      help: 'Customer payments received minus contractor payments and other recorded expenses paid during this period.'
    }
  ];

  const items: MetricItem[] = [
    {
      label: `Paid to you · ${rangeLabel}`,
      value: formatCurrency(paidToYou),
      href: DASHBOARD_LINKS.paidToYou,
      help: 'Customer payments recorded during this period. Tap to open payment history.'
    },
    {
      label: `Customer invoices · ${rangeLabel}`,
      value: formatCurrency(customerInvoices),
      href: DASHBOARD_LINKS.customerInvoices,
      help: 'Total non-cancelled invoices created during this period.'
    },
    {
      label: stillOwedLabel,
      value: formatCurrency(stillOwed),
      href: DASHBOARD_LINKS.stillOwed,
      help: 'Current unpaid balances across all non-cancelled invoices. Tap to open unpaid invoices.'
    },
    {
      label: 'Late payments · Current',
      value: formatCurrency(latePayments),
      href: DASHBOARD_LINKS.latePayments,
      help: 'Current unpaid balances that are past their due dates.'
    },
    {
      label: 'Late invoices',
      value: String(activeMetrics.overdueInvoiceCount),
      href: DASHBOARD_LINKS.latePayments
    },
    {
      label: 'Unpaid invoices',
      value: String(activeMetrics.outstandingInvoiceCount ?? 0),
      href: DASHBOARD_LINKS.unpaidInvoices,
      help: 'Count of non-cancelled invoices with a remaining balance.'
    },
    {
      label: 'Average time to get paid',
      value:
        activeMetrics.averageDaysToPayment === null || activeMetrics.averageDaysToPayment === undefined
          ? 'Not enough data'
          : `${activeMetrics.averageDaysToPayment} days`,
      href: DASHBOARD_LINKS.paidToYou,
      help: 'Average number of days from invoice date to recorded payment date for payments in the selected period.'
    },
    {
      label: `Contractor pay · ${rangeLabel}`,
      value: contractorPay > 0 ? formatCurrency(contractorPay) : 'Not entered',
      href: DASHBOARD_LINKS.contractorPay,
      help: 'Contractor pay recorded for work in the selected period, whether paid or still owed.'
    },
    {
      label: 'Contractor pay owed',
      value: formatCurrency(unpaidContractorPay),
      href: DASHBOARD_LINKS.contractorPayOwed
    },
    {
      label: 'Contractor pay pending',
      value: formatCurrency(pendingContractorPay),
      href: DASHBOARD_LINKS.contractorPayPending
    },
    {
      label: `Other expenses · ${rangeLabel}`,
      value: formatCurrency(otherExpenses),
      href: DASHBOARD_LINKS.otherExpenses
    },
    {
      label: `Estimated profit · ${rangeLabel}`,
      value: formatCurrency(estimatedProfit),
      href: DASHBOARD_LINKS.estimatedProfit,
      help: 'Customer invoices minus contractor pay and other recorded expenses for this period.',
      warning: costsMissing ? 'Only recorded costs are included.' : undefined
    },
    {
      label: `Cash after expenses · ${rangeLabel}`,
      value: formatCurrency(cashAfterExpenses),
      href: DASHBOARD_LINKS.cashAfterExpenses,
      help: 'Customer payments received minus contractor payments and other recorded expenses paid during this period.'
    },
    {
      label: 'Estimated profit percentage',
      value: profitPercentage === null ? 'Not available' : `${profitPercentage}% estimated profit`,
      href: DASHBOARD_LINKS.estimatedProfit,
      help:
        profitPercentage === null
          ? 'Estimated profit percentage needs customer invoices greater than zero.'
          : 'Estimated profit divided by customer invoices for this period.',
      warning: costsMissing ? 'Only recorded costs are included.' : undefined
    },
    ...(uninvoicedCompletedWork > 0
      ? [
          {
            label: `Uninvoiced completed work · ${rangeLabel}`,
            value: formatCurrency(uninvoicedCompletedWork),
            href: DASHBOARD_LINKS.completedJobs,
            help: 'Completed job revenue that has not been invoiced. Not included in Customer invoices.'
          } satisfies MetricItem
        ]
      : []),
    ...(activeMetrics.paymentsMissingDates > 0
      ? [
          {
            label: 'Payments missing dates',
            value: String(activeMetrics.paymentsMissingDates),
            href: DASHBOARD_LINKS.customerInvoices,
            help: 'Invoices with a paid amount but no payment date. These are included in All time, or in a period only when the invoice was created in that period.'
          } satisfies MetricItem
        ]
      : []),
    {
      label: `Completed jobs · ${rangeLabel}`,
      value: String(activeMetrics.jobsCompletedThisMonth),
      href: DASHBOARD_LINKS.completedJobs
    },
    {
      label: `Jobs · ${rangeLabel}`,
      value: String(activeMetrics.totalJobs),
      href: DASHBOARD_LINKS.jobs
    },
    {
      label: t('dashboard.revenue.upcomingJobs'),
      value: String(activeMetrics.upcomingJobs),
      href: DASHBOARD_LINKS.upcomingJobs
    },
    {
      label: t('dashboard.revenue.activeCustomers'),
      value: String(activeMetrics.activeCustomers),
      href: DASHBOARD_LINKS.activeCustomers
    },
    {
      label: `Bookings · ${rangeLabel}`,
      value: String(activeMetrics.bookingCountThisMonth),
      href: DASHBOARD_LINKS.bookings
    },
    {
      label: `Messages · ${rangeLabel}`,
      value: String(activeMetrics.messageCount),
      href: DASHBOARD_LINKS.messages
    },
    {
      label: `Reports · ${rangeLabel}`,
      value: String(activeMetrics.reportCount),
      href: DASHBOARD_LINKS.reports
    }
  ];

  const isLoading = Boolean(loading || rangeLoading);

  return (
    <section className="card dashboard-today-card" aria-label="Business overview">
      <div className="dashboard-section-head" style={{ alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <div>
          <h2>Business overview</h2>
          <p className="muted" style={{ margin: '6px 0 0' }}>
            See what customers paid, what you billed, what is still owed, expenses, and estimated profit.
          </p>
        </div>
        <div className="inline-actions" style={{ marginLeft: 'auto' }}>
          <label className="sr-only" htmlFor="dashboard-date-range">
            Dashboard period
          </label>
          <select
            id="dashboard-date-range"
            className="input"
            value={range}
            onChange={(event) => setRange(event.target.value as DashboardDateRange)}
            style={{ width: 'auto', minWidth: 150 }}
          >
            {RANGE_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          <Link href="/analytics" className="dashboard-section-link">
            {t('dashboard.revenue.viewAnalytics')}
          </Link>
        </div>
      </div>

      {isLoading ? (
        <p className="loading-state" role="status">
          {t('common.loading')}
        </p>
      ) : null}

      {!isLoading ? (
        <>
          <div className="settings-card" style={{ marginBottom: 18 }}>
            <div className="job-financials-head">
              <div>
                <h3>Money summary</h3>
                <p className="muted">
                  Payments received, invoices created, current unpaid balances, and cash after expenses.
                </p>
              </div>
              <strong>
                {profitPercentage === null ? 'Not available' : `${profitPercentage}% estimated profit`}
              </strong>
            </div>
            {costsMissing ? (
              <p className="muted" style={{ margin: '0 0 12px', fontSize: 13 }}>
                Only recorded costs are included.
              </p>
            ) : null}
            <div style={{ display: 'grid', gap: 14 }}>
              {financialBreakdown.map((item) => {
                const width =
                  item.value === null
                    ? 0
                    : Math.max(0, Math.min(100, (Math.abs(item.value) / comparisonBase) * 100));
                return (
                  <Link key={item.label} href={item.href} style={{ color: 'inherit', textDecoration: 'none' }} title={item.help}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, marginBottom: 6 }}>
                      <span>{item.label}</span>
                      <strong>{item.displayValue}</strong>
                    </div>
                    <div
                      aria-hidden="true"
                      style={{
                        background: 'var(--surface-subtle, rgba(127, 127, 127, 0.14))',
                        borderRadius: 999,
                        height: 10,
                        overflow: 'hidden'
                      }}
                    >
                      <div
                        style={{
                          background:
                            item.value !== null && item.value < 0
                              ? 'var(--danger, currentColor)'
                              : 'var(--accent, currentColor)',
                          borderRadius: 999,
                          height: '100%',
                          minWidth: item.value === null || item.value === 0 ? 0 : 4,
                          width: `${width}%`
                        }}
                      />
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>

          <div className="dashboard-revenue-grid">
            {items.map((item) => (
              <Link
                key={item.label}
                href={item.href}
                className="dashboard-revenue-metric"
                title={item.help}
                aria-label={item.help ? `${item.label}. ${item.help}` : item.label}
              >
                <span className="dashboard-revenue-metric-label">{item.label}</span>
                <strong className="dashboard-revenue-metric-value">{item.value}</strong>
                {item.help ? (
                  <span className="muted" style={{ fontSize: 12, lineHeight: 1.4 }}>
                    {item.help}
                  </span>
                ) : null}
                {item.warning ? (
                  <span className="muted" style={{ fontSize: 12, lineHeight: 1.4 }}>
                    {item.warning}
                  </span>
                ) : null}
              </Link>
            ))}
          </div>
        </>
      ) : null}
    </section>
  );
}
