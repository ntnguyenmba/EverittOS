'use client';

import Link from 'next/link';
import { useTranslation } from '@/components/locale-provider';
import { formatCurrency, type DashboardRevenueMetrics } from '@/lib/dashboard-metrics';

type DashboardRevenueSnapshotProps = {
  metrics: DashboardRevenueMetrics;
  loading?: boolean;
};

export function DashboardRevenueSnapshot({ metrics, loading }: DashboardRevenueSnapshotProps) {
  const { t } = useTranslation();
  const revenue = metrics.revenueThisMonth || 0;
  const profitMargin = revenue > 0 ? (metrics.netEstimateThisMonth / revenue) * 100 : 0;

  const items = [
    {
      label: t('dashboard.revenue.revenueMonth'),
      value: formatCurrency(revenue),
      href: '/analytics'
    },
    {
      label: 'Contractor pay this month',
      value: formatCurrency(metrics.contractorPayThisMonth || 0),
      href: '/jobs'
    },
    {
      label: 'Other expenses this month',
      value: formatCurrency(metrics.otherExpensesThisMonth || 0),
      href: '/expenses'
    },
    {
      label: t('dashboard.revenue.netEstimate'),
      value: formatCurrency(metrics.netEstimateThisMonth),
      href: '/analytics'
    },
    {
      label: 'Estimated profit margin',
      value: `${profitMargin.toFixed(1)}%`,
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
        <div className="dashboard-revenue-grid">
          {items.map((item) => (
            <Link key={item.label} href={item.href} className="dashboard-revenue-metric">
              <span className="dashboard-revenue-metric-label">{item.label}</span>
              <strong className="dashboard-revenue-metric-value">{item.value}</strong>
            </Link>
          ))}
        </div>
      ) : null}
    </section>
  );
}
