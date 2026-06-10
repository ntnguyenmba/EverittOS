'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { PermissionDenied } from '@/components/permission-denied';

type Metrics = {
  totalCompanies: number;
  totalUsers: number;
  totalJobs: number;
  activeJobs: number;
  totalCustomers: number;
  totalReports: number;
  totalPhotos: number;
  totalTeamMembers: number;
  activeSubscriptionsByPlan: Record<string, number>;
  mrrEstimateUsd: number;
  trialingAccounts: number;
  freeAccounts: number;
  pastDueAccounts: number;
  latestSignups: { id: string; email: string | null; plan: string | null; created_at: string | null }[];
  newestOrganizations: { id: string; name: string; created_at: string | null }[];
  last30Days: {
    productEvents: number;
    signupsTracked: number;
    jobsCreatedTracked: number;
  };
};

export default function PlatformMetricsPage() {
  const router = useRouter();
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const res = await fetch('/api/admin/metrics');
      const json = await res.json();
      setLoading(false);
      if (res.status === 401) {
        router.push('/login?next=/admin/platform');
        return;
      }
      if (!res.ok) {
        setError(json.error || 'Unable to load platform metrics.');
        return;
      }
      setMetrics(json);
    }
    load();
  }, [router]);

  if (loading) {
    return (
      <main className="section">
        <div className="container card">Loading platform metrics...</div>
      </main>
    );
  }

  if (error) {
    return (
      <main className="section">
        <div className="container">
          <PermissionDenied message={error} />
        </div>
      </main>
    );
  }

  if (!metrics) return null;

  return (
    <main className="section">
      <div className="container">
        <h2>Platform metrics</h2>
        <p className="muted">Internal view for investor and operator reporting. Not visible to customers.</p>

        <div className="stats-grid" style={{ marginTop: 24 }}>
          <div className="stat-card">
            <span>Companies</span>
            <strong>{metrics.totalCompanies}</strong>
          </div>
          <div className="stat-card">
            <span>Users</span>
            <strong>{metrics.totalUsers}</strong>
          </div>
          <div className="stat-card">
            <span>Team members</span>
            <strong>{metrics.totalTeamMembers}</strong>
          </div>
          <div className="stat-card">
            <span>Total jobs</span>
            <strong>{metrics.totalJobs}</strong>
          </div>
          <div className="stat-card">
            <span>Active jobs</span>
            <strong>{metrics.activeJobs}</strong>
          </div>
          <div className="stat-card">
            <span>Customers</span>
            <strong>{metrics.totalCustomers}</strong>
          </div>
          <div className="stat-card">
            <span>Reports</span>
            <strong>{metrics.totalReports}</strong>
          </div>
          <div className="stat-card">
            <span>Photos</span>
            <strong>{metrics.totalPhotos}</strong>
          </div>
          <div className="stat-card">
            <span>MRR estimate</span>
            <strong>${metrics.mrrEstimateUsd}</strong>
          </div>
          <div className="stat-card">
            <span>Free accounts</span>
            <strong>{metrics.freeAccounts}</strong>
          </div>
          <div className="stat-card">
            <span>Past due</span>
            <strong>{metrics.pastDueAccounts}</strong>
          </div>
          <div className="stat-card">
            <span>Trialing</span>
            <strong>{metrics.trialingAccounts}</strong>
          </div>
        </div>

        <div className="card" style={{ marginTop: 24 }}>
          <h3>Active subscriptions by plan</h3>
          {Object.keys(metrics.activeSubscriptionsByPlan).length === 0 && <p>No active subscriptions recorded.</p>}
          {Object.entries(metrics.activeSubscriptionsByPlan).map(([plan, count]) => (
            <p key={plan}>
              {plan}: {count}
            </p>
          ))}
        </div>

        <div className="card" style={{ marginTop: 18 }}>
          <h3>Latest signups</h3>
          {(metrics.latestSignups || []).map((signup) => (
            <p key={signup.id}>
              {signup.email || signup.id} · {signup.plan || 'free'} · {signup.created_at ? new Date(signup.created_at).toLocaleDateString() : ''}
            </p>
          ))}
        </div>

        <div className="card" style={{ marginTop: 18 }}>
          <h3>Newest organizations</h3>
          {(metrics.newestOrganizations || []).map((org) => (
            <p key={org.id}>
              {org.name} · {org.created_at ? new Date(org.created_at).toLocaleDateString() : ''}
            </p>
          ))}
        </div>

        <div className="card" style={{ marginTop: 18 }}>
          <h3>Last 30 days (tracked events)</h3>
          <p>Product events: {metrics.last30Days.productEvents}</p>
          <p>Signups tracked: {metrics.last30Days.signupsTracked}</p>
          <p>Jobs created tracked: {metrics.last30Days.jobsCreatedTracked}</p>
        </div>
      </div>
    </main>
  );
}
