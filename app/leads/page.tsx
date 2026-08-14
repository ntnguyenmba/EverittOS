'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AppShell } from '@/components/app-shell';
import { LocalizedEmptyState } from '@/components/localized-empty-state';
import { useAppFeedback } from '@/components/feedback/use-app-feedback';
import { useTranslation } from '@/components/locale-provider';
import { FEEDBACK } from '@/lib/feedback-labels';
import { CUSTOMER_LIST_SELECT, customerDisplayName, type CustomerRecord } from '@/lib/customer-record';
import { OPEN_LEAD_STAGES, leadPipelineLabel, normalizeLeadStage } from '@/lib/lead-pipeline';
import { leadSourceLabel } from '@/lib/lead-sources';
import { normalizePlan, type EverittosPlan } from '@/lib/everittos-plans';
import { isManagerRole, normalizeRole, type UserRole } from '@/lib/roles';
import { ensureWorkspaceForSave } from '@/lib/workspace-client';
import { fetchOrganizationContext } from '@/lib/organization';
import { supabase } from '@/lib/supabase';

type RequestFilter = 'open' | 'closed' | 'archived';

const copy = {
  en: {
    filterTitles: { open: 'Open requests', closed: 'Not booked', archived: 'Archived' },
    archived: 'Archived',
    archive: 'Archive',
    archiveConfirm: 'Archive {name}? You can reopen it later.'
  },
  es: {
    filterTitles: { open: 'Solicitudes abiertas', closed: 'No reservado', archived: 'Archivadas' },
    archived: 'Archivadas',
    archive: 'Archivar',
    archiveConfirm: '¿Archivar {name}? Puede reabrirlo más tarde.'
  },
  vi: {
    filterTitles: { open: 'Yêu cầu đang mở', closed: 'Chưa đặt', archived: 'Đã lưu trữ' },
    archived: 'Đã lưu trữ',
    archive: 'Lưu trữ',
    archiveConfirm: 'Lưu trữ {name}? Bạn có thể mở lại sau.'
  }
} as const;

export default function LeadsPage() {
  const router = useRouter();
  const appFeedback = useAppFeedback();
  const { locale } = useTranslation();
  const c = copy[locale];
  const [plan, setPlan] = useState<EverittosPlan>('free');
  const [role, setRole] = useState<UserRole>('owner');
  const [leads, setLeads] = useState<CustomerRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [reopeningId, setReopeningId] = useState<string | null>(null);
  const [updatingStageId, setUpdatingStageId] = useState<string | null>(null);
  const [filter, setFilter] = useState<RequestFilter>('open');
  const [searchTerm, setSearchTerm] = useState('');
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
    let query = supabase
      .from('customers')
      .select(CUSTOMER_LIST_SELECT)
      .eq('record_type', 'lead')
      .order('created_at', { ascending: false });

    if (workspaceOrg?.organizationId) {
      query = query.eq('organization_id', workspaceOrg.organizationId);
    } else {
      query = query.eq('user_id', user.id);
    }

    const { data, error } = await query;
    setLoading(false);

    if (error) {
      appFeedback.error(error.message);
      return;
    }

    setLeads((data || []) as CustomerRecord[]);
  }, [appFeedback, router]);

  useEffect(() => {
    void load();
  }, [load]);

  const visibleLeads = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase();

    return leads.filter((lead) => {
      const stage = normalizeLeadStage(lead.pipeline_stage);
      const matchesFilter =
        filter === 'archived'
          ? stage === 'cancelled'
          : filter === 'closed'
            ? stage === 'closed_lost'
            : OPEN_LEAD_STAGES.includes(stage as (typeof OPEN_LEAD_STAGES)[number]);

      if (!matchesFilter) return false;
      if (!normalizedSearch) return true;

      return [customerDisplayName(lead), lead.phone, lead.email, leadSourceLabel(lead.lead_source)]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
        .includes(normalizedSearch);
    });
  }, [filter, leads, searchTerm]);

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
      appFeedback.error(json.error || 'Unable to update request.');
      return;
    }

    appFeedback.success('Request updated.');
    void load();
  }

  async function archiveLead(id: string, name: string) {
    if (removingId || updatingStageId) return;
    if (!window.confirm(c.archiveConfirm.replace('{name}', name))) return;
    setRemovingId(id);
    const res = await fetch(`/api/customers/${id}`, { method: 'DELETE' });
    const json = (await res.json().catch(() => ({}))) as { error?: string };
    setRemovingId(null);

    if (!res.ok) {
      appFeedback.error(json.error || 'Unable to archive request.');
      return;
    }

    appFeedback.success('Request archived.');
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
    const json = (await res.json().catch(() => ({}))) as { error?: string };
    setReopeningId(null);

    if (!res.ok) {
      appFeedback.error(json.error || 'Unable to reopen request.');
      return;
    }

    appFeedback.success('Request reopened.');
    setFilter('open');
    void load();
  }

  return (
    <AppShell plan={plan} role={role}>
      <header className="page-header">
        <div className="page-header-text">
          <h1>Requests</h1>
          <p className="page-subtitle">Keep track of people who may book work.</p>
        </div>
        {canManage ? (
          <div className="page-header-action">
            <Link className="btn btn-primary" href="/leads/new">
              Add request
            </Link>
          </div>
        ) : null}
      </header>

      <div className="card">
        <div className="inline-actions" style={{ justifyContent: 'space-between', marginBottom: 14 }}>
          <h3>{c.filterTitles[filter]}</h3>
          <div className="inline-actions">
            <button type="button" className={`btn btn-sm ${filter === 'open' ? 'btn-primary' : ''}`} onClick={() => setFilter('open')}>
              Open
            </button>
            <button type="button" className={`btn btn-sm ${filter === 'closed' ? 'btn-primary' : ''}`} onClick={() => setFilter('closed')}>
              Not booked
            </button>
            <button type="button" className={`btn btn-sm ${filter === 'archived' ? 'btn-primary' : ''}`} onClick={() => setFilter('archived')}>
              {c.archived}
            </button>
          </div>
        </div>

        <label style={{ display: 'block', marginBottom: 16 }}>
          <span className="field-label">Search</span>
          <input
            className="input"
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
            placeholder="Name, phone, or email"
          />
        </label>

        {loading ? <p className="muted">Loading...</p> : null}

        {!loading && visibleLeads.length === 0 ? (
          <LocalizedEmptyState emptyKey="leads" compact />
        ) : (
          visibleLeads.map((lead) => {
            const stage = normalizeLeadStage(lead.pipeline_stage);
            const isArchived = stage === 'cancelled';
            const isClosed = stage === 'closed_lost';
            const isOpen = OPEN_LEAD_STAGES.includes(stage as (typeof OPEN_LEAD_STAGES)[number]);
            const busy = updatingStageId === lead.id || removingId === lead.id || reopeningId === lead.id;

            return (
              <div
                key={lead.id}
                className="dashboard-today-row open-in-new-tab-card"
                style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}
              >
                <Link href={`/leads/${lead.id}`} target="_blank" rel="noopener noreferrer" className="record-card-overlay-link" aria-label={`Open ${customerDisplayName(lead)} in a new tab`}><span className="record-card-overlay-label">Open {customerDisplayName(lead)} in a new tab</span></Link>
                <div style={{ flex: '1 1 220px' }}>
                  <Link href={`/leads/${lead.id}`} target="_blank" rel="noopener noreferrer">{customerDisplayName(lead)}</Link>
                  <div className="muted" style={{ marginTop: 3 }}>
                    {[lead.phone, lead.email].filter(Boolean).join(' · ') || leadSourceLabel(lead.lead_source)}
                  </div>
                </div>

                {canManage && isOpen ? (
                  <select
                    className="input"
                    aria-label={`Status for ${customerDisplayName(lead)}`}
                    value={stage}
                    disabled={busy}
                    onChange={(event) => void updateLeadStage(lead.id, event.target.value)}
                    style={{ width: 'auto', minWidth: 140, paddingTop: 6, paddingBottom: 6 }}
                  >
                    <option value="open">New</option>
                    <option value="contacted">Contacted</option>
                    <option value="qualified">Interested</option>
                    <option value="proposal_sent">Quote sent</option>
                    <option value="negotiation">Following up</option>
                    <option value="reopened">Reopened</option>
                    <option value="closed_lost">Not booked</option>
                  </select>
                ) : (
                  <span className="muted">{isClosed ? 'Not booked' : leadPipelineLabel(lead.pipeline_stage)}</span>
                )}

                {updatingStageId === lead.id ? <span className="muted">{FEEDBACK.loading}</span> : null}

                <Link className="btn btn-sm" href={`/leads/${lead.id}`} target="_blank" rel="noopener noreferrer">
                  Open
                </Link>

                {canManage && (isArchived || isClosed) ? (
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
                    {removingId === lead.id ? FEEDBACK.loading : c.archive}
                  </button>
                ) : null}
              </div>
            );
          })
        )}
      </div>
    </AppShell>
  );
}
