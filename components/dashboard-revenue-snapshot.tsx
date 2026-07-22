'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useTranslation } from '@/components/locale-provider';
import {
  buildPrimaryDashboardMetrics,
  calculateEstimatedProfitPercentage,
  fetchDashboardRevenueMetrics,
  formatCurrency,
  type DashboardDateRange,
  type DashboardRevenueMetrics,
  type PrimaryDashboardMetricKey
} from '@/lib/dashboard-metrics';
import { DASHBOARD_LINKS } from '@/lib/dashboard-links';
import { getDashboardFinanceCopy } from '@/lib/i18n/dashboard-finance-copy';
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

const RANGE_IDS: DashboardDateRange[] = ['month', 'quarter', 'year', 'last_year', 'all_time'];

const PRIMARY_HREF: Record<PrimaryDashboardMetricKey, string> = {
  expectedRevenue: DASHBOARD_LINKS.estimatedProfit,
  collected: DASHBOARD_LINKS.paidToYou,
  outstanding: DASHBOARD_LINKS.stillOwed,
  contractorCost: DASHBOARD_LINKS.contractorPay,
  expectedProfit: DASHBOARD_LINKS.estimatedProfit,
  cashAfterPaidCosts: DASHBOARD_LINKS.cashAfterExpenses
};

export function DashboardRevenueSnapshot({ metrics, loading }: DashboardRevenueSnapshotProps) {
  const { t, locale } = useTranslation();
  const copy = getDashboardFinanceCopy(locale);
  const [range, setRange] = useState<DashboardDateRange>('month');
  const [rangeMetrics, setRangeMetrics] = useState(metrics);
  const [rangeLoading, setRangeLoading] = useState(false);
  const [rangeError, setRangeError] = useState(false);
  const [showMoreDetails, setShowMoreDetails] = useState(false);

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
  const expectedRevenue =
    activeMetrics.expectedRevenue ??
    Number((customerInvoices + uninvoicedCompletedWork).toFixed(2));
  const stillOwed = activeMetrics.stillOwed ?? activeMetrics.pendingIncoming ?? activeMetrics.outstandingInvoices ?? 0;
  const latePayments = activeMetrics.latePayments ?? activeMetrics.overdueAmount ?? 0;
  const contractorPay = activeMetrics.contractorPayThisMonth || 0;
  const unpaidContractorPay = activeMetrics.unpaidContractorPay || 0;
  const pendingContractorPay = activeMetrics.pendingContractorPay || 0;
  const otherExpenses = activeMetrics.otherExpensesThisMonth || 0;
  const estimatedProfit =
    activeMetrics.estimatedProfit ??
    activeMetrics.netEstimateThisMonth ??
    Number((expectedRevenue - contractorPay - otherExpenses).toFixed(2));
  const cashAfterPaidCosts =
    activeMetrics.cashAfterPaidCosts ??
    activeMetrics.cashAfterExpenses ??
    activeMetrics.netCashFlow ??
    0;
  const profitPercentage = calculateEstimatedProfitPercentage(estimatedProfit, expectedRevenue);
  const costsMissing = contractorPay <= 0 && otherExpenses <= 0 && expectedRevenue > 0;
  const rangeLabel = copy.ranges[range];
  const hasCreatedInvoices = Boolean(activeMetrics.hasCreatedInvoices);
  const primaryMetrics = buildPrimaryDashboardMetrics({
    expectedRevenue,
    collected: paidToYou,
    outstanding: stillOwed,
    contractorCost: contractorPay,
    expectedProfit: estimatedProfit,
    cashAfterPaidCosts,
    labels: {
      expectedRevenue: copy.money.expectedRevenue,
      collected: copy.money.collected,
      outstanding: copy.money.outstanding,
      contractorCost: copy.money.contractorCost,
      expectedProfit: copy.money.expectedProfit,
      cashAfterPaidCosts: copy.money.cashAfterCosts
    },
    helps: {
      expectedRevenue: copy.money.expectedRevenueHelp,
      collected: copy.money.collectedHelp,
      outstanding: copy.money.outstandingHelp,
      contractorCost: copy.money.contractorCostHelp,
      expectedProfit: copy.money.expectedProfitHelp,
      cashAfterPaidCosts: copy.money.cashAfterCostsHelp
    }
  });

  const secondaryItems: MetricItem[] = [
    ...(hasCreatedInvoices
      ? [
          {
            label: `${copy.money.invoiced} · ${rangeLabel}`,
            value: formatCurrency(customerInvoices),
            href: DASHBOARD_LINKS.customerInvoices,
            help: copy.money.invoicedHelp
          } satisfies MetricItem
        ]
      : []),
    ...(uninvoicedCompletedWork > 0
      ? [
          {
            label: `${copy.money.uninvoicedWork} · ${rangeLabel}`,
            value: formatCurrency(uninvoicedCompletedWork),
            href: DASHBOARD_LINKS.completedJobs,
            help: copy.money.uninvoicedWorkHelp
          } satisfies MetricItem
        ]
      : []),
    {
      label: `${copy.money.latePayments} · ${copy.money.current}`,
      value: formatCurrency(latePayments),
      href: DASHBOARD_LINKS.latePayments,
      help: copy.money.latePaymentsHelp
    },
    {
      label: copy.money.lateInvoices,
      value: String(activeMetrics.overdueInvoiceCount ?? 0),
      href: DASHBOARD_LINKS.latePayments
    },
    {
      label: copy.money.unpaidInvoices,
      value: String(activeMetrics.outstandingInvoiceCount ?? 0),
      href: DASHBOARD_LINKS.unpaidInvoices,
      help: copy.money.unpaidInvoicesHelp
    },
    {
      label: copy.money.averageDays,
      value:
        activeMetrics.averageDaysToPayment === null || activeMetrics.averageDaysToPayment === undefined
          ? copy.money.averageDaysNone
          : `${activeMetrics.averageDaysToPayment} ${copy.money.days}`,
      href: DASHBOARD_LINKS.paidToYou,
      help:
        activeMetrics.averageDaysToPayment === null || activeMetrics.averageDaysToPayment === undefined
          ? copy.money.averageDaysHelpEmpty
          : copy.money.averageDaysHelp
    },
    {
      label: copy.money.contractorPayOwed,
      value: formatCurrency(unpaidContractorPay),
      href: DASHBOARD_LINKS.contractorPayOwed,
      help: copy.money.contractorPayOwedHelp
    },
    {
      label: copy.money.contractorPayPending,
      value: formatCurrency(pendingContractorPay),
      href: DASHBOARD_LINKS.contractorPayPending,
      help: copy.money.contractorPayPendingHelp
    },
    {
      label: `${copy.money.otherExpenses} · ${rangeLabel}`,
      value: formatCurrency(otherExpenses),
      href: DASHBOARD_LINKS.otherExpenses,
      help: copy.money.otherExpensesHelp
    },
    ...(profitPercentage === null
      ? []
      : [
          {
            label: copy.money.expectedProfitPct,
            value: `${profitPercentage}%`,
            href: DASHBOARD_LINKS.estimatedProfit,
            help: copy.money.expectedProfitPctHelp,
            warning: costsMissing ? copy.money.costsMissing : undefined
          } satisfies MetricItem
        ]),
    ...(activeMetrics.paymentsMissingDates > 0
      ? [
          {
            label: copy.money.paymentsMissingDates,
            value: String(activeMetrics.paymentsMissingDates),
            href: DASHBOARD_LINKS.customerInvoices,
            help: copy.money.paymentsMissingDatesHelp
          } satisfies MetricItem
        ]
      : []),
    {
      label: `${copy.money.completedJobs} · ${rangeLabel}`,
      value: String(activeMetrics.jobsCompletedThisMonth ?? 0),
      href: DASHBOARD_LINKS.completedJobs,
      help: copy.money.completedJobsHelp
    },
    {
      label: `${copy.money.jobs} · ${rangeLabel}`,
      value: String(activeMetrics.totalJobs ?? 0),
      href: DASHBOARD_LINKS.jobs,
      help: copy.money.jobsHelp
    },
    {
      label: t('dashboard.revenue.upcomingJobs'),
      value: String(activeMetrics.upcomingJobs ?? 0),
      href: DASHBOARD_LINKS.upcomingJobs
    },
    {
      label: copy.money.activeCustomers,
      value: String(activeMetrics.activeCustomers ?? 0),
      href: DASHBOARD_LINKS.activeCustomers,
      help: copy.money.activeCustomersHelp
    },
    {
      label: `${copy.money.bookings} · ${rangeLabel}`,
      value: String(activeMetrics.bookingCountThisMonth ?? 0),
      href: DASHBOARD_LINKS.bookings
    },
    {
      label: `${copy.money.messages} · ${rangeLabel}`,
      value: String(activeMetrics.messageCount ?? 0),
      href: DASHBOARD_LINKS.messages
    },
    {
      label: `${copy.money.reports} · ${rangeLabel}`,
      value: String(activeMetrics.reportCount ?? 0),
      href: DASHBOARD_LINKS.reports
    }
  ];

  const isLoading = Boolean(loading || rangeLoading);
  const showLoadError = !isLoading && (rangeError || Boolean(activeMetrics.loadFailed));

  return (
    <section className="card dashboard-today-card" aria-label={copy.overview.title}>
      <div className="dashboard-section-head" style={{ alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <div>
          <h2>{copy.overview.title}</h2>
          <p className="muted" style={{ margin: '6px 0 0' }}>
            {copy.overview.subtitle}
          </p>
        </div>
        <div className="inline-actions" style={{ marginLeft: 'auto' }}>
          <label className="sr-only" htmlFor="dashboard-date-range">
            {copy.overview.periodLabel}
          </label>
          <select
            id="dashboard-date-range"
            className="input"
            value={range}
            onChange={(event) => setRange(event.target.value as DashboardDateRange)}
            style={{ width: 'auto', minWidth: 150 }}
          >
            {RANGE_IDS.map((id) => (
              <option key={id} value={id}>
                {copy.ranges[id]}
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
          {copy.overview.loadError}
        </p>
      ) : null}

      {!isLoading && !showLoadError ? (
        <>
          {costsMissing ? (
            <p className="muted" style={{ margin: '0 0 12px', fontSize: 13 }}>
              {copy.money.costsMissing}
            </p>
          ) : null}

          <div className="dashboard-revenue-grid">
            {primaryMetrics.map((item) => (
              <Link
                key={item.key}
                href={PRIMARY_HREF[item.key]}
                className="dashboard-revenue-metric"
                title={item.help}
                aria-label={`${item.label}. ${item.help}`}
              >
                <span className="dashboard-revenue-metric-label">{item.label}</span>
                <strong className="dashboard-revenue-metric-value">{formatCurrency(item.value)}</strong>
                <span className="muted" style={{ fontSize: 12, lineHeight: 1.4 }}>
                  {item.help}
                </span>
              </Link>
            ))}
          </div>

          <div style={{ marginTop: 16 }}>
            <button
              type="button"
              className="button secondary"
              onClick={() => setShowMoreDetails((open) => !open)}
              aria-expanded={showMoreDetails}
            >
              {showMoreDetails ? copy.overview.hideDetails : copy.overview.moreDetails}
            </button>
          </div>

          {showMoreDetails ? (
            <div className="dashboard-revenue-grid" style={{ marginTop: 16 }}>
              {secondaryItems.map((item) => (
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
          ) : null}
        </>
      ) : null}
    </section>
  );
}
