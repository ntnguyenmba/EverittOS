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
import { getDashboardFinanceCopy } from '@/lib/i18n/dashboard-finance-copy';

const RANGE_IDS: DashboardDateRange[] = ['month', 'quarter', 'year', 'last_year', 'all_time'];

function formatTotal(details: DashboardDetailResult, metric: string) {
  if (metric === 'jobs' || metric === 'completed-jobs' || metric === 'active-customers') {
    return String(details.total);
  }
  return formatCurrency(details.total);
}

function DashboardMetricDetailsContent() {
  const { t, locale } = useTranslation();
  const copy = getDashboardFinanceCopy(locale);
  const router = useRouter();
  const searchParams = useSearchParams();
  const metricParam = searchParams.get('metric');
  const rangeParam = (searchParams.get('range') || 'month') as DashboardDateRange;

  const metric = isDashboardDetailMetric(metricParam) ? metricParam : null;
  const range = RANGE_IDS.includes(rangeParam) ? rangeParam : 'month';

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
      setError(copy.details.unknownMetric);
      setDetails(null);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    void (async () => {
      const res = await fetch(
        `/api/dashboard/details?metric=${encodeURIComponent(metric)}&range=${encodeURIComponent(range)}&locale=${encodeURIComponent(locale)}`
      );
      const json = await res.json().catch(() => ({}));
      if (cancelled) return;
      if (!res.ok) {
        setError(json.error || copy.details.loadError);
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
  }, [metric, range, locale, copy.details.unknownMetric, copy.details.loadError]);

  return (
    <AppShell>
      <PageHeader
        title={details?.title || copy.metricTitles[metric || 'collected'] || copy.details.titleFallback}
        subtitle={
          details
            ? `${details.rangeLabel}. ${copy.details.exactTotal}: ${formatTotal(details, metric || '')}`
            : copy.details.subtitle
        }
      />

      <div className="job-detail-actions" style={{ marginBottom: 16, flexWrap: 'wrap', gap: 8 }}>
        <Link className="btn" href="/dashboard">
          {t('common.back')}
        </Link>
        {RANGE_IDS.map((id) => (
          <button
            key={id}
            type="button"
            className={range === id ? 'btn btn-primary' : 'btn'}
            onClick={() => setRange(id)}
            aria-pressed={range === id}
          >
            {copy.ranges[id]}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="card" role="status" aria-live="polite">
          <p className="muted">{copy.details.loading}</p>
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
            {copy.details.tryAgain}
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
              {details.formula || (metric ? copy.formulas[metric] : '')}
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
                  {copy.details.empty}
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
