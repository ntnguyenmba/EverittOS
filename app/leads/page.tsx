'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AppShell } from '@/components/app-shell';
import { LocalizedEmptyState } from '@/components/localized-empty-state';
import { useAppFeedback } from '@/components/feedback/use-app-feedback';
import { FEEDBACK } from '@/lib/feedback-labels';
import { CUSTOMER_LIST_SELECT, customerDisplayName, type CustomerRecord } from '@/lib/customer-record';
import { leadSourceLabel } from '@/lib/lead-sources';
import { normalizePlan, type EverittosPlan } from '@/lib/everittos-plans';
import { isManagerRole, normalizeRole, type UserRole } from '@/lib/roles';
import { ensureWorkspaceForSave } from '@/lib/workspace-client';
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

export default function LeadsPage() {
  const router = useRouter();
  const appFeedback = useAppFeedback();
  const [plan, setPlan] = useState<EverittosPlan>('free');
  const [role, setRole] = useState<UserRole>('owner');
  const [metrics, setMetrics] = useState<LeadMetrics | null>(null);
  const [leads, setLeads] = useState<CustomerRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [canManage, setCanManage] = useState(false);

  async function load() {
    setLoading(true);
    const {
      data: { user }
    } = await supabase.auth.getUser();
    if (!user) {
      router.push('/login');
      return;
    }
    const { data: profile } = await supabase.from('profiles').select('plan, role').eq('id', user.id).maybeSingle();
    const userRole = normalizeRole(profile?.role);
    setPlan(normalizePlan(profile?.plan));
    setRole(userRole);
    setCanManage(isManagerRole(userRole));

    const workspace = await ensureWorkspaceForSave(user.id);
    const org = workspace.ok ? workspace.workspace : null;
    let leadsQuery = supabase
      .from('customers')
      .select(CUSTOMER_LIST_SELECT)
      .in('pipeline_stage', ['lead', 'qualified'])
      .order('created_at', { ascending: false });
    if (org?.organizationId) {
      leadsQuery = leadsQuery.eq('organization_id', org.organizationId);
    } else {
      leadsQuery = leadsQuery.eq('user_id', user.id);
    }

    const [metricsRes, leadsRes] = await Promise.all([
      fetch('/api/leads/metrics'),
      leadsQuery
    ]);

    const metricsJson = await metricsRes.json();
    setLoading(false);
    if (!metricsRes.ok) {
      appFeedback.error(metricsJson.error || 'Unable to load metrics');
    } else {
      setMetrics(metricsJson.metrics);
    }
    if (leadsRes.error) {
      appFeedback.error(leadsRes.error.message);
    } else {
      setLeads((leadsRes.data || []) as CustomerRecord[]);
    }
  }

  useEffect(() => {
    void load();
  }, [router]);

  async function removeLead(id: string, name: string) {
    if (removingId) return;
    if (!window.confirm(`Remove lead ${name}?`)) return;
    setRemovingId(id);
    const res = await fetch(`/api/customers/${id}`, { method: 'DELETE' });
    const json = (await res.json().catch(() => ({}))) as { error?: string; message?: string };
    setRemovingId(null);
    if (!res.ok) {
      appFeedback.error(json.error || 'Unable to remove lead.');
      return;
    }
    appFeedback.label('removed');
    void load();
  }

  return (
    <AppShell plan={plan} role={role}>
      <header className="page-header">
        <div className="page-header-text">
          <h1>Lead Generation</h1>
          <p className="page-subtitle">Track new leads, conversion, sources, and form performance for this workspace.</p>
        </div>
        {canManage ? (
          <div className="page-header-action">
            <Link className="btn btn-primary" href="/leads/new">
              Add lead
            </Link>
          </div>
        ) : null}
      </header>

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
          </div>

          <div className="card" style={{ marginTop: 18 }}>
            <h3>Open leads</h3>
            {leads.length === 0 ? (
              <LocalizedEmptyState emptyKey="leads" compact />
            ) : (
              leads.map((lead) => (
                <div key={lead.id} className="dashboard-today-row" style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
                  <Link href={`/leads/${lead.id}`}>{customerDisplayName(lead)}</Link>
                  <span className="muted">{leadSourceLabel(lead.lead_source)}</span>
                  <Link className="btn btn-sm" href={`/leads/${lead.id}`}>
                    Edit
                  </Link>
                  {canManage ? (
                    <button
                      type="button"
                      className="btn btn-sm btn-danger"
                      disabled={removingId === lead.id}
                      onClick={() => void removeLead(lead.id, customerDisplayName(lead))}
                    >
                      {removingId === lead.id ? FEEDBACK.loading : 'Remove'}
                    </button>
                  ) : null}
                </div>
              ))
            )}
          </div>
        </>
      ) : null}
    </AppShell>
  );
}
