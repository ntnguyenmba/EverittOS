import { NextResponse } from 'next/server';
import { CUSTOMER_LIST_SELECT } from '@/lib/customer-record';
import { requireWorkspaceSession } from '@/lib/workspace-api-auth';
import { isMissingSchemaError } from '@/lib/supabase-schema-errors';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const ctx = await requireWorkspaceSession();
  if (!ctx.ok) {
    return NextResponse.json({ error: ctx.error, code: ctx.code }, { status: ctx.status });
  }

  let query = await ctx.supabase
    .from('customers')
    .select(CUSTOMER_LIST_SELECT)
    .eq('organization_id', ctx.workspace.organizationId)
    .neq('record_type', 'lead')
    .order('company_name', { ascending: true });

  if (query.error && isMissingSchemaError(query.error)) {
    query = await ctx.supabase
      .from('customers')
      .select('id, company_name, contact_name, email, phone, address_line1, service_address, property_address, organization_id')
      .eq('organization_id', ctx.workspace.organizationId)
      .order('company_name', { ascending: true });
  }

  if (query.error) {
    return NextResponse.json({ error: 'Unable to load customers.' }, { status: 400 });
  }

  return NextResponse.json({ customers: query.data || [] });
}
