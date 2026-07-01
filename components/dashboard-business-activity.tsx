'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useTranslation } from '@/components/locale-provider';
import { formatDashboardActivity, type ActivityLogRow } from '@/lib/business-activity';

const BUSINESS_ACTIVITY_STORAGE_KEY = 'everittos.dashboard.businessActivity.collapsed.v1';

type DashboardBusinessActivityProps = {
  items: ActivityLogRow[];
  loading?: boolean;
  showViewAll?: boolean;
};

export function DashboardBusinessActivity({ items, loading, showViewAll }: DashboardBusinessActivityProps) {
  const { t } = useTranslation();
  const formatted = items.map(formatDashboardActivity);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(BUSINESS_ACTIVITY_STORAGE_KEY);
      setOpen(saved ? saved === 'open' : false);
    } catch {
      setOpen(false);
    }
  }, []);

  function toggleOpen() {
    setOpen((current) => {
      const next = !current;
      try {
        window.localStorage.setItem(BUSINESS_ACTIVITY_STORAGE_KEY, next ? 'open' : 'closed');
      } catch {
        // Keep the UI usable even if localStorage is unavailable.
      }
      return next;
    });
  }

  return (
    <section className="card dashboard-today-card" aria-label={t('dashboard.businessActivity')}>
      <div className="dashboard-section-head">
        <button
          type="button"
          aria-expanded={open}
          aria-controls="dashboard-business-activity-panel"
          onClick={toggleOpen}
          style={{
            alignItems: 'center',
            background: 'transparent',
            border: 0,
            color: 'inherit',
            cursor: 'pointer',
            display: 'flex',
            gap: 10,
            padding: 0,
            textAlign: 'left'
          }}
        >
          <h2>{t('dashboard.businessActivity')}</h2>
          <span aria-hidden="true" style={{ transform: open ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 200ms ease' }}>
            v
          </span>
        </button>
        {showViewAll ? (
          <Link href="/activity" className="dashboard-section-link">
            {t('dashboard.viewActivity')}
          </Link>
        ) : null}
      </div>
      <div
        id="dashboard-business-activity-panel"
        style={{
          display: 'grid',
          gridTemplateRows: open ? '1fr' : '0fr',
          transition: 'grid-template-rows 250ms ease'
        }}
      >
        <div style={{ overflow: 'hidden' }}>
          {open ? (
            <div style={{ paddingTop: 12 }}>
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
            </div>
          ) : null}
        </div>
      </div>
    </section>
  );
}
