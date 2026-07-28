'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import {
  EXPECTED_PROFIT_FORMULA,
  formatCurrency,
  type DashboardRevenueMetrics,
  type FinanceDebugBreakdown
} from '@/lib/dashboard-metrics';
import { DASHBOARD_LINKS } from '@/lib/dashboard-links';

type DashboardRevenueSnapshotProps = {
  metrics: DashboardRevenueMetrics;
  todayJobs: number;
  loading?: boolean;
};

type MetricItem = {
  label: string;
  value: string;
  href: string;
  help?: string;
};

function canShowFinanceDebug(searchParams: URLSearchParams | null): boolean {
  if (process.env.NODE_ENV === 'development') return true;
  if (process.env.NEXT_PUBLIC_FINANCE_DEBUG === '1') return true;
  return searchParams?.get('finance_debug') === '1';
}

function DebugRow({ label, value }: { label: string; value: string }) {
  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        gap: 12,
        padding: '6px 0',
        borderBottom: '1px solid var(--border, #e5e7eb)'
      }}
    >
      <span>{label}</span>
      <code style={{ whiteSpace: 'nowrap' }}>{value}</code>
    </div>
  );
}

export function DashboardRevenueSnapshot({ metrics, todayJobs, loading }: DashboardRevenueSnapshotProps) {
  const searchParams = useSearchParams();
  const [showFinancialDetails, setShowFinancialDetails] = useState(false);
  const [showFinanceDebug, setShowFinanceDebug] = useState(false);
  const showDebug = canShowFinanceDebug(searchParams);

  useEffect(() => {
    setShowFinancialDetails(false);
  }, [metrics]);

  const collected = metrics.paidToYou ?? metrics.cashCollected ?? 0;
  const outstanding = metrics.stillOwed ?? metrics.pendingIncoming ?? metrics.outstandingInvoices ?? 0;
  const available =
    metrics.cashAfterPaidCosts ?? metrics.cashAfterExpenses ?? metrics.netCashFlow ?? 0;
  const contractorPaid = metrics.contractorPaymentsPaid || 0;
  const contractorsOwed = metrics.unpaidContractorPay || 0;
  const unbilled = metrics.uninvoicedCompletedWork ?? 0;
  const expectedRevenue = metrics.expectedRevenue ?? 0;
  const expectedProfit = metrics.estimatedProfit ?? metrics.netEstimateThisMonth ?? 0;
  const expenses = metrics.otherExpensesThisMonth || 0;

  const primaryItems: MetricItem[] = [
    {
      label: 'Collected',
      value: formatCurrency(collected),
      href: DASHBOARD_LINKS.paidToYou,
      help: 'Money received from customers'
    },
    {
      label: 'Outstanding',
      value: formatCurrency(outstanding),
      href: DASHBOARD_LINKS.stillOwed,
      help: 'Money customers still owe'
    },
    {
      label: 'Available',
      value: formatCurrency(available),
      href: DASHBOARD_LINKS.cashAfterExpenses,
      help: 'Money available after contractor payments and expenses already paid'
    },
    {
      label: "Today's Jobs",
      value: String(todayJobs),
      href: '/schedule',
      help: 'Jobs scheduled for today'
    }
  ];

  const detailItems: MetricItem[] = [
    {
      label: 'Paid to Contractors',
      value: formatCurrency(contractorPaid),
      href: DASHBOARD_LINKS.contractorPay
    },
    {
      label: 'Contractors Owed',
      value: formatCurrency(contractorsOwed),
      href: DASHBOARD_LINKS.contractorPayOwed
    },
    {
      label: 'Unbilled Revenue',
      value: formatCurrency(unbilled),
      href: DASHBOARD_LINKS.completedJobs
    },
    {
      label: 'Expected Revenue',
      value: formatCurrency(expectedRevenue),
      href: DASHBOARD_LINKS.estimatedProfit
    },
    {
      label: 'Expected Profit',
      value: formatCurrency(expectedProfit),
      href: DASHBOARD_LINKS.estimatedProfit
    },
    {
      label: 'Expenses',
      value: formatCurrency(expenses),
      href: DASHBOARD_LINKS.otherExpenses
    }
  ];

  const debug: FinanceDebugBreakdown | null = useMemo(() => {
    if (!showDebug) return null;
    return (
      metrics.financeDebug || {
        range: 'month',
        start: null,
        end: null,
        invoiceRevenue: metrics.customerInvoices || 0,
        directJobPayments: metrics.directJobPaymentsInPeriod || 0,
        invoicePayments: metrics.invoicePaymentsInPeriod || 0,
        collected,
        outstandingInvoices: outstanding,
        periodOutstanding: metrics.periodOutstanding || 0,
        lifetimeOutstanding: outstanding,
        unbilledRevenue: unbilled,
        contractorLaborPaid: contractorPaid,
        contractorLaborUnpaidPeriod: metrics.periodUnpaidContractorPay || 0,
        contractorLaborUnpaidLifetime: contractorsOwed,
        contractorLaborAccrued: metrics.contractorPayThisMonth || 0,
        businessExpenses: expenses,
        expectedRevenue,
        expectedProfit,
        cashAvailable: available,
        expectedProfitFormula: EXPECTED_PROFIT_FORMULA
      }
    );
  }, [
    showDebug,
    metrics,
    collected,
    outstanding,
    unbilled,
    contractorPaid,
    contractorsOwed,
    expenses,
    expectedRevenue,
    expectedProfit,
    available
  ]);

  return (
    <section aria-label="Dashboard" aria-busy={Boolean(loading)} style={{ minHeight: 0 }}>
      {loading ? (
        <p className="loading-state" role="status" style={{ margin: '0 0 12px' }}>
          Loading…
        </p>
      ) : null}

      {!loading && metrics.loadFailed ? (
        <p className="muted" role="alert" style={{ margin: '0 0 12px' }}>
          Some totals could not load. Refresh and try again.
        </p>
      ) : null}

      <div className="dashboard-revenue-grid" style={{ opacity: loading ? 0.58 : 1 }}>
        {primaryItems.map((item) => (
          <Link
            key={item.label}
            href={item.href}
            className="dashboard-revenue-metric is-primary"
            title={item.help}
            aria-label={item.help ? `${item.label}. ${item.help}` : item.label}
            style={{ minHeight: 120, pointerEvents: loading ? 'none' : 'auto' }}
          >
            <span className="dashboard-revenue-metric-label">{item.label}</span>
            <strong className="dashboard-revenue-metric-value">{item.value}</strong>
          </Link>
        ))}
      </div>

      <div style={{ marginTop: 20 }}>
        <button
          type="button"
          className="button secondary"
          onClick={() => setShowFinancialDetails((current) => !current)}
          disabled={Boolean(loading)}
          aria-expanded={showFinancialDetails}
        >
          Financial Details
        </button>
        {showDebug ? (
          <button
            type="button"
            className="button secondary"
            style={{ marginLeft: 8 }}
            onClick={() => setShowFinanceDebug((current) => !current)}
            disabled={Boolean(loading)}
          >
            Debug
          </button>
        ) : null}
      </div>

      {showFinancialDetails ? (
        <div className="dashboard-revenue-grid" style={{ marginTop: 16, opacity: loading ? 0.58 : 1 }}>
          {detailItems.map((item) => (
            <Link
              key={item.label}
              href={item.href}
              className="dashboard-revenue-metric"
              aria-label={item.label}
              style={{ minHeight: 108, pointerEvents: loading ? 'none' : 'auto' }}
            >
              <span className="dashboard-revenue-metric-label">{item.label}</span>
              <strong className="dashboard-revenue-metric-value">{item.value}</strong>
            </Link>
          ))}
        </div>
      ) : null}

      {showDebug && showFinanceDebug && debug ? (
        <div style={{ marginTop: 20, paddingTop: 12 }} aria-label="Finance debug">
          <p className="muted" style={{ marginTop: 0, fontSize: 13 }}>
            {debug.expectedProfitFormula}
          </p>
          <DebugRow label="Invoice revenue" value={formatCurrency(debug.invoiceRevenue)} />
          <DebugRow label="Direct job payments" value={formatCurrency(debug.directJobPayments)} />
          <DebugRow label="Outstanding" value={formatCurrency(debug.lifetimeOutstanding)} />
          <DebugRow label="Unbilled revenue" value={formatCurrency(debug.unbilledRevenue)} />
          <DebugRow label="Contractor labor (paid)" value={formatCurrency(debug.contractorLaborPaid)} />
          <DebugRow label="Contractor labor (unpaid)" value={formatCurrency(debug.contractorLaborUnpaidLifetime)} />
          <DebugRow label="Business expenses" value={formatCurrency(debug.businessExpenses)} />
          <DebugRow label="Expected revenue" value={formatCurrency(debug.expectedRevenue)} />
          <DebugRow label="Expected profit" value={formatCurrency(debug.expectedProfit)} />
          <DebugRow label="Cash available" value={formatCurrency(debug.cashAvailable)} />
        </div>
      ) : null}
    </section>
  );
}
