'use client';

import { useEffect, useState } from 'react';
import { SimpleBarChart, SimpleTrendChart } from '@/components/charts/simple-bar-chart';

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
};

export function ExecutiveMetricsPanel() {
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

  const subscriptionPoints = Object.entries(metrics.subscriptionBreakdown).map(([label, value]) => ({
    label,
    value
  }));

  return (
    <section className="executive-metrics">
      <h3>Executive overview</h3>
      <p className="muted">Organization performance based on your workspace data.</p>

      <div className="stats-grid executive-stats">
        <div className="stat-card">
          <span>MRR</span>
          <strong>${metrics.mrrUsd}</strong>
        </div>
        <div className="stat-card">
          <span>ARR</span>
          <strong>${metrics.arrUsd}</strong>
        </div>
        <div className="stat-card">
          <span>Active users</span>
          <strong>{metrics.activeUsers}</strong>
        </div>
        <div className="stat-card">
          <span>Jobs this month</span>
          <strong>{metrics.monthlyJobs}</strong>
        </div>
        <div className="stat-card">
          <span>Technician utilization</span>
          <strong>{metrics.technicianUtilizationPct}%</strong>
        </div>
        <div className="stat-card">
          <span>Revenue growth</span>
          <strong>{metrics.revenueGrowthPct}%</strong>
        </div>
        <div className="stat-card">
          <span>Client portal activity (30d)</span>
          <strong>{metrics.clientPortalViews30d}</strong>
        </div>
        <div className="stat-card">
          <span>Report completion rate</span>
          <strong>{metrics.reportCompletionRatePct}%</strong>
        </div>
      </div>

      <div className="charts-grid">
        <SimpleTrendChart title="Jobs trend (6 months)" points={metrics.jobsTrend} />
        <SimpleTrendChart title="Revenue trend (6 months)" points={metrics.revenueTrend} />
        <SimpleTrendChart title="Team growth (6 months)" points={metrics.growthTrend} />
        {subscriptionPoints.length > 0 ? (
          <SimpleBarChart title="Subscription breakdown" points={subscriptionPoints} />
        ) : null}
      </div>
    </section>
  );
}
