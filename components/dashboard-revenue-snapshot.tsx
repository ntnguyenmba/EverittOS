'use client';

import Link from 'next/link';
import { useTranslation } from '@/components/locale-provider';
import { formatCurrency, type DashboardRevenueMetrics } from '@/lib/dashboard-metrics';

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

export function DashboardRevenueSnapshot({ metrics, loading }: DashboardRevenueSnapshotProps) {
  const { t } = useTranslation();
  const revenue = metrics.revenueThisMonth || 0;
  const contractorPay = metrics.contractorPayThisMonth || 0;
  const unpaidContractorPay = metrics.unpaidContractorPay || 0;
  const pendingContractorPay = metrics.pendingContractorPay || 0;
  const otherExpenses = metrics.otherExpensesThisMonth || 0;
  const netProfit = metrics.netEstimateThisMonth || 0;
  const hasRecordedCosts = contractorPay > 0 || otherExpenses > 0;
  const profitMargin = hasRecordedCosts && revenue > 0 ? (netProfit / revenue) * 100 : null;
  const comparisonBase = Math.max(revenue, contractorPay, otherExpenses, hasRecordedCosts ? Math.abs(netProfit) : 0, 1);

  const financialBreakdown: FinancialBreakdownItem[] = [
    { label: 'Client income', value: revenue, displayValue: formatCurrency(revenue), href: '/analytics' },
    { label: 'Contractor pay', value: contractorPay, displayValue: contractorPay > 0 ? formatCurrency(contractorPay) : 'Not entered', href: '/jobs' },
    { label: 'Other expenses', value: otherExpenses, displayValue: formatCurrency(otherExpenses), href: '/expenses' },
    {
      label: 'Gross profit',
      value: hasRecordedCosts ? netProfit : null,
      displayValue: hasRecordedCosts ? formatCurrency(netProfit) : 'Pending costs',
      href: '/analytics'
    }
  ];

  const items = [
    {
      label: t('dashboard.revenue.revenueMonth'),
      value: formatCurrency(revenue),
      href: '/analytics'
    },
    {
      label: 'Contractor pay this month',
      value: contractorPay > 0 ? formatCurrency(contractorPay) : 'Not entered',
      href: '/jobs'
    },
    {
      label: 'Unpaid contractor pay',
      value: formatCurrency(unpaidContractorPay),
      href: '/jobs'
    },
    {
      label: 'Pending contractor pay',
      value: formatCurrency(pendingContractorPay),
      href: '/jobs'
    },
    {
      label: 'Other expenses this month',
      value: formatCurrency(otherExpenses),
      href: '/expenses'
    },
    {
      label: 'Gross profit',
      value: hasRecordedCosts ? formatCurrency(netProfit) : 'Pending costs',
      href: '/analytics'
    },
    {
      label: 'Profit margin',
      value: profitMargin === null ? 'Pending contractor pay' : `${profitMargin.toFixed(1)}%`,
      href: '/analytics'
    },
    {
      label: t('dashboard.revenue.outstanding'),
      value: formatCurrency(metrics.outstandingInvoices),
      href: '/invoices'
    },
    {
      label: t('dashboard.revenue.overdueInvoices'),
      value: String(metrics.overdueInvoiceCount),
      href: '/invoices'
    },
    {
      label: t('dashboard.revenue.jobsCompleted'),
      value: String(metrics.jobsCompleted),
      href: '/jobs?status=completed'
    },
    {
      label: t('dashboard.revenue.completedThisMonth'),
      value: String(metrics.jobsCompletedThisMonth),
      href: '/jobs?status=completed'
    },
    {
      label: t('dashboard.revenue.upcomingJobs'),
      value: String(metrics.upcomingJobs),
      href: '/schedule'
    },
    {
      label: t('dashboard.revenue.activeCustomers'),
      value: String(metrics.activeCustomers),
      href: '/customers'
    },
    {
      label: t('dashboard.revenue.expensesMonth'),
      value: formatCurrency(metrics.expenseTotalThisMonth),
      href: '/expenses'
    },
    {
      label: t('dashboard.revenue.bookingsMonth'),
      value: String(metrics.bookingCountThisMonth),
      href: '/bookings'
    },
    {
      label: t('dashboard.revenue.messagesCount'),
      value: String(metrics.messageCount),
      href: '/messages'
    },
    {
      label: t('dashboard.revenue.reportsCount'),
      value: String(metrics.reportCount),
      href: '/jobs'
    }
  ];

  return (
    <section className="card dashboard-today-card" aria-label={t('dashboard.revenue.title')}>
      <div className="dashboard-section-head">
        <h2>{t('dashboard.revenue.title')}</h2>
        <Link href="/analytics" className="dashboard-section-link">
          {t('dashboard.revenue.viewAnalytics')}
        </Link>
      </div>
      {loading ? <p className="loading-state" role="status">{t('common.loading')}</p> : null}
      {!loading ? (
        <>
          <div className="settings-card" style={{ marginBottom: 18 }}>
            <div className="job-financials-head">
              <div>
                <h3>Income versus costs</h3>
                <p className="muted">A quick comparison of this month&apos;s client income, contractor pay, other expenses, and gross profit.</p>
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
                          background: item.value !== null && item.value < 0 ? 'var(--danger, currentColor)' : 'var(--accent, currentColor)',
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
