'use client';

import { useEffect, useState } from 'react';
import { EmptyState } from '@/components/empty-state';
import { SimpleBarChart, SimpleTrendChart } from '@/components/charts/simple-bar-chart';
import { useTranslation } from '@/components/locale-provider';

export type OrgMetrics = {
  mrrUsd: number;
  arrUsd: number;
  activeUsers: number;
  monthlyJobs: number;
  technicianUtilizationPct: number;
  revenueGrowthPct: number;
  clientPortalViews30d: number;
  reportCompletionRatePct: number;
  subscriptionBreakdown: Record<string, number>;
  jobsTrend: { label: string; value: number }[];
  revenueTrend: { label: string; value: number }[];
  growthTrend: { label: string; value: number }[];
  hasActivity?: boolean;
};

function trendHasData(points: { value: number }[]): boolean {
  return points.some((p) => p.value > 0);
}

export function ExecutiveMetricsPanel() {
  const { t } = useTranslation();
  const [metrics, setMetrics] = useState<OrgMetrics | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const res = await fetch('/api/org/metrics');
      const json = await res.json();
      setLoading(false);
      if (!res.ok) {
        setError(json.error || 'Unable to load executive metrics.');
        return;
      }
      setMetrics(json);
    }
    load();
  }, []);

  if (loading) return <p className="muted">Loading executive metrics…</p>;
  if (error) return <p className="auth-message auth-message-error">{error}</p>;
  if (!metrics) return null;

  if (!metrics.hasActivity) {
    return (
      <EmptyState
        title="No metrics yet"
        description={t('dashboard.metricsEmpty')}
      />
    );
  }

  const subscriptionPoints = Object.entries(metrics.subscriptionBreakdown).map(([label, value]) => ({
    label,
    value
  }));

  const showJobsTrend = trendHasData(metrics.jobsTrend);
  const showRevenueTrend = trendHasData(metrics.revenueTrend);
  const showGrowthTrend = trendHasData(metrics.growthTrend);

  return (
    <section className="executive-metrics">
      <h3 className="card-title-sm">Executive overview</h3>
      <p className="muted">Organization performance from your workspace data.</p>

      <div className="stats-grid executive-stats">
        <div className="stat-card">
          <span>Active users</span>
          <strong>{metrics.activeUsers}</strong>
        </div>
        <div className="stat-card">
          <span>Jobs this month</span>
          <strong>{metrics.monthlyJobs}</strong>
        </div>
        <div className="stat-card">
          <span>Report completion</span>
          <strong>{metrics.reportCompletionRatePct}%</strong>
        </div>
        <div className="stat-card">
          <span>Client portal views (30d)</span>
          <strong>{metrics.clientPortalViews30d}</strong>
        </div>
        {metrics.mrrUsd > 0 ? (
          <div className="stat-card">
            <span>Plan MRR</span>
            <strong>${metrics.mrrUsd}</strong>
          </div>
        ) : null}
      </div>

      {(showJobsTrend || showRevenueTrend || showGrowthTrend || subscriptionPoints.length > 0) && (
        <div className="charts-grid">
          {showJobsTrend ? <SimpleTrendChart title="Jobs trend (6 months)" points={metrics.jobsTrend} /> : null}
          {showRevenueTrend ? <SimpleTrendChart title="Plan revenue (monthly)" points={metrics.revenueTrend} /> : null}
          {showGrowthTrend ? <SimpleTrendChart title="Team size over time" points={metrics.growthTrend} /> : null}
          {subscriptionPoints.length > 0 ? (
            <SimpleBarChart title="Plan distribution" points={subscriptionPoints} />
          ) : null}
        </div>
      )}
    </section>
  );
}
