'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useTranslation } from '@/components/locale-provider';
import {
  buildMoneySummaryMetrics,
  calculateEstimatedProfitPercentage,
  fetchDashboardRevenueMetrics,
  formatCurrency,
  inRange,
  rangeBounds,
  type DashboardDateRange,
  type DashboardRevenueMetrics
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

type OperationalCounts = {
  jobs: number;
  completedJobs: number;
  activeCustomers: number;
};

type OperationalJobRow = {
  status?: string | null;
  start_date?: string | null;
  scheduled_start?: string | null;
  completed_at?: string | null;
};

const RANGE_IDS: DashboardDateRange[] = ['month', 'quarter', 'year', 'last_year', 'all_time'];

const MONEY_SUMMARY_HREF: Record<string, string> = {
  collected: DASHBOARD_LINKS.paidToYou,
  outstanding: DASHBOARD_LINKS.stillOwed,
  invoiced: DASHBOARD_LINKS.customerInvoices,
  netCash: DASHBOARD_LINKS.cashAfterExpenses
};

export function DashboardRevenueSnapshot({ metrics, loading }: DashboardRevenueSnapshotProps) {
  const { t, locale } = useTranslation();
  const copy = getDashboardFinanceCopy(locale);
  const [range, setRange] = useState<DashboardDateRange>('month');
  const [rangeMetrics, setRangeMetrics] = useState(metrics);
  const [rangeLoading, setRangeLoading] = useState(false);
  const [rangeError, setRangeError] = useState(false);
  const [operationalCounts, setOperationalCounts] = useState<OperationalCounts | null>(null);

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

  useEffect(() => {
    let cancelled = false;

    async function loadOperationalCounts() {
      setOperationalCounts(null);
      const {
        data: { user }
      } = await supabase.auth.getUser();
      if (!user) return;

      const org = await ensureOrganizationForUser(user.id);
      if (!org?.organizationId) return;

      const [jobsResult, customersResult] = await Promise.all([
        supabase
          .from('jobs')
          .select('status, start_date, scheduled_start, completed_at')
          .eq('organization_id', org.organizationId)
          .neq('status', 'cancelled')
          .neq('status', 'canceled'),
        supabase
          .from('customers')
          .select('id', { count: 'exact', head: true })
          .eq('organization_id', org.organizationId)
          .eq('record_type', 'customer')
          .eq('pipeline_stage', 'active')
      ]);

      if (cancelled) return;

      const { start, end } = rangeBounds(range);
      const jobs = (jobsResult.data || []) as OperationalJobRow[];
      let jobsInRange = 0;
      let completedInRange = 0;

      for (const job of jobs) {
        const status = String(job.status || '').toLowerCase();
        const completedDate = job.completed_at;
        const operationalDate = status === 'completed'
          ? completedDate
          : job.start_date || job.scheduled_start;

        if (range === 'all_time' || inRange(operationalDate, start, end)) {
          jobsInRange += 1;
        }
        if (status === 'completed' && (range === 'all_time' || inRange(completedDate, start, end))) {
          completedInRange += 1;
        }
      }

      setOperationalCounts({
        jobs: jobsResult.error ? 0 : jobsInRange,
        completedJobs: jobsResult.error ? 0 : completedInRange,
        activeCustomers: customersResult.error ? 0 : customersResult.count || 0
      });
    }

    void loadOperationalCounts();
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
  const rangeLabel = copy.ranges[range];
  const hasCreatedInvoices = Boolean(activeMetrics.hasCreatedInvoices);
  const displayedJobs = operationalCounts?.jobs ?? activeMetrics.totalJobs ?? 0;
  const displayedCompletedJobs = operationalCounts?.completedJobs ?? activeMetrics.jobsCompletedThisMonth ?? 0;
  const displayedActiveCustomers = operationalCounts?.activeCustomers ?? activeMetrics.activeCustomers ?? 0;

  const moneySummary = buildMoneySummaryMetrics({
    rangeLabel,
    collected: paidToYou,
    outstanding: stillOwed,
    invoiced: customerInvoices,
    expensesPaid: otherExpenses,
    hasCreatedInvoices
  }).map((row) => {
    if (row.key === 'collected') {
      return { ...row, label: `${copy.money.collected} ${rangeLabel.toLowerCase()}`, help: copy.money.collectedHelp };
    }
    if (row.key === 'outstanding') {
      return { ...row, label: copy.money.outstanding, help: copy.money.outstandingHelp };
    }
    if (row.key === 'invoiced') {
      return { ...row, label: `${copy.money.invoiced} ${rangeLabel.toLowerCase()}`, help: copy.money.invoicedHelp };
    }
    return { ...row, label: `${copy.money.netCash} ${rangeLabel.toLowerCase()}`, help: copy.money.netCashHelp };
  });

  const comparisonBase = Math.max(
    ...moneySummary.map((item) => Math.abs(item.value)),
    1
  );

  const items: MetricItem[] = [
    {
      label: `${copy.money.collected} · ${rangeLabel}`,
      value: formatCurrency(paidToYou),
      href: DASHBOARD_LINKS.paidToYou,
      help: copy.money.collectedHelp
    },
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
    {
      label: copy.money.outstanding,
      value: formatCurrency(stillOwed),
      href: DASHBOARD_LINKS.stillOwed,
      help: copy.money.outstandingHelp
    },
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
      label: `${copy.money.contractorPay} · ${rangeLabel}`,
      value: formatCurrency(contractorPay),
      href: DASHBOARD_LINKS.contractorPay,
      help: copy.money.contractorPayHelp
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
    {
      label: `${copy.money.expectedProfit} · ${rangeLabel}`,
      value: formatCurrency(estimatedProfit),
      href: DASHBOARD_LINKS.estimatedProfit,
      help: copy.money.expectedProfitHelp,
      warning: costsMissing ? copy.money.costsMissing : undefined
    },
    {
      label: `${copy.money.cashAfterCosts} · ${rangeLabel}`,
      value: formatCurrency(activeMetrics.cashAfterExpenses ?? activeMetrics.netCashFlow ?? paidToYou - otherExpenses),
      href: DASHBOARD_LINKS.cashAfterExpenses,
      help: copy.money.cashAfterCostsHelp
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
      value: String(displayedCompletedJobs),
      href: DASHBOARD_LINKS.completedJobs,
      help: copy.money.completedJobsHelp
    },
    {
      label: `${copy.money.jobs} · ${rangeLabel}`,
      value: String(displayedJobs),
      href: DASHBOARD_LINKS.jobs,
      help: copy.money.jobsHelp
    },
    {
      label: t('dashboard.revenue.upcomingJobs'),
      value: String(activeMetrics.upcomingJobs ?? 0),
      href: DASHBOARD_LINKS.upcomingJobs
    },
    {
      label: t('dashboard.revenue.activeCustomers'),
      value: String(displayedActiveCustomers),
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
          <div className="settings-card money-summary-card" style={{ marginBottom: 18 }}>
            <div className="job-financials-head money-summary-head">
              <div>
                <h3>{copy.overview.moneySummaryTitle}</h3>
                <p className="muted">
                  {copy.money.collectedHelp}
                </p>
              </div>
            </div>
            {costsMissing ? (
              <p className="muted" style={{ margin: '0 0 12px', fontSize: 13 }}>
                {copy.money.costsMissing}
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
