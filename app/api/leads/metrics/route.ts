import { NextResponse } from 'next/server';
import { fetchOrganizationContextForUser } from '@/lib/organization-server';
import { canSeeOrgWideData } from '@/lib/permissions';
import { createServerSupabase } from '@/lib/supabase-server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const PIPELINE_LEAD = ['lead', 'qualified', 'proposal_sent', 'negotiation'];
const WON = ['won'];

export async function GET() {
  const supabase = await createServerSupabase();
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const org = await fetchOrganizationContextForUser(supabase, user.id);
  if (!org || !canSeeOrgWideData(org.role)) {
    return NextResponse.json({ error: 'Permission denied' }, { status: 403 });
  }

  const orgId = org.organizationId;
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const since = thirtyDaysAgo.toISOString();

  const [customersRes, submissionsRes, proposalsRes] = await Promise.all([
    supabase
      .from('customers')
      .select('id, pipeline_stage, lead_source, created_at, record_type')
      .eq('organization_id', orgId),
    supabase
      .from('everitt_form_submissions')
      .select('id, created_at')
      .eq('organization_id', orgId)
      .gte('created_at', since),
    supabase
      .from('proposals')
      .select('id, status, created_at')
      .eq('organization_id', orgId)
      .gte('created_at', since)
  ]);

  if (customersRes.error) {
    return NextResponse.json({ error: customersRes.error.message }, { status: 500 });
  }

  const customers = customersRes.data || [];
  const newLeads = customers.filter(
    (c) =>
      c.record_type === 'lead' &&
      c.created_at &&
      c.created_at >= since
  ).length;

  const openLeads = customers.filter((c) => PIPELINE_LEAD.includes(c.pipeline_stage || '')).length;
  const wonCount = customers.filter((c) => WON.includes(c.pipeline_stage || '')).length;
  const totalLeads = customers.filter((c) => c.record_type === 'lead').length;
  const conversionRate = totalLeads > 0 ? Math.round((wonCount / totalLeads) * 100) : 0;

  const bySource: Record<string, number> = {};
  for (const c of customers) {
    if (c.record_type !== 'lead') continue;
    const src = c.lead_source || 'manual';
    bySource[src] = (bySource[src] || 0) + 1;
  }

  const proposals = proposalsRes.data || [];
  const proposalsSent = proposals.length;
  const proposalsAccepted = proposals.filter((p) => p.status === 'accepted').length;

  return NextResponse.json({
    metrics: {
      newLeads30d: newLeads,
      openLeads,
      conversionRate,
      formSubmissions30d: (submissionsRes.data || []).length,
      proposalsSent30d: proposalsSent,
      proposalsAccepted30d: proposalsAccepted,
      bySource
    }
  });
}
