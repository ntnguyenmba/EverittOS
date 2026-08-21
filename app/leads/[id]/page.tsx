'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AppShell } from '@/components/app-shell';
import { LeadDetailForm } from '@/components/lead-detail-form';
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

function jobHrefForLead(lead: CustomerRecord) {
  const params = new URLSearchParams();
  params.set('customerId', lead.id);
  params.set('customerName', customerDisplayName(lead));
  if (lead.email) params.set('customerEmail', lead.email);
  if (lead.phone) params.set('phone', lead.phone);
  const address = customerDisplayAddress(lead, '');
  if (address) params.set('address', address);
  if (lead.notes) params.set('notes', lead.notes);
  const range = lead.notes?.match(/Estimated range:\s*([^\n]+)/i)?.[1]?.trim();
  const midpoint = lead.notes?.match(/Estimate midpoint:\s*([^\n]+)/i)?.[1]?.trim();
  if (midpoint) params.set('revenue', midpoint);
  if (range) params.set('estimateRange', range);
  return `/jobs/new?${params.toString()}`;
}

function bookingHrefForLead(lead: CustomerRecord) {
  const params = new URLSearchParams();
  params.set('clientName', customerDisplayName(lead));
  if (lead.email) params.set('clientEmail', lead.email);
  if (lead.phone) params.set('clientPhone', lead.phone);
  if (lead.notes) params.set('notes', lead.notes);
  params.set('service', 'Request follow-up');
  return `/bookings?${params.toString()}`;
}

export default function LeadDetailPage({ params }: PageProps) {
  const router = useRouter();
  const appFeedback = useAppFeedback();
  const [leadId, setLeadId] = useState('');
  const [lead, setLead] = useState<CustomerRecord | null>(null);
  const [plan, setPlan] = useState<EverittosPlan>('free');
  const [role, setRole] = useState<UserRole>('owner');
  const [canManage, setCanManage] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => { params.then((p) => setLeadId(p.id)); }, [params]);

  const load = useCallback(async () => {
    if (!leadId) return;
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { router.push('/login'); return; }
    const { data: profile } = await supabase.from('profiles').select('plan, role').eq('id', user.id).maybeSingle();
    const org = await fetchOrganizationContext(user.id);
    const userRole = normalizeRole(org?.role || profile?.role);
    setPlan(normalizePlan(profile?.plan)); setRole(userRole); setCanManage(isManagerRole(userRole));
    const workspace = await ensureWorkspaceForSave(user.id);
    const workspaceOrg = workspace.ok ? workspace.workspace : null;
    let query = supabase.from('customers').select(CUSTOMER_LIST_SELECT).eq('id', leadId);
    query = workspaceOrg?.organizationId ? query.eq('organization_id', workspaceOrg.organizationId) : query.eq('user_id', user.id);
    const { data, error } = await query.maybeSingle();
    setLoading(false);
    if (error || !data) { appFeedback.error(error?.message || 'Request not found.'); return; }
    setLead(data as CustomerRecord);
  }, [appFeedback, leadId, router]);

  useEffect(() => { void load(); }, [load]);
  const bookingHref = useMemo(() => (lead ? bookingHrefForLead(lead) : '/bookings'), [lead]);
  const jobHref = useMemo(() => (lead ? jobHrefForLead(lead) : '/jobs/new'), [lead]);
  const estimateRange = lead?.notes?.match(/Estimated range:\s*([^\n]+)/i)?.[1]?.trim() || '';

  if (loading) return <AppShell plan={plan} role={role}><div className="card">Loading request...</div></AppShell>;
  if (!lead) return <AppShell plan={plan} role={role}><div className="card">Request not found. <Link href="/leads" className="btn">Back to requests</Link></div></AppShell>;

  return (
    <AppShell plan={plan} role={role}>
      <header className="page-header">
        <div className="page-header-text"><h1>{customerDisplayName(lead)}</h1><p className="page-subtitle">{leadSourceLabel(lead.lead_source)} · {leadPipelineLabel(lead.pipeline_stage)}</p></div>
        <div className="page-header-action inline-actions">
          {canManage ? <Link className="btn btn-primary" href={jobHref}>{estimateRange ? 'Approve & create job' : 'Convert to job'}</Link> : null}
          <Link className="btn" href={bookingHref}>Create booking</Link>
          <Link className="btn" href="/leads">Back to requests</Link>
        </div>
      </header>

      {estimateRange ? (
        <div className="card" style={{ marginBottom: 18 }}>
          <p className="muted" style={{ marginBottom: 6 }}>Estimated starting range</p>
          <h2 style={{ margin: 0 }}>{estimateRange}</h2>
          <p className="muted" style={{ marginTop: 8, marginBottom: 0 }}>Review the details below, adjust the final price when needed, then create the job.</p>
        </div>
      ) : null}

      <LeadDetailForm leadId={lead.id} canManage={canManage} onSaved={load} initial={{ displayName: customerDisplayName(lead), phone: lead.phone || '', email: lead.email || '', address: customerDisplayAddress(lead, ''), notes: lead.notes || '', assignedTo: lead.assigned_to || '', leadSource: lead.lead_source || 'website', pipelineStage: normalizeLeadStage(lead.pipeline_stage) }} />
    </AppShell>
  );
}
