import { NextResponse } from 'next/server';
import { fetchOrganizationContextForUser } from '@/lib/organization-server';
import { canSeeOrgWideData } from '@/lib/permissions';
import { createServerSupabase } from '@/lib/supabase-server';
import { localeFromRequest } from '@/lib/i18n/server-request-locale';
import { getLeadsApiCopy } from '@/lib/i18n/leads-api-copy';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const OPEN_LEAD_STAGES = ['open', 'contacted', 'qualified', 'proposal_sent', 'negotiation', 'reopened'];

export async function GET(request: Request) {
  const c = getLeadsApiCopy(localeFromRequest(request));
  const supabase = await createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: c.unauthorized }, { status: 401 });

  const org = await fetchOrganizationContextForUser(supabase, user.id);
  if (!org || !canSeeOrgWideData(org.role)) return NextResponse.json({ error: c.permissionDenied }, { status: 403 });

  const orgId = org.organizationId;
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const since = thirtyDaysAgo.toISOString();

  const [customersRes, submissionsRes, proposalsRes] = await Promise.all([
    supabase.from('customers').select('id, pipeline_stage, lead_source, created_at, updated_at, record_type').eq('organization_id', orgId),
    supabase.from('everitt_form_submissions').select('id, created_at').eq('organization_id', orgId).gte('created_at', since),
    supabase.from('proposals').select('id, status, created_at').eq('organization_id', orgId).gte('created_at', since)
  ]);

  if (customersRes.error || submissionsRes.error || proposalsRes.error) return NextResponse.json({ error: c.loadMetrics }, { status: 500 });

  const customers = customersRes.data || [];
  const leadRecords = customers.filter((customer) => customer.record_type === 'lead');
  const newLeads30d = leadRecords.filter((customer) => Boolean(customer.created_at && customer.created_at >= since)).length;
  const openLeads = leadRecords.filter((customer) => OPEN_LEAD_STAGES.includes(customer.pipeline_stage || '')).length;
  const closedLost30d = leadRecords.filter((customer) => customer.pipeline_stage === 'closed_lost' && Boolean(customer.updated_at && customer.updated_at >= since)).length;

  const convertedCustomers = customers.filter((customer) => customer.record_type === 'customer' && Boolean(customer.lead_source));
  const converted30d = convertedCustomers.filter((customer) => Boolean(customer.updated_at && customer.updated_at >= since)).length;
  const totalTrackedLeads = leadRecords.length + convertedCustomers.length;
  const conversionRate = totalTrackedLeads > 0 ? Math.round((convertedCustomers.length / totalTrackedLeads) * 100) : 0;

  const bySource: Record<string, number> = {};
  for (const customer of leadRecords) {
    const source = customer.lead_source || 'manual';
    bySource[source] = (bySource[source] || 0) + 1;
  }

  const proposals = proposalsRes.data || [];
  return NextResponse.json({ metrics: { newLeads30d, openLeads, converted30d, closedLost30d, conversionRate, formSubmissions30d: (submissionsRes.data || []).length, proposalsSent30d: proposals.length, proposalsAccepted30d: proposals.filter((proposal) => proposal.status === 'accepted').length, bySource } });
}
