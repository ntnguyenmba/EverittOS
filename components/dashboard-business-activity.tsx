'use client';

import Link from 'next/link';
import { useTranslation } from '@/components/locale-provider';
import { formatDashboardActivity, type ActivityLogRow } from '@/lib/business-activity';

type DashboardBusinessActivityProps = {
  items: ActivityLogRow[];
  loading?: boolean;
  showViewAll?: boolean;
};

export function DashboardBusinessActivity({ items, loading, showViewAll }: DashboardBusinessActivityProps) {
  const { t } = useTranslation();
  const formatted = items.map(formatDashboardActivity);

  return (
    <section className="card dashboard-today-card" aria-label={t('dashboard.businessActivity')}>
      <div className="dashboard-section-head">
        <h2>{t('dashboard.businessActivity')}</h2>
        {showViewAll ? (
          <Link href="/activity" className="dashboard-section-link">
            {t('dashboard.viewActivity')}
          </Link>
        ) : null}
      </div>
      {loading ? <p className="loading-state" role="status">{t('common.loading')}</p> : null}
      {!loading && formatted.length === 0 ? (
        <p className="dashboard-quiet-empty">{t('dashboard.businessActivityEmpty')}</p>
      ) : null}
      {!loading &&
        formatted.map((row) => {
          const content = (
            <>
              <div className="dashboard-activity-copy">
                <span className="dashboard-activity-title">{row.title}</span>
                {row.subtitle ? <span className="dashboard-activity-subtitle">{row.subtitle}</span> : null}
              </div>
              {row.detail ? <span className="muted dashboard-activity-detail">{row.detail}</span> : null}
            </>
          );

          if (row.href) {
            return (
              <Link key={row.id} href={row.href} className="dashboard-today-row dashboard-activity-row">
                {content}
              </Link>
            );
          }

          return (
            <div key={row.id} className="dashboard-today-row dashboard-activity-row">
              {content}
            </div>
          );
        })}
    </section>
  );
}
