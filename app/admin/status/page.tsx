'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { PermissionDenied } from '@/components/permission-denied';

type StatusPayload = {
  generatedAt: string;
  databaseHealth: string;
  apiHealth: string;
  storageUsage: { photos: number; label: string };
  activeUsers: number;
  organizationCount: number;
  totalUsers: number;
  recentActivityEvents30d: number;
  recentSecurityEvents: { id: string; event_type: string; severity: string; message: string; created_at: string }[];
};

export default function AdminStatusPage() {
  const router = useRouter();
  const [data, setData] = useState<StatusPayload | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const res = await fetch('/api/admin/status');
      const json = await res.json();
      setLoading(false);
      if (res.status === 401) {
        router.push('/login?next=/admin/status');
        return;
      }
      if (!res.ok) {
        setError(json.error || 'Unable to load platform status.');
        return;
      }
      setData(json);
    }
    load();
  }, [router]);

  if (loading) {
    return (
      <main className="section">
        <div className="container card">Loading platform status...</div>
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

  if (!data) return null;

  return (
    <main className="section">
      <div className="container">
        <h1>Platform status</h1>
        <p className="muted">Operational health for database, API, storage, and security events.</p>

        <div className="stats-grid" style={{ marginTop: 24 }}>
          <div className={`card launch-status-${data.databaseHealth === 'ok' ? 'ok' : 'fail'}`}>
            <h3>Database</h3>
            <strong>{data.databaseHealth}</strong>
          </div>
          <div className={`card launch-status-${data.apiHealth === 'ok' ? 'ok' : 'warn'}`}>
            <h3>API</h3>
            <strong>{data.apiHealth}</strong>
          </div>
          <div className="stat-card">
            <span>Storage</span>
            <strong>{data.storageUsage.label}</strong>
          </div>
          <div className="stat-card">
            <span>Active users</span>
            <strong>{data.activeUsers}</strong>
          </div>
          <div className="stat-card">
            <span>Organizations</span>
            <strong>{data.organizationCount}</strong>
          </div>
          <div className="stat-card">
            <span>Activity events (30d)</span>
            <strong>{data.recentActivityEvents30d}</strong>
          </div>
        </div>

        <div className="card" style={{ marginTop: 24 }}>
          <h3>Recent security events</h3>
          {data.recentSecurityEvents.length === 0 ? <p className="muted">No security events recorded yet.</p> : null}
          {data.recentSecurityEvents.map((event) => (
            <div key={event.id} className="list-row compact">
              <div>
                <strong>{event.event_type}</strong>
                <p className="muted">
                  {event.message} · {new Date(event.created_at).toLocaleString()}
                </p>
              </div>
            </div>
          ))}
        </div>

        <p className="muted" style={{ marginTop: 24 }}>
          Generated {new Date(data.generatedAt).toLocaleString()} · <Link href="/admin/launch-status">Launch readiness</Link> ·{' '}
          <Link href="/admin/metrics">Investor metrics</Link>
        </p>
      </div>
    </main>
  );
}
