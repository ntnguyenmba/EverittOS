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

  const items = [
    {
      label: t('dashboard.revenue.revenueMonth'),
      value: formatCurrency(metrics.revenueThisMonth),
      href: '/analytics'
    },
    {
      label: t('dashboard.revenue.outstanding'),
      value: formatCurrency(metrics.outstandingInvoices),
      href: '/analytics'
    },
    {
      label: t('dashboard.revenue.jobsCompleted'),
      value: String(metrics.jobsCompleted),
      href: '/jobs?status=completed'
    },
    {
      label: t('dashboard.revenue.activeCustomers'),
      value: String(metrics.activeCustomers),
      href: '/customers'
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
