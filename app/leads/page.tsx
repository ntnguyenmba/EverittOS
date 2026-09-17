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
    title: 'Requests', subtitle: 'Keep track of people who may book work.', add: 'Add request',
    filterTitles: { open: 'Open requests', closed: 'Not booked', archived: 'Archived' },
    open: 'Open', notBooked: 'Not booked', archived: 'Archived', archive: 'Archive',
    search: 'Search', searchPlaceholder: 'Name, phone, or email', loading: 'Loading…',
    updateError: 'Unable to update request.', updated: 'Request updated.',
    archiveError: 'Unable to archive request.', archivedSuccess: 'Request archived.',
    reopenError: 'Unable to reopen request.', reopenedSuccess: 'Request reopened.',
    archiveConfirm: 'Archive {name}? You can reopen it later.', openRecord: 'Open {name} in a new tab',
    statusFor: 'Status for {name}', new: 'New', contacted: 'Contacted', interested: 'Interested',
    quoteSent: 'Quote sent', followingUp: 'Following up', reopened: 'Reopened', reopen: 'Reopen'
  },
  es: {
    title: 'Solicitudes', subtitle: 'Lleve un registro de las personas que podrían reservar trabajo.', add: 'Agregar solicitud',
    filterTitles: { open: 'Solicitudes abiertas', closed: 'No reservado', archived: 'Archivadas' },
    open: 'Abrir', notBooked: 'No reservado', archived: 'Archivadas', archive: 'Archivar',
    search: 'Buscar', searchPlaceholder: 'Nombre, teléfono o correo', loading: 'Cargando…',
    updateError: 'No se pudo actualizar la solicitud.', updated: 'Solicitud actualizada.',
    archiveError: 'No se pudo archivar la solicitud.', archivedSuccess: 'Solicitud archivada.',
    reopenError: 'No se pudo reabrir la solicitud.', reopenedSuccess: 'Solicitud reabierta.',
    archiveConfirm: '¿Archivar {name}? Puede reabrirlo más tarde.', openRecord: 'Abrir {name} en una pestaña nueva',
    statusFor: 'Estado de {name}', new: 'Nueva', contacted: 'Contactada', interested: 'Interesada',
    quoteSent: 'Cotización enviada', followingUp: 'En seguimiento', reopened: 'Reabierta', reopen: 'Reabrir'
  },
  vi: {
    title: 'Yêu cầu', subtitle: 'Theo dõi những người có thể đặt công việc.', add: 'Thêm yêu cầu',
    filterTitles: { open: 'Yêu cầu đang mở', closed: 'Chưa đặt', archived: 'Đã lưu trữ' },
    open: 'Mở', notBooked: 'Chưa đặt', archived: 'Đã lưu trữ', archive: 'Lưu trữ',
    search: 'Tìm kiếm', searchPlaceholder: 'Tên, điện thoại hoặc email', loading: 'Đang tải…',
    updateError: 'Không thể cập nhật yêu cầu.', updated: 'Đã cập nhật yêu cầu.',
    archiveError: 'Không thể lưu trữ yêu cầu.', archivedSuccess: 'Đã lưu trữ yêu cầu.',
    reopenError: 'Không thể mở lại yêu cầu.', reopenedSuccess: 'Đã mở lại yêu cầu.',
    archiveConfirm: 'Lưu trữ {name}? Bạn có thể mở lại sau.', openRecord: 'Mở {name} trong thẻ mới',
    statusFor: 'Trạng thái của {name}', new: 'Mới', contacted: 'Đã liên hệ', interested: 'Quan tâm',
    quoteSent: 'Đã gửi báo giá', followingUp: 'Đang theo dõi', reopened: 'Đã mở lại', reopen: 'Mở lại'
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

    const [{ data: profile }, org] = await Promise.all([
      supabase.from('profiles').select('plan, role').eq('id', user.id).maybeSingle(),
      fetchOrganizationContext(user.id)
    ]);
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
      appFeedback.error(json.error || c.updateError);
      return;
    }

    appFeedback.success(c.updated);
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
      appFeedback.error(json.error || c.archiveError);
      return;
    }

    appFeedback.success(c.archivedSuccess);
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
      appFeedback.error(json.error || c.reopenError);
      return;
    }

    appFeedback.success(c.reopenedSuccess);
    setFilter('open');
    void load();
  }

  return (
    <AppShell plan={plan} role={role}>
      <header className="page-header">
        <div className="page-header-text">
          <h1>{c.title}</h1>
          <p className="page-subtitle">{c.subtitle}</p>
        </div>
        {canManage ? (
          <div className="page-header-action">
            <Link className="btn btn-primary" href="/leads/new">
              {c.add}
            </Link>
          </div>
        ) : null}
      </header>

      <div className="card">
        <div className="inline-actions" style={{ justifyContent: 'space-between', marginBottom: 14 }}>
          <h3>{c.filterTitles[filter]}</h3>
          <div className="inline-actions">
            <button type="button" className={`btn btn-sm ${filter === 'open' ? 'btn-primary' : ''}`} onClick={() => setFilter('open')}>
              {c.open}
            </button>
            <button type="button" className={`btn btn-sm ${filter === 'closed' ? 'btn-primary' : ''}`} onClick={() => setFilter('closed')}>
              {c.notBooked}
            </button>
            <button type="button" className={`btn btn-sm ${filter === 'archived' ? 'btn-primary' : ''}`} onClick={() => setFilter('archived')}>
              {c.archived}
            </button>
          </div>
        </div>

        <label style={{ display: 'block', marginBottom: 16 }}>
          <span className="field-label">{c.search}</span>
          <input
            className="input"
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
            placeholder={c.searchPlaceholder}
          />
        </label>

        {loading ? <p className="muted">{c.loading}</p> : null}

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
                <Link href={`/leads/${lead.id}`} target="_blank" rel="noopener noreferrer" className="record-card-overlay-link" aria-label={c.openRecord.replace('{name}', customerDisplayName(lead))}><span className="record-card-overlay-label">{c.openRecord.replace('{name}', customerDisplayName(lead))}</span></Link>
                <div style={{ flex: '1 1 220px' }}>
                  <Link href={`/leads/${lead.id}`} target="_blank" rel="noopener noreferrer">{customerDisplayName(lead)}</Link>
                  <div className="muted" style={{ marginTop: 3 }}>
                    {[lead.phone, lead.email].filter(Boolean).join(' · ') || leadSourceLabel(lead.lead_source)}
                  </div>
                </div>

                {canManage && isOpen ? (
                  <select
                    className="input"
                    aria-label={c.statusFor.replace('{name}', customerDisplayName(lead))}
                    value={stage}
                    disabled={busy}
                    onChange={(event) => void updateLeadStage(lead.id, event.target.value)}
                    style={{ width: 'auto', minWidth: 140, paddingTop: 6, paddingBottom: 6 }}
                  >
                    <option value="open">{c.new}</option>
                    <option value="contacted">{c.contacted}</option>
                    <option value="qualified">{c.interested}</option>
                    <option value="proposal_sent">{c.quoteSent}</option>
                    <option value="negotiation">{c.followingUp}</option>
                    <option value="reopened">{c.reopened}</option>
                    <option value="closed_lost">{c.notBooked}</option>
                  </select>
                ) : (
                  <span className="muted">{isClosed ? c.notBooked : leadPipelineLabel(lead.pipeline_stage)}</span>
                )}

                {updatingStageId === lead.id ? <span className="muted">{FEEDBACK.loading}</span> : null}

                <Link className="btn btn-sm" href={`/leads/${lead.id}`} target="_blank" rel="noopener noreferrer">
                  {c.open}
                </Link>

                {canManage && (isArchived || isClosed) ? (
                  <button type="button" className="btn btn-sm" disabled={busy} onClick={() => void reopenLead(lead.id)}>
                    {reopeningId === lead.id ? FEEDBACK.loading : c.reopen}
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
