'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useTranslation } from '@/components/locale-provider';
import {
  EXPECTED_PROFIT_FORMULA,
  fetchDashboardRevenueMetrics,
  formatCurrency,
  type DashboardDateRange,
  type DashboardRevenueMetrics,
  type FinanceDebugBreakdown
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
  rawValue?: number;
  hideWhenZero?: boolean;
};

const RANGE_IDS: DashboardDateRange[] = ['month', 'quarter', 'year', 'last_year', 'all_time'];

function canShowFinanceDebug(searchParams: URLSearchParams | null): boolean {
  if (process.env.NODE_ENV === 'development') return true;
  if (process.env.NEXT_PUBLIC_FINANCE_DEBUG === '1') return true;
  return searchParams?.get('finance_debug') === '1';
}

function DebugRow({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, padding: '6px 0', borderBottom: '1px solid var(--border, #e5e7eb)' }}>
      <div>
        <strong style={{ fontWeight: 600 }}>{label}</strong>
        {note ? <div className="muted" style={{ fontSize: 12, marginTop: 2 }}>{note}</div> : null}
      </div>
      <code style={{ whiteSpace: 'nowrap' }}>{value}</code>
    </div>
  );
}

export function DashboardRevenueSnapshot({ metrics, loading }: DashboardRevenueSnapshotProps) {
  const { t, locale } = useTranslation();
  const copy = getDashboardFinanceCopy(locale);
  const searchParams = useSearchParams();
  const [range, setRange] = useState<DashboardDateRange>('month');
  const [activeMetrics, setActiveMetrics] = useState(metrics);
  const [rangeLoading, setRangeLoading] = useState(false);
  const [rangeError, setRangeError] = useState(false);
  const [showMoreDetails, setShowMoreDetails] = useState(false);
  const [showFinanceDebug, setShowFinanceDebug] = useState(false);
  const showDebug = canShowFinanceDebug(searchParams);

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
  const periodOutstanding = activeMetrics.periodOutstanding ?? 0;
  const lifetimeOutstanding = activeMetrics.stillOwed ?? activeMetrics.pendingIncoming ?? activeMetrics.outstandingInvoices ?? 0;
  const cashAfterPaidCosts =
    activeMetrics.cashAfterPaidCosts ??
    activeMetrics.cashAfterExpenses ??
    activeMetrics.netCashFlow ??
    0;
  const customerInvoices = activeMetrics.customerInvoices ?? activeMetrics.bookedRevenue ?? 0;
  const uninvoicedWork = activeMetrics.uninvoicedCompletedWork ?? 0;
  const otherExpenses = activeMetrics.otherExpensesThisMonth || 0;
  const contractorPaid = activeMetrics.contractorPaymentsPaid || 0;
  const periodUnpaidContractorPay = activeMetrics.periodUnpaidContractorPay || 0;
  const lifetimeUnpaidContractorPay = activeMetrics.unpaidContractorPay || 0;
  const overdueAmount = activeMetrics.latePayments ?? activeMetrics.overdueAmount ?? 0;
  const completedJobs = activeMetrics.jobsCompletedThisMonth ?? 0;
  const totalJobs = activeMetrics.totalJobs ?? 0;
  const activeCustomers = activeMetrics.activeCustomers ?? activeMetrics.customerCount ?? 0;
  const rangeLabel = copy.ranges[range];
  const isEnglish = locale === 'en';

  const expectedProfit = activeMetrics.estimatedProfit ?? activeMetrics.netEstimateThisMonth ?? 0;
  const expectedRevenue = activeMetrics.expectedRevenue ?? customerInvoices + uninvoicedWork;

  const primaryItems: MetricItem[] = [
    {
      label: `${copy.money.collected} · ${rangeLabel}`,
      value: formatCurrency(paidToYou),
      href: DASHBOARD_LINKS.paidToYou,
      help: copy.money.collectedHelp
    },
    {
      label: `${isEnglish ? 'Outstanding' : copy.money.outstanding} · ${rangeLabel}`,
      value: formatCurrency(periodOutstanding),
      href: DASHBOARD_LINKS.stillOwed,
      help: isEnglish
        ? 'Unpaid balances for invoices and unbilled jobs attributed to this period.'
        : copy.money.outstandingHelp
    },
    {
      label: `${isEnglish ? 'Cash Available' : copy.money.cashAfterCosts} · ${rangeLabel}`,
      value: formatCurrency(cashAfterPaidCosts),
      href: DASHBOARD_LINKS.cashAfterExpenses,
      help: copy.money.cashAfterCostsHelp
    },
    {
      label: `${isEnglish ? 'Expected Profit' : copy.money.expectedProfit} · ${rangeLabel}`,
      value: formatCurrency(expectedProfit),
      href: DASHBOARD_LINKS.estimatedProfit,
      help: isEnglish
        ? `${EXPECTED_PROFIT_FORMULA}`
        : copy.money.expectedProfitHelp
    }
  ];

  const secondaryItems: MetricItem[] = [
    {
      label: `${copy.money.invoiced} · ${rangeLabel}`,
      value: formatCurrency(customerInvoices),
      rawValue: customerInvoices,
      hideWhenZero: true,
      href: DASHBOARD_LINKS.customerInvoices,
      help: copy.money.invoicedHelp
    },
    {
      label: `${isEnglish ? 'Unbilled Revenue' : copy.money.uninvoicedWork} · ${rangeLabel}`,
      value: formatCurrency(uninvoicedWork),
      rawValue: uninvoicedWork,
      hideWhenZero: true,
      href: DASHBOARD_LINKS.completedJobs,
      help: copy.money.uninvoicedWorkHelp
    },
    {
      label: `${isEnglish ? 'Expected Revenue' : copy.money.expectedRevenue} · ${rangeLabel}`,
      value: formatCurrency(expectedRevenue),
      rawValue: expectedRevenue,
      hideWhenZero: true,
      href: DASHBOARD_LINKS.estimatedProfit,
      help: copy.money.expectedRevenueHelp
    },
    {
      label: `${isEnglish ? 'Paid to Contractors' : copy.money.contractorPayPaid} · ${rangeLabel}`,
      value: formatCurrency(contractorPaid),
      rawValue: contractorPaid,
      hideWhenZero: true,
      href: DASHBOARD_LINKS.contractorPay,
      help: copy.money.contractorPayPaidHelp
    },
    {
      label: `${isEnglish ? 'Contractors Owed' : copy.money.contractorPayOwed} · ${rangeLabel}`,
      value: formatCurrency(periodUnpaidContractorPay),
      rawValue: periodUnpaidContractorPay,
      hideWhenZero: true,
      href: DASHBOARD_LINKS.contractorPayOwed,
      help: isEnglish
        ? 'Unpaid contractor labor for jobs attributed to this period.'
        : copy.money.contractorPayOwedHelp
    },
    {
      label: `${copy.money.otherExpenses} · ${rangeLabel}`,
      value: formatCurrency(otherExpenses),
      rawValue: otherExpenses,
      hideWhenZero: true,
      href: DASHBOARD_LINKS.otherExpenses,
      help: copy.money.otherExpensesHelp
    },
    {
      label: `${copy.money.completedJobs} · ${rangeLabel}`,
      value: String(completedJobs),
      rawValue: completedJobs,
      href: DASHBOARD_LINKS.completedJobs,
      help: copy.money.completedJobsHelp
    },
    {
      label: `${copy.money.jobs} · ${rangeLabel}`,
      value: String(totalJobs),
      rawValue: totalJobs,
      href: DASHBOARD_LINKS.jobs,
      help: copy.money.jobsHelp
    }
  ];

  const lifetimeItems: MetricItem[] = [
    {
      label: isEnglish ? 'Outstanding (all open)' : `${copy.money.outstanding} · ${copy.money.current}`,
      value: formatCurrency(lifetimeOutstanding),
      href: DASHBOARD_LINKS.stillOwed,
      help: isEnglish
        ? 'All unpaid customer balances right now, across every period.'
        : copy.money.outstandingHelp
    },
    {
      label: isEnglish ? 'Contractors Owed (all unpaid)' : `${copy.money.contractorPayOwed} · ${copy.money.current}`,
      value: formatCurrency(lifetimeUnpaidContractorPay),
      href: DASHBOARD_LINKS.contractorPayOwed,
      help: isEnglish
        ? 'All contractor labor not yet marked paid, across every period.'
        : copy.money.contractorPayOwedHelp
    },
    {
      label: `${copy.money.latePayments} · ${copy.money.current}`,
      value: formatCurrency(overdueAmount),
      href: DASHBOARD_LINKS.latePayments,
      help: copy.money.latePaymentsHelp
    },
    {
      label: copy.money.activeCustomers,
      value: String(activeCustomers),
      href: DASHBOARD_LINKS.activeCustomers || '/customers',
      help: copy.money.activeCustomersHelp
    }
  ];

  const visibleSecondaryItems = secondaryItems.filter(
    (item) => !item.hideWhenZero || Math.abs(item.rawValue ?? 0) > 0.005
  );
  const isLoading = Boolean(loading || rangeLoading);
  const showLoadError = !isLoading && (rangeError || Boolean(activeMetrics.loadFailed));

  const debug: FinanceDebugBreakdown | null = useMemo(() => {
    if (!showDebug) return null;
    return (
      activeMetrics.financeDebug || {
        range,
        start: null,
        end: null,
        invoiceRevenue: customerInvoices,
        directJobPayments: activeMetrics.directJobPaymentsInPeriod || 0,
        invoicePayments: activeMetrics.invoicePaymentsInPeriod || 0,
        collected: paidToYou,
        outstandingInvoices: periodOutstanding,
        periodOutstanding,
        lifetimeOutstanding,
        unbilledRevenue: uninvoicedWork,
        contractorLaborPaid: contractorPaid,
        contractorLaborUnpaidPeriod: periodUnpaidContractorPay,
        contractorLaborUnpaidLifetime: lifetimeUnpaidContractorPay,
        contractorLaborAccrued: activeMetrics.contractorPayThisMonth || 0,
        businessExpenses: otherExpenses,
        expectedRevenue,
        expectedProfit,
        cashAvailable: cashAfterPaidCosts,
        expectedProfitFormula: EXPECTED_PROFIT_FORMULA
      }
    );
  }, [
    showDebug,
    activeMetrics,
    range,
    customerInvoices,
    paidToYou,
    periodOutstanding,
    lifetimeOutstanding,
    uninvoicedWork,
    contractorPaid,
    periodUnpaidContractorPay,
    lifetimeUnpaidContractorPay,
    otherExpenses,
    expectedRevenue,
    expectedProfit,
    cashAfterPaidCosts
  ]);

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
            {isEnglish
              ? `Period metrics for ${rangeLabel}. Lifetime balances are listed separately below.`
              : copy.overview.subtitle}
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

      <p className="muted" style={{ marginTop: 12, fontSize: 13 }}>
        {EXPECTED_PROFIT_FORMULA}
      </p>

      <div style={{ marginTop: 16, minHeight: 42, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <button
          type="button"
          className="button secondary"
          onClick={() => setShowMoreDetails((current) => !current)}
          disabled={isLoading}
        >
          {showMoreDetails ? copy.overview.hideDetails : copy.overview.moreDetails}
        </button>
        {showDebug ? (
          <button
            type="button"
            className="button secondary"
            onClick={() => setShowFinanceDebug((current) => !current)}
            disabled={isLoading}
          >
            {showFinanceDebug ? 'Hide finance debug' : 'Finance debug'}
          </button>
        ) : null}
      </div>

      {showMoreDetails ? (
        <div className="dashboard-revenue-grid" style={{ marginTop: 16, opacity: isLoading ? 0.58 : 1 }}>
          {visibleSecondaryItems.map((item) => (
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

      <div style={{ marginTop: 28 }}>
        <div className="dashboard-section-head" style={{ marginBottom: 12 }}>
          <div>
            <h3 style={{ margin: 0 }}>{isEnglish ? 'Lifetime Statistics' : copy.money.current}</h3>
            <p className="muted" style={{ margin: '6px 0 0' }}>
              {isEnglish
                ? 'Current open balances that are not limited to the selected period.'
                : copy.overview.subtitle}
            </p>
          </div>
        </div>
        <div className="dashboard-revenue-grid" style={{ opacity: isLoading ? 0.58 : 1 }}>
          {lifetimeItems.map((item) => (
            <Link
              key={item.label}
              href={item.href}
              className="dashboard-revenue-metric"
              title={item.help}
              aria-label={item.help ? `${item.label}. ${item.help}` : item.label}
              style={{ minHeight: 118, pointerEvents: isLoading ? 'none' : 'auto' }}
            >
              <span className="dashboard-revenue-metric-label">{item.label}</span>
              <strong className="dashboard-revenue-metric-value">{item.value}</strong>
              {item.help ? (
                <span className="dashboard-revenue-metric-desc muted">{item.help}</span>
              ) : null}
            </Link>
          ))}
        </div>
      </div>

      {showDebug && showFinanceDebug && debug ? (
        <div
          className="card"
          style={{ marginTop: 24, padding: 16, background: 'var(--surface-muted, #f8fafc)' }}
          aria-label="Finance debug breakdown"
        >
          <h3 style={{ marginTop: 0 }}>Finance debug · {rangeLabel}</h3>
          <p className="muted" style={{ marginTop: 0 }}>
            Period window: {debug.start || '—'} → {debug.end || '—'} (end exclusive). Developer only.
          </p>
          <DebugRow label="Invoice revenue" value={formatCurrency(debug.invoiceRevenue)} note="Collectible invoice totals attributed to this period" />
          <DebugRow label="Invoice payments" value={formatCurrency(debug.invoicePayments)} note="Ledger + legacy invoice payments by paid_at" />
          <DebugRow label="Direct job payments" value={formatCurrency(debug.directJobPayments)} note="job_payments excluding jobs that already have an invoice" />
          <DebugRow label="Collected" value={formatCurrency(debug.collected)} note="Invoice payments + direct job payments" />
          <DebugRow label="Outstanding (period)" value={formatCurrency(debug.periodOutstanding)} note="Open balances for work in this period" />
          <DebugRow label="Outstanding (lifetime)" value={formatCurrency(debug.lifetimeOutstanding)} note="All open AR right now" />
          <DebugRow label="Unbilled revenue" value={formatCurrency(debug.unbilledRevenue)} />
          <DebugRow label="Contractor labor (paid)" value={formatCurrency(debug.contractorLaborPaid)} note="payment_status=paid and paid_at in period" />
          <DebugRow label="Contractor labor (unpaid, period)" value={formatCurrency(debug.contractorLaborUnpaidPeriod)} />
          <DebugRow label="Contractor labor (unpaid, lifetime)" value={formatCurrency(debug.contractorLaborUnpaidLifetime)} />
          <DebugRow label="Contractor labor (accrued)" value={formatCurrency(debug.contractorLaborAccrued)} note="Used in Expected Profit" />
          <DebugRow label="Business expenses" value={formatCurrency(debug.businessExpenses)} />
          <DebugRow label="Expected revenue" value={formatCurrency(debug.expectedRevenue)} note="Invoice revenue + unbilled revenue" />
          <DebugRow label="Expected profit" value={formatCurrency(debug.expectedProfit)} note={debug.expectedProfitFormula} />
          <DebugRow label="Cash available" value={formatCurrency(debug.cashAvailable)} note="Collected − contractor paid − expenses" />
        </div>
      ) : null}
    </section>
  );
}
