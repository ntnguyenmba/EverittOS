'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AppShell } from '@/components/app-shell';
import { LeadDetailForm } from '@/components/lead-detail-form';
import { useAppFeedback } from '@/components/feedback/use-app-feedback';
import { CUSTOMER_LIST_SELECT, customerDisplayName, type CustomerRecord } from '@/lib/customer-record';
import { leadPipelineLabel } from '@/lib/lead-pipeline';
import { leadSourceLabel } from '@/lib/lead-sources';
import { normalizePlan, type EverittosPlan } from '@/lib/everittos-plans';
import { isManagerRole, normalizeRole, type UserRole } from '@/lib/roles';
import { ensureWorkspaceForSave } from '@/lib/workspace-client';
import { fetchOrganizationContext } from '@/lib/organization';
import { supabase } from '@/lib/supabase';

type PageProps = { params: Promise<{ id: string }> };

export default function LeadDetailPage({ params }: PageProps) {
  const router = useRouter();
  const appFeedback = useAppFeedback();
  const [leadId, setLeadId] = useState('');
  const [lead, setLead] = useState<CustomerRecord | null>(null);
  const [plan, setPlan] = useState<EverittosPlan>('free');
  const [role, setRole] = useState<UserRole>('owner');
  const [canManage, setCanManage] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    params.then((p) => setLeadId(p.id));
  }, [params]);

  async function load() {
    if (!leadId) return;
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
    let query = supabase.from('customers').select(CUSTOMER_LIST_SELECT).eq('id', leadId);
    if (workspaceOrg?.organizationId) {
      query = query.eq('organization_id', workspaceOrg.organizationId);
    } else {
      query = query.eq('user_id', user.id);
    }

    const { data, error } = await query.maybeSingle();
    setLoading(false);

    if (error || !data) {
      appFeedback.error(error?.message || 'Lead not found.');
      return;
    }

    setLead(data as CustomerRecord);
  }

  useEffect(() => {
    void load();
  }, [leadId]);

  if (loading) {
    return (
      <AppShell plan={plan} role={role}>
        <div className="card">Loading lead…</div>
      </AppShell>
    );
  }

  if (!lead) {
    return (
      <AppShell plan={plan} role={role}>
        <div className="card">
          Lead not found.{' '}
          <Link href="/leads" className="btn">
            Back to leads
          </Link>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell plan={plan} role={role}>
      <header className="page-header">
        <div className="page-header-text">
          <h1>{customerDisplayName(lead)}</h1>
          <p className="page-subtitle">
            {leadSourceLabel(lead.lead_source)} · {leadPipelineLabel(lead.pipeline_stage)}
          </p>
        </div>
        <div className="page-header-action">
          <Link className="btn" href={`/customers/${lead.id}`}>
            Open customer record
          </Link>
        </div>
      </header>

      <LeadDetailForm
        leadId={lead.id}
        canManage={canManage}
        onSaved={load}
        initial={{
          displayName: customerDisplayName(lead),
          phone: lead.phone || '',
          email: lead.email || '',
          notes: lead.notes || '',
          leadSource: lead.lead_source || 'website',
          pipelineStage: lead.pipeline_stage || 'lead'
        }}
      />
    </AppShell>
  );
}
