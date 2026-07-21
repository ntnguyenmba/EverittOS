'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useTranslation } from '@/components/locale-provider';
import {
  buildMoneySummaryMetrics,
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

const MONEY_SUMMARY_HREF: Record<string, string> = {
  collected: DASHBOARD_LINKS.paidToYou,
  outstanding: DASHBOARD_LINKS.stillOwed,
  invoiced: DASHBOARD_LINKS.customerInvoices,
  netCash: DASHBOARD_LINKS.cashAfterExpenses
};

export function DashboardRevenueSnapshot({ metrics, loading }: DashboardRevenueSnapshotProps) {
  const { t } = useTranslation();
  const [range, setRange] = useState<DashboardDateRange>('month');
  const [rangeMetrics, setRangeMetrics] = useState(metrics);
  const [rangeLoading, setRangeLoading] = useState(false);
  const [rangeError, setRangeError] = useState(false);

  useEffect(() => {
    if (range === 'month') {
      setRangeMetrics(metrics);
      setRangeError(Boolean(metrics.loadFailed));
    }
  }, [metrics, range]);

  useEffect(() => {
    if (range === 'month') return;
    let cancelled = false;

    async function loadRange() {
      setRangeLoading(true);
      setRangeError(false);
      try {
        const {
          data: { user }
        } = await supabase.auth.getUser();

        if (!user) {
          if (!cancelled) {
            setRangeError(true);
            setRangeLoading(false);
          }
          return;
        }

        const org = await ensureOrganizationForUser(user.id);
        const next = await fetchDashboardRevenueMetrics(supabase, org?.organizationId || null, range);

        if (!cancelled) {
          setRangeMetrics(next);
          setRangeError(Boolean(next.loadFailed));
          setRangeLoading(false);
        }
      } catch {
        if (!cancelled) {
          setRangeError(true);
          setRangeLoading(false);
        }
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
  const unpaidContractorPay = activeMetrics.unpaidContractorPay || 0;
  const pendingContractorPay = activeMetrics.pendingContractorPay || 0;
  const otherExpenses = activeMetrics.otherExpensesThisMonth || 0;
  const estimatedProfit =
    activeMetrics.estimatedProfit ??
    activeMetrics.netEstimateThisMonth ??
    Number((customerInvoices - contractorPay - otherExpenses).toFixed(2));
  const profitPercentage = calculateEstimatedProfitPercentage(estimatedProfit, customerInvoices);
  const costsMissing = contractorPay <= 0 && otherExpenses <= 0 && customerInvoices > 0;
  const rangeLabel = RANGE_OPTIONS.find((option) => option.value === range)?.label || 'This month';
  const hasCreatedInvoices = Boolean(activeMetrics.hasCreatedInvoices);

  const moneySummary = buildMoneySummaryMetrics({
    rangeLabel,
    collected: paidToYou,
    outstanding: stillOwed,
    invoiced: customerInvoices,
    expensesPaid: otherExpenses,
    hasCreatedInvoices
  });

  const comparisonBase = Math.max(
    ...moneySummary.map((item) => Math.abs(item.value)),
    1
  );

  const items: MetricItem[] = [
    {
      label: `Collected · ${rangeLabel}`,
      value: formatCurrency(paidToYou),
      href: DASHBOARD_LINKS.paidToYou,
      help: 'Client payments received during this period from direct job payments and invoice payments.'
    },
    ...(hasCreatedInvoices
      ? [
          {
            label: `Invoiced · ${rangeLabel}`,
            value: formatCurrency(customerInvoices),
            href: DASHBOARD_LINKS.customerInvoices,
            help: 'Invoice totals created during this period.'
          } satisfies MetricItem
        ]
      : []),
    {
      label: 'Outstanding balance',
      value: formatCurrency(stillOwed),
      href: DASHBOARD_LINKS.stillOwed,
      help: 'Current unpaid invoice balances plus unpaid expected amounts on jobs without invoices.'
    },
    {
      label: 'Late payments · Current',
      value: formatCurrency(latePayments),
      href: DASHBOARD_LINKS.latePayments,
      help: 'Current unpaid invoice balances that are past their due dates.'
    },
    {
      label: 'Late invoices',
      value: String(activeMetrics.overdueInvoiceCount ?? 0),
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
      value: formatCurrency(contractorPay),
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
      help: 'Amounts invoiced minus contractor pay and other recorded expenses for this period.',
      warning: costsMissing ? 'Only recorded costs are included.' : undefined
    },
    {
      label: `Net cash · ${rangeLabel}`,
      value: formatCurrency(activeMetrics.moneySummaryNetCash ?? paidToYou - otherExpenses),
      href: DASHBOARD_LINKS.cashAfterExpenses,
      help: 'Collected payments for this period minus expenses paid during this period.'
    },
    ...(profitPercentage === null
      ? []
      : [
          {
            label: 'Estimated profit percentage',
            value: `${profitPercentage}%`,
            href: DASHBOARD_LINKS.estimatedProfit,
            help: 'Estimated profit divided by the amount invoiced for this period.',
            warning: costsMissing ? 'Only recorded costs are included.' : undefined
          } satisfies MetricItem
        ]),
    ...(uninvoicedCompletedWork > 0
      ? [
          {
            label: `Uninvoiced completed work · ${rangeLabel}`,
            value: formatCurrency(uninvoicedCompletedWork),
            href: DASHBOARD_LINKS.completedJobs,
            help: 'Completed job revenue that has not been invoiced. It is not included in Invoiced totals.'
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
      value: String(activeMetrics.jobsCompletedThisMonth ?? 0),
      href: DASHBOARD_LINKS.completedJobs
    },
    {
      label: `Jobs · ${rangeLabel}`,
      value: String(activeMetrics.totalJobs ?? 0),
      href: DASHBOARD_LINKS.jobs
    },
    {
      label: t('dashboard.revenue.upcomingJobs'),
      value: String(activeMetrics.upcomingJobs ?? 0),
      href: DASHBOARD_LINKS.upcomingJobs
    },
    {
      label: t('dashboard.revenue.activeCustomers'),
      value: String(activeMetrics.activeCustomers ?? 0),
      href: DASHBOARD_LINKS.activeCustomers
    },
    {
      label: `Bookings · ${rangeLabel}`,
      value: String(activeMetrics.bookingCountThisMonth ?? 0),
      href: DASHBOARD_LINKS.bookings
    },
    {
      label: `Messages · ${rangeLabel}`,
      value: String(activeMetrics.messageCount ?? 0),
      href: DASHBOARD_LINKS.messages
    },
    {
      label: `Reports · ${rangeLabel}`,
      value: String(activeMetrics.reportCount ?? 0),
      href: DASHBOARD_LINKS.reports
    }
  ];

  const isLoading = Boolean(loading || rangeLoading);
  const showLoadError = !isLoading && (rangeError || Boolean(activeMetrics.loadFailed));

  return (
    <section className="card dashboard-today-card" aria-label="Business overview">
      <div className="dashboard-section-head" style={{ alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <div>
          <h2>Business overview</h2>
          <p className="muted" style={{ margin: '6px 0 0' }}>
            See what clients paid, what is still owed, expenses, and estimated profit.
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

      {showLoadError ? (
        <p className="muted" role="alert" style={{ marginTop: 12 }}>
          Unable to load money summary. Refresh and try again.
        </p>
      ) : null}

      {!isLoading && !showLoadError ? (
        <>
          <div className="settings-card money-summary-card" style={{ marginBottom: 18 }}>
            <div className="job-financials-head money-summary-head">
              <div>
                <h3>Money summary</h3>
                <p className="muted">
                  Collected payments, outstanding balances
                  {hasCreatedInvoices ? ', invoiced totals,' : ''} and net cash for {rangeLabel.toLowerCase()}.
                </p>
              </div>
            </div>
            {costsMissing ? (
              <p className="muted" style={{ margin: '0 0 12px', fontSize: 13 }}>
                Only recorded costs are included.
              </p>
            ) : null}
            <div className="money-summary-list">
              {moneySummary.map((item) => {
                const width = Math.max(0, Math.min(100, (Math.abs(item.value) / comparisonBase) * 100));
                return (
                  <Link
                    key={item.key}
                    href={MONEY_SUMMARY_HREF[item.key] || DASHBOARD_LINKS.paidToYou}
                    className="money-summary-row"
                    title={item.help}
                    aria-label={`${item.label}: ${formatCurrency(item.value)}. ${item.help}`}
                  >
                    <div className="money-summary-row-head">
                      <span className="money-summary-label">{item.label}</span>
                      <strong className="money-summary-value">{formatCurrency(item.value)}</strong>
                    </div>
                    <p className="muted money-summary-help">{item.help}</p>
                    <div className="money-summary-bar" aria-hidden="true">
                      <div
                        className={`money-summary-bar-fill${item.value < 0 ? ' is-negative' : ''}`}
                        style={{
                          minWidth: item.value === 0 ? 0 : 4,
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
