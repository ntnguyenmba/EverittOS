'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AppShell } from '@/components/app-shell';
import { normalizePlan, type EverittosPlan } from '@/lib/everittos-plans';
import { normalizeRole, type UserRole } from '@/lib/roles';
import { supabase } from '@/lib/supabase';

type LeadMetrics = {
  newLeads30d: number;
  openLeads: number;
  conversionRate: number;
  formSubmissions30d: number;
  proposalsSent30d: number;
  proposalsAccepted30d: number;
  bySource: Record<string, number>;
};

const SOURCE_LABELS: Record<string, string> = {
  website: 'Website',
  referral: 'Referral',
  facebook: 'Facebook',
  google: 'Google',
  instagram: 'Instagram',
  manual: 'Manual entry',
  form: 'Form',
  other: 'Other'
};

export default function LeadsPage() {
  const router = useRouter();
  const [plan, setPlan] = useState<EverittosPlan>('free');
  const [role, setRole] = useState<UserRole>('owner');
  const [metrics, setMetrics] = useState<LeadMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');

  useEffect(() => {
    async function load() {
      const {
        data: { user }
      } = await supabase.auth.getUser();
      if (!user) {
        router.push('/login');
        return;
      }
      const { data: profile } = await supabase.from('profiles').select('plan, role').eq('id', user.id).maybeSingle();
      setPlan(normalizePlan(profile?.plan));
      setRole(normalizeRole(profile?.role));

      const res = await fetch('/api/leads/metrics');
      const json = await res.json();
      setLoading(false);
      if (!res.ok) {
        setMessage(json.error || 'Unable to load metrics');
        return;
      }
      setMetrics(json.metrics);
    }
    void load();
  }, [router]);

  return (
    <AppShell plan={plan} role={role}>
      <header className="page-header">
        <h1>Lead Generation</h1>
        <p className="page-subtitle">Track new leads, conversion, sources, and form performance for this workspace.</p>
      </header>

      {message ? <p className="auth-message auth-message-error">{message}</p> : null}
      {loading ? <p>Loading metrics…</p> : null}

      {metrics ? (
        <>
          <div className="dashboard-stats-grid">
            <div className="card stat-card metric-stack">
              <strong className="stat-value">{metrics.newLeads30d}</strong>
              <span className="stat-label">New leads (30d)</span>
            </div>
            <div className="card stat-card">
              <span className="stat-label">Open pipeline</span>
              <strong className="stat-value">{metrics.openLeads}</strong>
            </div>
            <div className="card stat-card">
              <span className="stat-label">Conversion rate</span>
              <strong className="stat-value">{metrics.conversionRate}%</strong>
            </div>
            <div className="card stat-card">
              <span className="stat-label">Form submissions (30d)</span>
              <strong className="stat-value">{metrics.formSubmissions30d}</strong>
            </div>
            <div className="card stat-card">
              <span className="stat-label">Proposals sent (30d)</span>
              <strong className="stat-value">{metrics.proposalsSent30d}</strong>
            </div>
            <div className="card stat-card">
              <span className="stat-label">Proposals accepted</span>
              <strong className="stat-value">{metrics.proposalsAccepted30d}</strong>
            </div>
          </div>

          <div className="card" style={{ marginTop: 18 }}>
            <h3>Lead sources</h3>
            {Object.keys(metrics.bySource).length === 0 ? (
              <p className="muted">No lead source data yet. Sources are set on CRM records and form submissions.</p>
            ) : (
              <ul>
                {Object.entries(metrics.bySource)
                  .sort((a, b) => b[1] - a[1])
                  .map(([source, count]) => (
                    <li key={source} className="dashboard-today-row">
                      <span>{SOURCE_LABELS[source] || source}</span>
                      <span className="muted">{count}</span>
                    </li>
                  ))}
              </ul>
            )}
          </div>
        </>
      ) : null}
    </AppShell>
  );
}
