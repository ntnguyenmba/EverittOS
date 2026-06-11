'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AuthenticatedSection } from '@/components/authenticated-section';
import { PermissionDenied } from '@/components/permission-denied';
import type { PlatformMetrics } from '@/lib/platform-metrics';

export default function AdminMetricsPage() {
  const router = useRouter();
  const [metrics, setMetrics] = useState<PlatformMetrics | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const res = await fetch('/api/admin/metrics');
      const json = await res.json();
      setLoading(false);
      if (res.status === 401) {
        router.push('/login?next=/admin/metrics');
        return;
      }
      if (!res.ok) {
        setError(json.error || 'Unable to load investor metrics.');
        return;
      }
      setMetrics(json);
    }
    load();
  }, [router]);

  if (loading) {
    return (
      <AuthenticatedSection>
        <div className="card">Loading investor metrics...</div>
      </AuthenticatedSection>
    );
  }

  if (error) {
    return (
      <AuthenticatedSection>
        <PermissionDenied message={error} />
      </AuthenticatedSection>
    );
  }

  if (!metrics) return null;

  return (
    <AuthenticatedSection>
        <div className="page-head-inline">
          <div>
            <h1>Investor metrics</h1>
            <p className="muted">Platform-wide KPIs for funding discussions. Restricted to platform operators.</p>
          </div>
          <a className="btn btn-primary" href="/api/admin/metrics/export">
            Export CSV
          </a>
        </div>

        <div className="stats-grid" style={{ marginTop: 24 }}>
          <div className="stat-card">
            <span>MRR</span>
            <strong>${metrics.mrrEstimateUsd}</strong>
          </div>
          <div className="stat-card">
            <span>ARR</span>
            <strong>${metrics.arrEstimateUsd}</strong>
          </div>
          <div className="stat-card">
            <span>Total customers (users)</span>
            <strong>{metrics.totalUsers}</strong>
          </div>
          <div className="stat-card">
            <span>Active customers (paid)</span>
            <strong>{metrics.activeCustomers}</strong>
          </div>
          <div className="stat-card">
            <span>Churn rate</span>
            <strong>{metrics.churnRatePct}%</strong>
          </div>
          <div className="stat-card">
            <span>Trial conversion</span>
            <strong>{metrics.trialConversionRatePct}%</strong>
          </div>
          <div className="stat-card">
            <span>ARPA</span>
            <strong>${metrics.averageRevenuePerAccountUsd}</strong>
          </div>
          <div className="stat-card">
            <span>Avg users / org</span>
            <strong>{metrics.averageUsersPerOrganization}</strong>
          </div>
          <div className="stat-card">
            <span>Active organizations</span>
            <strong>{metrics.activeOrganizations}</strong>
          </div>
          <div className="stat-card">
            <span>Monthly growth</span>
            <strong>{metrics.monthlyGrowthPct}%</strong>
          </div>
          <div className="stat-card">
            <span>Retention</span>
            <strong>{metrics.retentionRatePct}%</strong>
          </div>
        </div>

        <div className="card" style={{ marginTop: 24 }}>
          <h3>Active subscriptions by plan</h3>
          {Object.entries(metrics.activeSubscriptionsByPlan).map(([plan, count]) => (
            <p key={plan}>
              {plan}: {count}
            </p>
          ))}
        </div>

        <p className="muted" style={{ marginTop: 24 }}>
          Also see <Link href="/admin/platform">platform overview</Link> · <Link href="/admin/status">status center</Link>
        </p>
    </AuthenticatedSection>
  );
}
