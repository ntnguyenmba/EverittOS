import { NextResponse } from 'next/server';
import { fetchOrganizationContextForUser } from '@/lib/organization-server';
import { canSeeOrgWideData } from '@/lib/permissions';
import { createServerSupabase } from '@/lib/supabase-server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const OPEN_LEAD_STAGES = ['open', 'contacted', 'qualified', 'proposal_sent', 'negotiation', 'reopened'];

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
  const leadRecords = customers.filter((c) => c.record_type === 'lead');
  const newLeads = leadRecords.filter((c) => c.created_at && c.created_at >= since).length;
  const openLeads = leadRecords.filter((c) => OPEN_LEAD_STAGES.includes(c.pipeline_stage || '')).length;

  // Converted leads retain their lead source when their record type changes to customer.
  const convertedLeads = customers.filter(
    (c) => c.record_type === 'customer' && Boolean(c.lead_source)
  ).length;
  const totalTrackedLeads = leadRecords.length + convertedLeads;
  const conversionRate = totalTrackedLeads > 0
    ? Math.round((convertedLeads / totalTrackedLeads) * 100)
    : 0;

  const bySource: Record<string, number> = {};
  for (const c of leadRecords) {
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
