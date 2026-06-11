'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AuthenticatedSection } from '@/components/authenticated-section';
import { PermissionDenied } from '@/components/permission-denied';

type LaunchStatus = {
  generatedAt: string;
  launchReadinessScore: number;
  checks: Record<string, string>;
  environmentVariables: { name: string; configured: boolean }[];
};

function statusLabel(status: string) {
  if (status === 'ok') return 'OK';
  if (status === 'warn') return 'Warning';
  return 'Needs attention';
}

function statusClass(status: string) {
  if (status === 'ok') return 'launch-status-ok';
  if (status === 'warn') return 'launch-status-warn';
  return 'launch-status-fail';
}

export default function LaunchStatusPage() {
  const router = useRouter();
  const [data, setData] = useState<LaunchStatus | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const res = await fetch('/api/admin/launch-status');
      const json = await res.json();
      setLoading(false);
      if (res.status === 401) {
        router.push('/login?next=/admin/launch-status');
        return;
      }
      if (!res.ok) {
        setError(json.error || 'Unable to load launch status.');
        return;
      }
      setData(json);
    }
    load();
  }, [router]);

  if (loading) {
    return (
      <AuthenticatedSection>
        <div className="card">Loading launch readiness…</div>
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

  if (!data) return null;

  return (
    <AuthenticatedSection>
        <h1>Launch readiness</h1>
        <p className="muted">Internal checklist for production launch. Admin access only.</p>

        <div className="card" style={{ marginTop: 24 }}>
          <h2>Score: {data.launchReadinessScore}/100</h2>
          <p className="muted">Generated {new Date(data.generatedAt).toLocaleString()}</p>
        </div>

        <div className="stats-grid" style={{ marginTop: 24 }}>
          {Object.entries(data.checks).map(([key, status]) => (
            <div key={key} className={`card ${statusClass(status)}`}>
              <h3 style={{ textTransform: 'capitalize' }}>{key.replace(/([A-Z])/g, ' $1')}</h3>
              <p>
                <strong>{statusLabel(status)}</strong>
              </p>
            </div>
          ))}
        </div>

        <div className="card" style={{ marginTop: 24 }}>
          <h3>Environment variables</h3>
          <ul>
            {data.environmentVariables.map((env) => (
              <li key={env.name}>
                {env.name}: {env.configured ? 'configured' : 'missing'}
              </li>
            ))}
          </ul>
        </div>

        <p className="muted" style={{ marginTop: 24 }}>
          See <code>docs/SECURITY_RLS_AUDIT.md</code> for RLS policy details.
        </p>
    </AuthenticatedSection>
  );
}
