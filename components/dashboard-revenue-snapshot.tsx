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
};

const RANGE_IDS: DashboardDateRange[] = ['month', 'quarter', 'year', 'last_year', 'all_time'];

export function DashboardRevenueSnapshot({ metrics, loading }: DashboardRevenueSnapshotProps) {
  const { t, locale } = useTranslation();
  const copy = getDashboardFinanceCopy(locale);
  const [range, setRange] = useState<DashboardDateRange>('month');
  const [activeMetrics, setActiveMetrics] = useState(metrics);
  const [rangeLoading, setRangeLoading] = useState(false);
  const [rangeError, setRangeError] = useState(false);
  const [showMoreDetails, setShowMoreDetails] = useState(false);

  useEffect(() => {
    if (range === 'month') setActiveMetrics(metrics);
  }, [metrics, range]);

  useEffect(() => {
    if (loading) return;

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
          setActiveMetrics(next);
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

    if (range !== 'month') void loadRange();
    return () => {
      cancelled = true;
    };
  }, [range, loading]);

  const paidToYou = activeMetrics.paidToYou ?? activeMetrics.cashCollected ?? activeMetrics.revenueThisMonth ?? 0;
  const stillOwed = activeMetrics.stillOwed ?? activeMetrics.pendingIncoming ?? activeMetrics.outstandingInvoices ?? 0;
  const contractorPay = activeMetrics.contractorPayThisMonth || 0;
  const cashAfterPaidCosts =
    activeMetrics.cashAfterPaidCosts ??
    activeMetrics.cashAfterExpenses ??
    activeMetrics.netCashFlow ??
    0;
  const customerInvoices = activeMetrics.customerInvoices ?? activeMetrics.bookedRevenue ?? 0;
  const uninvoicedWork = activeMetrics.uninvoicedCompletedWork ?? 0;
  const otherExpenses = activeMetrics.otherExpensesThisMonth || 0;
  const contractorPaid = activeMetrics.contractorPaymentsPaid || 0;
  const unpaidContractorPay = activeMetrics.unpaidContractorPay || 0;
  const overdueAmount = activeMetrics.latePayments ?? activeMetrics.overdueAmount ?? 0;
  const rangeLabel = copy.ranges[range];

  const primaryItems: MetricItem[] = [
    {
      label: copy.money.collected,
      value: formatCurrency(paidToYou),
      href: DASHBOARD_LINKS.paidToYou,
      help: copy.money.collectedHelp
    },
    {
      label: copy.money.outstanding,
      value: formatCurrency(stillOwed),
      href: DASHBOARD_LINKS.stillOwed,
      help: copy.money.outstandingHelp
    },
    {
      label: copy.money.contractorCost,
      value: formatCurrency(contractorPay),
      href: DASHBOARD_LINKS.contractorPay,
      help: copy.money.contractorCostHelp
    },
    {
      label: copy.money.cashAfterCosts,
      value: formatCurrency(cashAfterPaidCosts),
      href: DASHBOARD_LINKS.cashAfterExpenses,
      help: copy.money.cashAfterCostsHelp
    }
  ];

  const secondaryItems: MetricItem[] = [
    {
      label: `${copy.money.invoiced} · ${rangeLabel}`,
      value: formatCurrency(customerInvoices),
      href: DASHBOARD_LINKS.customerInvoices,
      help: copy.money.invoicedHelp
    },
    {
      label: `${copy.money.uninvoicedWork} · ${rangeLabel}`,
      value: formatCurrency(uninvoicedWork),
      href: DASHBOARD_LINKS.completedJobs,
      help: copy.money.uninvoicedWorkHelp
    },
    {
      label: `${copy.money.otherExpenses} · ${rangeLabel}`,
      value: formatCurrency(otherExpenses),
      href: DASHBOARD_LINKS.otherExpenses,
      help: copy.money.otherExpensesHelp
    },
    {
      label: copy.money.contractorPayOwed,
      value: formatCurrency(unpaidContractorPay),
      href: DASHBOARD_LINKS.contractorPayOwed,
      help: copy.money.contractorPayOwedHelp
    },
    {
      label: copy.money.contractorPayPaid,
      value: formatCurrency(contractorPaid),
      href: DASHBOARD_LINKS.contractorPay,
      help: copy.money.contractorPayPaidHelp
    },
    {
      label: `${copy.money.latePayments} · ${copy.money.current}`,
      value: formatCurrency(overdueAmount),
      href: DASHBOARD_LINKS.latePayments,
      help: copy.money.latePaymentsHelp
    },
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
    }
  ];

  const isLoading = Boolean(loading || rangeLoading);
  const showLoadError = !isLoading && (rangeError || Boolean(activeMetrics.loadFailed));

  return (
    <section
      className="card dashboard-today-card"
      aria-label={copy.overview.title}
      aria-busy={isLoading}
      style={{ minHeight: 300 }}
    >
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
            disabled={rangeLoading}
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

      <div style={{ minHeight: 24, marginTop: 8 }}>
        {isLoading ? (
          <p className="loading-state" role="status" style={{ margin: 0 }}>
            {t('common.loading')}
          </p>
        ) : null}
        {showLoadError ? (
          <p className="muted" role="alert" style={{ margin: 0 }}>
            {copy.overview.loadError}
          </p>
        ) : null}
      </div>

      <div className="dashboard-revenue-grid" style={{ opacity: isLoading ? 0.58 : 1 }}>
        {primaryItems.map((item) => (
          <Link
            key={item.label}
            href={item.href}
            className="dashboard-revenue-metric is-primary"
            title={item.help}
            aria-label={`${item.label}. ${item.help}`}
            style={{ minHeight: 118, pointerEvents: isLoading ? 'none' : 'auto' }}
          >
            <span className="dashboard-revenue-metric-label">{item.label}</span>
            <strong className="dashboard-revenue-metric-value">{item.value}</strong>
          </Link>
        ))}
      </div>

      <div style={{ marginTop: 16, minHeight: 42 }}>
        <button
          type="button"
          className="button secondary"
          onClick={() => setShowMoreDetails((current) => !current)}
          disabled={isLoading}
        >
          {showMoreDetails ? copy.overview.hideDetails : copy.overview.moreDetails}
        </button>
      </div>

      {showMoreDetails ? (
        <div className="dashboard-revenue-grid" style={{ marginTop: 16, opacity: isLoading ? 0.58 : 1 }}>
          {secondaryItems.map((item) => (
            <Link
              key={item.label}
              href={item.href}
              className="dashboard-revenue-metric"
              title={item.help}
              aria-label={item.help ? `${item.label}. ${item.help}` : item.label}
              style={{ minHeight: 150, pointerEvents: isLoading ? 'none' : 'auto' }}
            >
              <span className="dashboard-revenue-metric-label">{item.label}</span>
              <strong className="dashboard-revenue-metric-value">{item.value}</strong>
              {item.help ? (
                <span className="dashboard-revenue-metric-desc muted">{item.help}</span>
              ) : null}
            </Link>
          ))}
        </div>
      ) : null}
    </section>
  );
}
