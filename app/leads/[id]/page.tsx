'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AppShell } from '@/components/app-shell';
import { LeadDetailForm } from '@/components/lead-detail-form';
import { useTranslation } from '@/components/locale-provider';
import { useAppFeedback } from '@/components/feedback/use-app-feedback';
import { CUSTOMER_LIST_SELECT, customerDisplayAddress, customerDisplayName, type CustomerRecord } from '@/lib/customer-record';
import { leadPipelineLabel, normalizeLeadStage } from '@/lib/lead-pipeline';
import { leadSourceLabel } from '@/lib/lead-sources';
import { normalizePlan, type EverittosPlan } from '@/lib/everittos-plans';
import { isManagerRole, normalizeRole, type UserRole } from '@/lib/roles';
import { ensureWorkspaceForSave } from '@/lib/workspace-client';
import { fetchOrganizationContext } from '@/lib/organization';
import { supabase } from '@/lib/supabase';

type PageProps = { params: Promise<{ id: string }> };
const copy = {
  en: { loading:'Loading request...', notFound:'Request not found.', back:'Back to requests', approve:'Approve & create job', convert:'Convert to job', booking:'Create booking', range:'Estimated starting range', note:'The suggested midpoint becomes the customer price. You can change it from the job.', creating:'Creating job...', created:'Job created.', failed:'Unable to create job.' },
  es: { loading:'Cargando solicitud...', notFound:'Solicitud no encontrada.', back:'Volver a solicitudes', approve:'Aprobar y crear trabajo', convert:'Convertir en trabajo', booking:'Crear reserva', range:'Rango estimado inicial', note:'El punto medio sugerido se convierte en el precio del cliente. Puedes cambiarlo desde el trabajo.', creating:'Creando trabajo...', created:'Trabajo creado.', failed:'No se pudo crear el trabajo.' },
  vi: { loading:'Đang tải yêu cầu...', notFound:'Không tìm thấy yêu cầu.', back:'Quay lại yêu cầu', approve:'Duyệt và tạo công việc', convert:'Chuyển thành công việc', booking:'Tạo lịch đặt', range:'Khoảng giá ước tính ban đầu', note:'Mức giữa của khoảng giá sẽ trở thành giá khách hàng. Bạn có thể thay đổi trong công việc.', creating:'Đang tạo công việc...', created:'Đã tạo công việc.', failed:'Không thể tạo công việc.' }
} as const;

function noteValue(notes: string | null | undefined, label: string) {
  return notes?.match(new RegExp(`${label}:\\s*([^\\n]+)`, 'i'))?.[1]?.trim() || '';
}

function bookingHrefForLead(lead: CustomerRecord) {
  const p = new URLSearchParams();
  p.set('clientName', customerDisplayName(lead));
  if (lead.email) p.set('clientEmail', lead.email);
  if (lead.phone) p.set('clientPhone', lead.phone);
  if (lead.notes) p.set('notes', lead.notes);
  p.set('service', 'Request follow-up');
  return `/bookings?${p.toString()}`;
}

export default function LeadDetailPage({ params }: PageProps) {
  const router = useRouter();
  const appFeedback = useAppFeedback();
  const { locale } = useTranslation();
  const c = copy[locale];
  const [leadId, setLeadId] = useState('');
  const [lead, setLead] = useState<CustomerRecord | null>(null);
  const [plan, setPlan] = useState<EverittosPlan>('free');
  const [role, setRole] = useState<UserRole>('owner');
  const [canManage, setCanManage] = useState(false);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);

  useEffect(() => { params.then((p) => setLeadId(p.id)); }, [params]);

  const load = useCallback(async () => {
    if (!leadId) return;
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { router.push('/login'); return; }
    const { data: profile } = await supabase.from('profiles').select('plan, role').eq('id', user.id).maybeSingle();
    const org = await fetchOrganizationContext(user.id);
    const userRole = normalizeRole(org?.role || profile?.role);
    setPlan(normalizePlan(profile?.plan));
    setRole(userRole);
    setCanManage(isManagerRole(userRole));
    const workspace = await ensureWorkspaceForSave(user.id);
    const workspaceOrg = workspace.ok ? workspace.workspace : null;
    let query = supabase.from('customers').select(CUSTOMER_LIST_SELECT).eq('id', leadId);
    query = workspaceOrg?.organizationId ? query.eq('organization_id', workspaceOrg.organizationId) : query.eq('user_id', user.id);
    const { data, error } = await query.maybeSingle();
    setLoading(false);
    if (error || !data) { appFeedback.error(error?.message || c.notFound); return; }
    setLead(data as CustomerRecord);
  }, [appFeedback, leadId, router, c.notFound]);

  useEffect(() => { void load(); }, [load]);

  async function createJob() {
    if (!lead || creating) return;
    setCreating(true);
    const service = noteValue(lead.notes, 'Service');
    const frequency = noteValue(lead.notes, 'Frequency');
    const midpoint = noteValue(lead.notes, 'Estimate midpoint');
    const title = service || `${customerDisplayName(lead)} service`;
    const res = await fetch('/api/jobs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title,
        customer_id: lead.id,
        customer_name: customerDisplayName(lead),
        customer_email: lead.email || null,
        phone: lead.phone || null,
        address: customerDisplayAddress(lead, '') || null,
        notes: [frequency ? `Frequency: ${frequency}` : '', lead.notes || ''].filter(Boolean).join('\n\n'),
        revenue_amount: midpoint || null,
        status: 'new'
      })
    });
    const json = await res.json().catch(() => ({})) as { job?: { id: string }; error?: string };
    if (!res.ok || !json.job?.id) {
      setCreating(false);
      appFeedback.error(json.error || c.failed);
      return;
    }
    await supabase.from('customers').update({ record_type: 'customer', pipeline_stage: 'won' }).eq('id', lead.id);
    appFeedback.success(c.created);
    router.push(`/jobs/${json.job.id}`);
  }

  const bookingHref = lead ? bookingHrefForLead(lead) : '/bookings';
  const estimateRange = noteValue(lead?.notes, 'Estimated range');

  if (loading) return <AppShell plan={plan} role={role}><div className="card">{c.loading}</div></AppShell>;
  if (!lead) return <AppShell plan={plan} role={role}><div className="card">{c.notFound} <Link href="/leads" className="btn">{c.back}</Link></div></AppShell>;

  return <AppShell plan={plan} role={role}>
    <header className="page-header">
      <div className="page-header-text"><h1>{customerDisplayName(lead)}</h1><p className="page-subtitle">{leadSourceLabel(lead.lead_source)} · {leadPipelineLabel(lead.pipeline_stage)}</p></div>
      <div className="page-header-action inline-actions">
        {canManage ? <button className="btn btn-primary" type="button" disabled={creating} onClick={() => void createJob()}>{creating ? c.creating : estimateRange ? c.approve : c.convert}</button> : null}
        <Link className="btn" href={bookingHref}>{c.booking}</Link><Link className="btn" href="/leads">{c.back}</Link>
      </div>
    </header>
    {estimateRange ? <div className="card" style={{ marginBottom: 18 }}><p className="muted" style={{ marginBottom: 6 }}>{c.range}</p><h2 style={{ margin: 0 }}>{estimateRange}</h2><p className="muted" style={{ marginTop: 8, marginBottom: 0 }}>{c.note}</p></div> : null}
    <LeadDetailForm leadId={lead.id} canManage={canManage} onSaved={load} initial={{ displayName:customerDisplayName(lead), phone:lead.phone||'', email:lead.email||'', address:customerDisplayAddress(lead,''), notes:lead.notes||'', assignedTo:lead.assigned_to||'', leadSource:lead.lead_source||'website', pipelineStage:normalizeLeadStage(lead.pipeline_stage) }} />
  </AppShell>;
}
