'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AppShell } from '@/components/app-shell';
import { LocalizedEmptyState } from '@/components/localized-empty-state';
import { useAppFeedback } from '@/components/feedback/use-app-feedback';
import { FEEDBACK } from '@/lib/feedback-labels';
import { CUSTOMER_LIST_SELECT, customerDisplayName, type CustomerRecord } from '@/lib/customer-record';
import { leadPipelineLabel, normalizeLeadStage } from '@/lib/lead-pipeline';
import { leadSourceLabel } from '@/lib/lead-sources';
import { normalizePlan, type EverittosPlan } from '@/lib/everittos-plans';
import { isManagerRole, normalizeRole, type UserRole } from '@/lib/roles';
import { ensureWorkspaceForSave } from '@/lib/workspace-client';
import { fetchOrganizationContext } from '@/lib/organization';
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

type LeadFilter = 'active' | 'archived';

export default function LeadsPage() {
  const router = useRouter();
  const appFeedback = useAppFeedback();
  const [plan, setPlan] = useState<EverittosPlan>('free');
  const [role, setRole] = useState<UserRole>('owner');
  const [metrics, setMetrics] = useState<LeadMetrics | null>(null);
  const [leads, setLeads] = useState<CustomerRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [reopeningId, setReopeningId] = useState<string | null>(null);
  const [filter, setFilter] = useState<LeadFilter>('active');
  const [canManage, setCanManage] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const {
      data: { user }
    } = await supabase.auth.getUser();
    if (!user) {
      router.push('/login');
      return;
    }
    const { data: profile } = await supabase.from('profiles').select('plan, role').eq('id', user.id).maybeSingle();
    const org = await fetchOrganizationContext(user.id);
    const userRole = normalizeRole(org?.role || profile?.role);
    setPlan(normalizePlan(profile?.plan));
    setRole(userRole);
    setCanManage(isManagerRole(userRole));

    const workspace = await ensureWorkspaceForSave(user.id);
    const workspaceOrg = workspace.ok ? workspace.workspace : null;
    let leadsQuery = supabase
      .from('customers')
      .select(CUSTOMER_LIST_SELECT)
      .eq('record_type', 'lead')
      .order('created_at', { ascending: false });
    if (workspaceOrg?.organizationId) {
      leadsQuery = leadsQuery.eq('organization_id', workspaceOrg.organizationId);
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
  }, [appFeedback, router]);

  useEffect(() => {
    void load();
  }, [load]);

  const visibleLeads = useMemo(() => {
    return leads.filter((lead) => {
      const stage = normalizeLeadStage(lead.pipeline_stage);
      return filter === 'archived' ? stage === 'cancelled' : stage !== 'cancelled';
    });
  }, [filter, leads]);

  async function archiveLead(id: string, name: string) {
    if (removingId) return;
    if (!window.confirm(`Archive lead ${name}? You can reopen it later.`)) return;
    setRemovingId(id);
    const res = await fetch(`/api/customers/${id}`, { method: 'DELETE' });
    const json = (await res.json().catch(() => ({}))) as { error?: string; message?: string };
    setRemovingId(null);
    if (!res.ok) {
      appFeedback.error(json.error || 'Unable to archive lead.');
      return;
    }
    appFeedback.success('Lead archived.');
    void load();
  }

  async function reopenLead(id: string) {
    if (reopeningId) return;
    setReopeningId(id);
    const res = await fetch(`/api/customers/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ record_type: 'lead', pipeline_stage: 'reopened' })
    });
    const json = (await res.json().catch(() => ({}))) as { error?: string; message?: string };
    setReopeningId(null);
    if (!res.ok) {
      appFeedback.error(json.error || 'Unable to reopen lead.');
      return;
    }
    appFeedback.success('Lead reopened.');
    setFilter('active');
    void load();
  }

  return (
    <AppShell plan={plan} role={role}>
      <header className="page-header">
        <div className="page-header-text">
          <h1>Lead Generation</h1>
          <p className="page-subtitle">Track new leads, conversion, sources, and form performance.</p>
        </div>
        {canManage ? (
          <div className="page-header-action">
            <Link className="btn btn-primary" href="/leads/new">
              Add lead
            </Link>
          </div>
        ) : null}
      </header>

      {loading ? <p>Loading metrics...</p> : null}

      {metrics ? (
        <>
          <div className="dashboard-stats-grid">
            <div className="card stat-card metric-stack">
              <strong className="stat-value">{metrics.newLeads30d}</strong>
              <span className="stat-label">New leads (30d)</span>
            </div>
            <Link href="/leads#open-leads" className="card stat-card" style={{ color: 'inherit', textDecoration: 'none' }} aria-label="View open leads">
              <span className="stat-label">Open pipeline</span>
              <strong className="stat-value">{metrics.openLeads}</strong>
            </Link>
            <div className="card stat-card">
              <span className="stat-label">Conversion rate</span>
              <strong className="stat-value">{metrics.conversionRate}%</strong>
            </div>
            <div className="card stat-card">
              <span className="stat-label">Form submissions (30d)</span>
              <strong className="stat-value">{metrics.formSubmissions30d}</strong>
            </div>
          </div>

          <div id="open-leads" className="card" style={{ marginTop: 18, scrollMarginTop: 24 }}>
            <div className="inline-actions" style={{ justifyContent: 'space-between', marginBottom: 12 }}>
              <h3>{filter === 'archived' ? 'Archived leads' : 'Open leads'}</h3>
              <div className="inline-actions">
                <button type="button" className={`btn btn-sm ${filter === 'active' ? 'btn-primary' : ''}`} onClick={() => setFilter('active')}>
                  Active
                </button>
                <button type="button" className={`btn btn-sm ${filter === 'archived' ? 'btn-primary' : ''}`} onClick={() => setFilter('archived')}>
                  Archived
                </button>
              </div>
            </div>
            {visibleLeads.length === 0 ? (
              <LocalizedEmptyState emptyKey="leads" compact />
            ) : (
              visibleLeads.map((lead) => {
                const isArchived = normalizeLeadStage(lead.pipeline_stage) === 'cancelled';
                return (
                  <div key={lead.id} className="dashboard-today-row" style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
                    <Link href={`/leads/${lead.id}`}>{customerDisplayName(lead)}</Link>
                    <span className="muted">{leadSourceLabel(lead.lead_source)}</span>
                    <span className="muted">{leadPipelineLabel(lead.pipeline_stage)}</span>
                    <Link className="btn btn-sm" href={`/leads/${lead.id}`}>
                      Edit
                    </Link>
                    {canManage && isArchived ? (
                      <button
                        type="button"
                        className="btn btn-sm"
                        disabled={reopeningId === lead.id}
                        onClick={() => void reopenLead(lead.id)}
                      >
                        {reopeningId === lead.id ? FEEDBACK.loading : 'Reopen'}
                      </button>
                    ) : null}
                    {canManage && !isArchived ? (
                      <button
                        type="button"
                        className="btn btn-sm btn-danger"
                        disabled={removingId === lead.id}
                        onClick={() => void archiveLead(lead.id, customerDisplayName(lead))}
                      >
                        {removingId === lead.id ? FEEDBACK.loading : 'Archive'}
                      </button>
                    ) : null}
                  </div>
                );
              })
            )}
          </div>
        </>
      ) : null}
    </AppShell>
  );
}
