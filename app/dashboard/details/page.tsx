'use client';

import Link from 'next/link';
import { Suspense, useCallback, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { AppShell } from '@/components/app-shell';
import { useTranslation } from '@/components/locale-provider';
import { PageHeader } from '@/components/page-header';
import type { DashboardDetailResult } from '@/lib/dashboard-metric-details';
import { isDashboardDetailMetric } from '@/lib/dashboard-metric-details';
import type { DashboardDateRange } from '@/lib/dashboard-metrics';
import { formatCurrency } from '@/lib/finance-format';

const RANGES: Array<{ id: DashboardDateRange; label: string }> = [
  { id: 'month', label: 'This month' },
  { id: 'quarter', label: 'This quarter' },
  { id: 'year', label: 'This year' },
  { id: 'last_year', label: 'Last year' },
  { id: 'all_time', label: 'All time' }
];

function formatTotal(details: DashboardDetailResult, metric: string) {
  if (metric === 'jobs' || metric === 'completed-jobs' || metric === 'active-customers') {
    return String(details.total);
  }
  return formatCurrency(details.total);
}

function DashboardMetricDetailsContent() {
  const { t } = useTranslation();
  const router = useRouter();
  const searchParams = useSearchParams();
  const metricParam = searchParams.get('metric');
  const rangeParam = (searchParams.get('range') || 'month') as DashboardDateRange;

  const metric = isDashboardDetailMetric(metricParam) ? metricParam : null;
  const range = RANGES.some((item) => item.id === rangeParam) ? rangeParam : 'month';

  const [details, setDetails] = useState<DashboardDetailResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const setRange = useCallback(
    (nextRange: DashboardDateRange) => {
      if (!metric) return;
      const params = new URLSearchParams();
      params.set('metric', metric);
      params.set('range', nextRange);
      router.replace(`/dashboard/details?${params.toString()}`);
    },
    [metric, router]
  );

  useEffect(() => {
    if (!metric) {
      setLoading(false);
      setError('Unknown dashboard metric.');
      setDetails(null);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    void (async () => {
      const res = await fetch(
        `/api/dashboard/details?metric=${encodeURIComponent(metric)}&range=${encodeURIComponent(range)}`
      );
      const json = await res.json().catch(() => ({}));
      if (cancelled) return;
      if (!res.ok) {
        setError(json.error || 'Unable to load metric details.');
        setDetails(null);
        setLoading(false);
        return;
      }
      setDetails(json.details as DashboardDetailResult);
      setLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [metric, range]);

  return (
    <AppShell>
      <PageHeader
        title={details?.title || 'Metric details'}
        subtitle={
          details
            ? `${details.rangeLabel}. Exact total: ${formatTotal(details, metric || '')}`
            : 'See the records behind each dashboard total.'
        }
      />

      <div className="job-detail-actions" style={{ marginBottom: 16, flexWrap: 'wrap', gap: 8 }}>
        <Link className="btn" href="/dashboard">
          {t('common.back')}
        </Link>
        {RANGES.map((item) => (
          <button
            key={item.id}
            type="button"
            className={range === item.id ? 'btn btn-primary' : 'btn'}
            onClick={() => setRange(item.id)}
            aria-pressed={range === item.id}
          >
            {item.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="card" role="status" aria-live="polite">
          <p className="muted">{t('common.loading')}</p>
        </div>
      ) : null}

      {!loading && error ? (
        <div className="card" role="alert">
          <p>{error}</p>
          <button
            type="button"
            className="btn"
            onClick={() => {
              setLoading(true);
              setError(null);
              router.replace(
                `/dashboard/details?metric=${encodeURIComponent(metric || '')}&range=${encodeURIComponent(range)}`
              );
            }}
          >
            Try again
          </button>
        </div>
      ) : null}

      {!loading && !error && details ? (
        <>
          <div className="card" style={{ marginBottom: 16 }}>
            <p style={{ margin: 0, fontSize: 28, fontWeight: 700, overflowWrap: 'anywhere' }}>
              {formatTotal(details, metric || '')}
            </p>
            <p className="muted" style={{ marginTop: 8 }}>
              {details.formula}
            </p>
          </div>

          {details.sections.map((section) => (
            <section key={section.id} className="card" style={{ marginBottom: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                <div>
                  <h2 style={{ margin: 0, fontSize: 18 }}>{section.title}</h2>
                  <p className="muted" style={{ margin: '6px 0 0' }}>
                    {section.formula}
                  </p>
                </div>
                <strong style={{ overflowWrap: 'anywhere' }}>{section.totalLabel}</strong>
              </div>

              {section.rows.length === 0 ? (
                <p className="muted" style={{ marginTop: 16 }}>
                  No records in this period.
                </p>
              ) : (
                <ul className="finance-list" style={{ listStyle: 'none', padding: 0, marginTop: 16 }}>
                  {section.rows.map((row) => (
                    <li key={row.id} className="finance-list-card" style={{ marginBottom: 10 }}>
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <Link href={row.href} style={{ fontWeight: 600, overflowWrap: 'anywhere' }}>
                          {row.title}
                        </Link>
                        {row.subtitle ? (
                          <p className="muted" style={{ margin: '6px 0 0', overflowWrap: 'anywhere' }}>
                            {row.subtitle}
                          </p>
                        ) : null}
                        {row.meta ? (
                          <p className="muted" style={{ margin: '4px 0 0', overflowWrap: 'anywhere' }}>
                            {row.meta}
                          </p>
                        ) : null}
                      </div>
                      <div style={{ textAlign: 'right', flexShrink: 0 }}>
                        {row.amountLabel ? (
                          <strong style={{ overflowWrap: 'anywhere' }}>{row.amountLabel}</strong>
                        ) : null}
                        {row.badge ? (
                          <p className="muted" style={{ margin: '4px 0 0', fontSize: 12 }}>
                            {row.badge}
                          </p>
                        ) : null}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          ))}
        </>
      ) : null}
    </AppShell>
  );
}

export default function DashboardMetricDetailsPage() {
  return (
    <Suspense
      fallback={
        <AppShell>
          <div className="card">
            <p className="muted">Loading…</p>
          </div>
        </AppShell>
      }
    >
      <DashboardMetricDetailsContent />
    </Suspense>
  );
}
