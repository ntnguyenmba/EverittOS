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
  converted30d: number;
  closedLost30d: number;
  conversionRate: number;
  formSubmissions30d: number;
  proposalsSent30d: number;
  proposalsAccepted30d: number;
  bySource: Record<string, number>;
};

type LeadFilter = 'active' | 'new30d' | 'closed_lost' | 'archived';

const OPEN_STAGES = ['open', 'contacted', 'qualified', 'proposal_sent', 'negotiation', 'reopened'];

const FILTER_TITLES: Record<LeadFilter, string> = {
  active: 'Open leads',
  new30d: 'New leads from the last 30 days',
  closed_lost: 'Closed lost leads',
  archived: 'Archived leads'
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
  const [reopeningId, setReopeningId] = useState<string | null>(null);
  const [updatingStageId, setUpdatingStageId] = useState<string | null>(null);
  const [filter, setFilter] = useState<LeadFilter>('active');
  const [searchTerm, setSearchTerm] = useState('');
  const [sourceFilter, setSourceFilter] = useState('all');
  const [stageFilter, setStageFilter] = useState('all');
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

    const [metricsRes, leadsRes] = await Promise.all([fetch('/api/leads/metrics'), leadsQuery]);
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

  const sourceOptions = useMemo(() => {
    return Array.from(new Set(leads.map((lead) => lead.lead_source).filter(Boolean) as string[])).sort((a, b) =>
      leadSourceLabel(a).localeCompare(leadSourceLabel(b))
    );
  }, [leads]);

  const visibleLeads = useMemo(() => {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const normalizedSearch = searchTerm.trim().toLowerCase();

    return leads.filter((lead) => {
      const stage = normalizeLeadStage(lead.pipeline_stage);

      let matchesMainFilter = false;
      if (filter === 'archived') matchesMainFilter = stage === 'cancelled';
      else if (filter === 'closed_lost') matchesMainFilter = stage === 'closed_lost';
      else if (filter === 'new30d') {
        matchesMainFilter = Boolean(lead.created_at && new Date(lead.created_at) >= thirtyDaysAgo);
      } else {
        matchesMainFilter = OPEN_STAGES.includes(stage);
      }

      if (!matchesMainFilter) return false;
      if (sourceFilter !== 'all' && lead.lead_source !== sourceFilter) return false;
      if (stageFilter !== 'all' && stage !== stageFilter) return false;

      if (normalizedSearch) {
        const searchable = [customerDisplayName(lead), leadSourceLabel(lead.lead_source), leadPipelineLabel(lead.pipeline_stage)]
          .join(' ')
          .toLowerCase();
        if (!searchable.includes(normalizedSearch)) return false;
      }

      return true;
    });
  }, [filter, leads, searchTerm, sourceFilter, stageFilter]);

  function showLeadFilter(nextFilter: LeadFilter) {
    setFilter(nextFilter);
    setStageFilter('all');
    window.requestAnimationFrame(() => {
      document.getElementById('lead-results')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  }

  async function updateLeadStage(id: string, nextStage: string) {
    if (!canManage || updatingStageId || removingId || reopeningId) return;
    const previousLead = leads.find((lead) => lead.id === id);
    if (!previousLead || normalizeLeadStage(previousLead.pipeline_stage) === nextStage) return;

    setUpdatingStageId(id);
    setLeads((current) => current.map((lead) => (lead.id === id ? { ...lead, pipeline_stage: nextStage } : lead)));

    const res = await fetch(`/api/customers/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ record_type: 'lead', pipeline_stage: nextStage })
    });
    const json = (await res.json().catch(() => ({}))) as { error?: string };
    setUpdatingStageId(null);

    if (!res.ok) {
      setLeads((current) =>
        current.map((lead) => (lead.id === id ? { ...lead, pipeline_stage: previousLead.pipeline_stage } : lead))
      );
      appFeedback.error(json.error || 'Unable to update lead stage.');
      return;
    }

    appFeedback.success(`Lead moved to ${leadPipelineLabel(nextStage)}.`);
    void load();
  }

  async function archiveLead(id: string, name: string) {
    if (removingId || updatingStageId) return;
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
    if (reopeningId || updatingStageId) return;
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
            <button type="button" className="card stat-card metric-stack" onClick={() => showLeadFilter('new30d')}>
              <strong className="stat-value">{metrics.newLeads30d}</strong>
              <span className="stat-label">New leads (30d)</span>
            </button>
            <button type="button" className="card stat-card" onClick={() => showLeadFilter('active')}>
              <span className="stat-label">Open pipeline</span>
              <strong className="stat-value">{metrics.openLeads}</strong>
            </button>
            <Link
              href="/customers"
              className="card stat-card"
              style={{ color: 'inherit', textDecoration: 'none' }}
              aria-label="View customers converted from leads"
            >
              <span className="stat-label">Converted (30d)</span>
              <strong className="stat-value">{metrics.converted30d}</strong>
            </Link>
            <button type="button" className="card stat-card" onClick={() => showLeadFilter('closed_lost')}>
              <span className="stat-label">Closed lost (30d)</span>
              <strong className="stat-value">{metrics.closedLost30d}</strong>
            </button>
            <div className="card stat-card">
              <span className="stat-label">Conversion rate</span>
              <strong className="stat-value">{metrics.conversionRate}%</strong>
            </div>
            <div className="card stat-card">
              <span className="stat-label">Form submissions (30d)</span>
              <strong className="stat-value">{metrics.formSubmissions30d}</strong>
            </div>
          </div>

          <div id="lead-results" className="card" style={{ marginTop: 18, scrollMarginTop: 24 }}>
            <div className="inline-actions" style={{ justifyContent: 'space-between', marginBottom: 12 }}>
              <h3>{FILTER_TITLES[filter]}</h3>
              <div className="inline-actions">
                <button type="button" className={`btn btn-sm ${filter === 'active' ? 'btn-primary' : ''}`} onClick={() => showLeadFilter('active')}>
                  Open
                </button>
                <button type="button" className={`btn btn-sm ${filter === 'new30d' ? 'btn-primary' : ''}`} onClick={() => showLeadFilter('new30d')}>
                  New 30d
                </button>
                <button type="button" className={`btn btn-sm ${filter === 'closed_lost' ? 'btn-primary' : ''}`} onClick={() => showLeadFilter('closed_lost')}>
                  Closed lost
                </button>
                <button type="button" className={`btn btn-sm ${filter === 'archived' ? 'btn-primary' : ''}`} onClick={() => showLeadFilter('archived')}>
                  Archived
                </button>
              </div>
            </div>

            <div className="inline-actions" style={{ marginBottom: 16, alignItems: 'end' }}>
              <label style={{ flex: '1 1 220px' }}>
                <span className="field-label">Search leads</span>
                <input
                  className="input"
                  value={searchTerm}
                  onChange={(event) => setSearchTerm(event.target.value)}
                  placeholder="Name, source, or status"
                />
              </label>
              <label style={{ minWidth: 180 }}>
                <span className="field-label">Source</span>
                <select className="input" value={sourceFilter} onChange={(event) => setSourceFilter(event.target.value)}>
                  <option value="all">All sources</option>
                  {sourceOptions.map((source) => (
                    <option key={source} value={source}>
                      {leadSourceLabel(source)}
                    </option>
                  ))}
                </select>
              </label>
              <label style={{ minWidth: 180 }}>
                <span className="field-label">Stage</span>
                <select className="input" value={stageFilter} onChange={(event) => setStageFilter(event.target.value)}>
                  <option value="all">All stages</option>
                  {OPEN_STAGES.map((stage) => (
                    <option key={stage} value={stage}>
                      {leadPipelineLabel(stage)}
                    </option>
                  ))}
                  <option value="closed_lost">Closed lost</option>
                  <option value="cancelled">Cancelled</option>
                </select>
              </label>
            </div>

            {visibleLeads.length === 0 ? (
              <LocalizedEmptyState emptyKey="leads" compact />
            ) : (
              visibleLeads.map((lead) => {
                const stage = normalizeLeadStage(lead.pipeline_stage);
                const isArchived = stage === 'cancelled';
                const isClosedLost = stage === 'closed_lost';
                const isOpen = OPEN_STAGES.includes(stage);
                const busy = updatingStageId === lead.id || removingId === lead.id || reopeningId === lead.id;

                return (
                  <div
                    key={lead.id}
                    className="dashboard-today-row"
                    style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}
                  >
                    <Link href={`/leads/${lead.id}`}>{customerDisplayName(lead)}</Link>
                    <span className="muted">{leadSourceLabel(lead.lead_source)}</span>
                    {canManage && isOpen ? (
                      <select
                        className="input"
                        aria-label={`Stage for ${customerDisplayName(lead)}`}
                        value={stage}
                        disabled={busy}
                        onChange={(event) => void updateLeadStage(lead.id, event.target.value)}
                        style={{ width: 'auto', minWidth: 150, paddingTop: 6, paddingBottom: 6 }}
                      >
                        {OPEN_STAGES.map((option) => (
                          <option key={option} value={option}>
                            {leadPipelineLabel(option)}
                          </option>
                        ))}
                        <option value="closed_lost">Close lost</option>
                      </select>
                    ) : (
                      <span className="muted">{leadPipelineLabel(lead.pipeline_stage)}</span>
                    )}
                    {updatingStageId === lead.id ? <span className="muted">{FEEDBACK.loading}</span> : null}
                    <Link className="btn btn-sm" href={`/leads/${lead.id}`}>
                      Edit
                    </Link>
                    {canManage && (isArchived || isClosedLost) ? (
                      <button type="button" className="btn btn-sm" disabled={busy} onClick={() => void reopenLead(lead.id)}>
                        {reopeningId === lead.id ? FEEDBACK.loading : 'Reopen'}
                      </button>
                    ) : null}
                    {canManage && !isArchived ? (
                      <button
                        type="button"
                        className="btn btn-sm btn-danger"
                        disabled={busy}
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
