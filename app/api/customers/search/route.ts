import { NextResponse } from 'next/server';
import { CUSTOMER_LIST_SELECT, customerDisplayName } from '@/lib/customer-record';
import { propertyDisplayAddress } from '@/lib/customer-property';
import { requireWorkspaceSession } from '@/lib/workspace-api-auth';
import { isMissingSchemaError } from '@/lib/supabase-schema-errors';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const PROPERTY_SEARCH_SELECT =
  'id, customer_id, name, formatted_address, address, address_line_1, address_line_2, city, state, postal_code, property_type, timezone, is_primary, is_archived, default_price, default_duration_minutes, access_instructions, supply_notes, parking_instructions, pet_notes, preferred_contractor_id';

type PropertySearchRow = {
  id: string;
  customer_id: string;
  name: string;
  formatted_address?: string | null;
  address?: string | null;
  address_line_1?: string | null;
  address_line_2?: string | null;
  city?: string | null;
  state?: string | null;
  postal_code?: string | null;
  property_type?: string | null;
  timezone?: string | null;
  is_primary?: boolean | null;
  is_archived?: boolean | null;
  default_price?: number | null;
  default_duration_minutes?: number | null;
  access_instructions?: string | null;
  supply_notes?: string | null;
  parking_instructions?: string | null;
  pet_notes?: string | null;
  preferred_contractor_id?: string | null;
};

export async function GET(request: Request) {
  const ctx = await requireWorkspaceSession({ requireManager: true });
  if (!ctx.ok) {
    return NextResponse.json({ error: ctx.error, code: ctx.code }, { status: ctx.status });
  }

  const q = new URL(request.url).searchParams.get('q')?.trim() || '';
  if (q.length < 1) {
    return NextResponse.json({ customers: [] });
  }

  const pattern = `%${q}%`;
  const orgId = ctx.workspace.organizationId;

  const { data: customers, error } = await ctx.supabase
    .from('customers')
    .select(CUSTOMER_LIST_SELECT)
    .eq('organization_id', orgId)
    .or(
      `company_name.ilike."${pattern}",email.ilike."${pattern}",phone.ilike."${pattern}",address_line1.ilike."${pattern}",service_address.ilike."${pattern}",property_address.ilike."${pattern}"`
    )
    .limit(20);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  const matchedCustomerIds = new Set((customers || []).map((c) => c.id));

  const propMatch = await ctx.supabase
    .from('customer_properties')
    .select(PROPERTY_SEARCH_SELECT)
    .eq('organization_id', orgId)
    .eq('is_archived', false)
    .or(`name.ilike."${pattern}",formatted_address.ilike."${pattern}",address.ilike."${pattern}",city.ilike."${pattern}"`)
    .limit(30);

  let propertyRows: PropertySearchRow[] = (propMatch.data || []) as unknown as PropertySearchRow[];
  if (propMatch.error && isMissingSchemaError(propMatch.error)) {
    const legacy = await ctx.supabase
      .from('customer_properties')
      .select('id, customer_id, name, address')
      .eq('organization_id', orgId)
      .or(`name.ilike."${pattern}",address.ilike."${pattern}"`)
      .limit(30);
    propertyRows = (legacy.data || []).map((row) => ({
      ...row,
      formatted_address: row.address,
      is_archived: false,
      is_primary: false
    }));
  }

  for (const row of propertyRows) matchedCustomerIds.add(row.customer_id);

  const missingIds = Array.from(matchedCustomerIds).filter((id) => !(customers || []).some((c) => c.id === id));
  let allCustomers = customers || [];
  if (missingIds.length) {
    const { data: more } = await ctx.supabase
      .from('customers')
      .select(CUSTOMER_LIST_SELECT)
      .eq('organization_id', orgId)
      .in('id', missingIds);
    allCustomers = [...allCustomers, ...(more || [])];
  }

  const customerIds = allCustomers.map((c) => c.id);
  let propertiesForCustomers = propertyRows;
  if (customerIds.length) {
    const allProps = await ctx.supabase
      .from('customer_properties')
      .select(PROPERTY_SEARCH_SELECT)
      .eq('organization_id', orgId)
      .in('customer_id', customerIds)
      .eq('is_archived', false)
      .order('is_primary', { ascending: false })
      .limit(120);

    if (!allProps.error && allProps.data) {
      propertiesForCustomers = allProps.data as unknown as PropertySearchRow[];
    } else if (allProps.error && isMissingSchemaError(allProps.error)) {
      const legacy = await ctx.supabase
        .from('customer_properties')
        .select('id, customer_id, name, address')
        .eq('organization_id', orgId)
        .in('customer_id', customerIds)
        .limit(120);
      propertiesForCustomers = (legacy.data || []).map((row) => ({
        ...row,
        formatted_address: row.address,
        is_archived: false,
        is_primary: false
      }));
    }
  }

  const results = allCustomers.map((customer) => {
    const customerProperties = propertiesForCustomers
      .filter((p) => p.customer_id === customer.id)
      .map((p) => ({
        id: p.id,
        customer_id: p.customer_id,
        name: p.name,
        property_type: p.property_type || 'home',
        formatted_address: p.formatted_address || p.address || null,
        address: p.address || p.formatted_address || null,
        timezone: p.timezone || null,
        is_primary: Boolean(p.is_primary),
        default_price: p.default_price ?? null,
        default_duration_minutes: p.default_duration_minutes ?? null,
        access_instructions: p.access_instructions || null,
        supply_notes: p.supply_notes || null,
        parking_instructions: p.parking_instructions || null,
        pet_notes: p.pet_notes || null,
        preferred_contractor_id: p.preferred_contractor_id || null,
        display_address: propertyDisplayAddress(p)
      }));

    return {
      id: customer.id,
      name: customerDisplayName(customer),
      email: customer.email,
      phone: customer.phone,
      company_name: customer.company_name,
      address: customer.service_address || customer.address_line1 || null,
      properties: customerProperties
    };
  });

  return NextResponse.json({ customers: results });
}
