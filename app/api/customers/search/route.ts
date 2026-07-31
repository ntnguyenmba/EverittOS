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

function escapedIlikePattern(value: string) {
  const escaped = value
    .replaceAll('\\', '\\\\')
    .replaceAll('%', '\\%')
    .replaceAll('_', '\\_')
    .replaceAll(',', '\\,')
    .replaceAll('(', '\\(')
    .replaceAll(')', '\\)')
    .replaceAll('"', '\\"');

  return `%${escaped}%`;
}

export async function GET(request: Request) {
  const ctx = await requireWorkspaceSession({ requireManager: true });
  if (!ctx.ok) {
    return NextResponse.json({ error: ctx.error, code: ctx.code }, { status: ctx.status });
  }

  const q = new URL(request.url).searchParams.get('q')?.trim() || '';
  if (q.length < 1) {
    return NextResponse.json({ customers: [] });
  }

  const pattern = escapedIlikePattern(q);
  const orgId = ctx.workspace.organizationId;
  const customerSearchFilter = [
    `company_name.ilike.${pattern}`,
    `email.ilike.${pattern}`,
    `phone.ilike.${pattern}`,
    `address_line1.ilike.${pattern}`,
    `service_address.ilike.${pattern}`,
    `property_address.ilike.${pattern}`
  ].join(',');

  const primaryCustomers = await ctx.supabase
    .from('customers')
    .select(CUSTOMER_LIST_SELECT)
    .eq('organization_id', orgId)
    .or(customerSearchFilter)
    .limit(20);

  const customersQuery =
    primaryCustomers.error && isMissingSchemaError(primaryCustomers.error)
      ? await ctx.supabase
          .from('customers')
          .select(
            'id, company_name, phone, email, notes, logo_path, pipeline_stage, lead_source, record_type, assigned_to, created_at, organization_id, user_id, updated_at, address_line1, address_line2, city, state, postal_code, country, service_address, property_address'
          )
          .eq('organization_id', orgId)
          .or(customerSearchFilter)
          .limit(20)
      : primaryCustomers;

  const { data: customers, error } = customersQuery;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  const matchedCustomerIds = new Set((customers || []).map((customer) => customer.id));
  const propertySearchFilter = [
    `name.ilike.${pattern}`,
    `formatted_address.ilike.${pattern}`,
    `address.ilike.${pattern}`,
    `city.ilike.${pattern}`
  ].join(',');

  const propMatch = await ctx.supabase
    .from('customer_properties')
    .select(PROPERTY_SEARCH_SELECT)
    .eq('organization_id', orgId)
    .eq('is_archived', false)
    .or(propertySearchFilter)
    .limit(30);

  let propertyRows: PropertySearchRow[] = (propMatch.data || []) as unknown as PropertySearchRow[];
  if (propMatch.error && isMissingSchemaError(propMatch.error)) {
    const legacy = await ctx.supabase
      .from('customer_properties')
      .select('id, customer_id, name, address')
      .eq('organization_id', orgId)
      .or([`name.ilike.${pattern}`, `address.ilike.${pattern}`].join(','))
      .limit(30);

    if (legacy.error) {
      return NextResponse.json({ error: legacy.error.message }, { status: 400 });
    }

    propertyRows = (legacy.data || []).map((row) => ({
      ...row,
      formatted_address: row.address,
      is_archived: false,
      is_primary: false
    }));
  } else if (propMatch.error) {
    return NextResponse.json({ error: propMatch.error.message }, { status: 400 });
  }

  for (const row of propertyRows) matchedCustomerIds.add(row.customer_id);

  const currentCustomerIds = new Set((customers || []).map((customer) => customer.id));
  const missingIds = Array.from(matchedCustomerIds).filter((id) => !currentCustomerIds.has(id));
  let allCustomers = customers || [];

  if (missingIds.length) {
    const { data: more, error: moreError } = await ctx.supabase
      .from('customers')
      .select(CUSTOMER_LIST_SELECT)
      .eq('organization_id', orgId)
      .in('id', missingIds);

    if (moreError) {
      return NextResponse.json({ error: moreError.message }, { status: 400 });
    }

    allCustomers = [...allCustomers, ...(more || [])];
  }

  const customerIds = allCustomers.map((customer) => customer.id);
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

      if (legacy.error) {
        return NextResponse.json({ error: legacy.error.message }, { status: 400 });
      }

      propertiesForCustomers = (legacy.data || []).map((row) => ({
        ...row,
        formatted_address: row.address,
        is_archived: false,
        is_primary: false
      }));
    } else if (allProps.error) {
      return NextResponse.json({ error: allProps.error.message }, { status: 400 });
    }
  }

  const results = allCustomers.map((customer) => {
    const customerProperties = propertiesForCustomers
      .filter((property) => property.customer_id === customer.id)
      .map((property) => ({
        id: property.id,
        customer_id: property.customer_id,
        name: property.name,
        property_type: property.property_type || 'home',
        formatted_address: property.formatted_address || property.address || null,
        address: property.address || property.formatted_address || null,
        timezone: property.timezone || null,
        is_primary: Boolean(property.is_primary),
        default_price: property.default_price ?? null,
        default_duration_minutes: property.default_duration_minutes ?? null,
        access_instructions: property.access_instructions || null,
        supply_notes: property.supply_notes || null,
        parking_instructions: property.parking_instructions || null,
        pet_notes: property.pet_notes || null,
        preferred_contractor_id: property.preferred_contractor_id || null,
        display_address: propertyDisplayAddress(property)
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
