import { NextResponse } from 'next/server';
import { logWorkspaceActivity } from '@/lib/activity-server';
import {
  buildPropertyWritePayload,
  CUSTOMER_PROPERTY_SELECT,
  normalizePropertyType,
  stripSensitivePropertyFields,
  type PropertyWriteInput
} from '@/lib/customer-property';
import { isValidUuid } from '@/lib/input-validation';
import { isManagerRole, normalizeRole } from '@/lib/roles';
import { isValidTimeZone } from '@/lib/time-zones';
import { timezoneFromCoordinates } from '@/lib/timezone-from-coords';
import { mapWorkspaceSaveError } from '@/lib/workspace-server';
import { requireWorkspaceSession } from '@/lib/workspace-api-auth';
import { isMissingSchemaError } from '@/lib/supabase-schema-errors';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type RouteContext = { params: Promise<{ id: string }> };

async function assertCustomerAccess(
  ctx: Awaited<ReturnType<typeof requireWorkspaceSession>>,
  customerId: string
) {
  if (!ctx.ok) return null;
  const { data } = await ctx.supabase
    .from('customers')
    .select('id')
    .eq('id', customerId)
    .eq('organization_id', ctx.workspace.organizationId)
    .maybeSingle();
  return data;
}

function parseBody(body: Record<string, unknown>): PropertyWriteInput {
  return {
    name: String(body.name || '').trim(),
    property_type: body.property_type ? normalizePropertyType(body.property_type) : 'home',
    formatted_address: body.formatted_address != null ? String(body.formatted_address) : body.address != null ? String(body.address) : null,
    address_line_1: body.address_line_1 != null ? String(body.address_line_1) : null,
    address_line_2: body.address_line_2 != null ? String(body.address_line_2) : null,
    city: body.city != null ? String(body.city) : null,
    county: body.county != null ? String(body.county) : null,
    state: body.state != null ? String(body.state) : null,
    state_code: body.state_code != null ? String(body.state_code) : null,
    postal_code: body.postal_code != null ? String(body.postal_code) : null,
    country: body.country != null ? String(body.country) : null,
    country_code: body.country_code != null ? String(body.country_code) : null,
    latitude: typeof body.latitude === 'number' ? body.latitude : body.latitude != null ? Number(body.latitude) : null,
    longitude: typeof body.longitude === 'number' ? body.longitude : body.longitude != null ? Number(body.longitude) : null,
    timezone: body.timezone != null ? String(body.timezone) : null,
    access_instructions: body.access_instructions != null ? String(body.access_instructions) : null,
    gate_code: body.gate_code != null ? String(body.gate_code) : null,
    lockbox_code: body.lockbox_code != null ? String(body.lockbox_code) : null,
    parking_instructions: body.parking_instructions != null ? String(body.parking_instructions) : null,
    pet_notes: body.pet_notes != null ? String(body.pet_notes) : null,
    supply_notes: body.supply_notes != null ? String(body.supply_notes) : null,
    internal_notes: body.internal_notes != null ? String(body.internal_notes) : body.notes != null ? String(body.notes) : null,
    notes: body.notes != null ? String(body.notes) : null,
    default_price: body.default_price != null && body.default_price !== '' ? Number(body.default_price) : null,
    default_duration_minutes:
      body.default_duration_minutes != null && body.default_duration_minutes !== ''
        ? Number(body.default_duration_minutes)
        : null,
    default_checklist_id: body.default_checklist_id ? String(body.default_checklist_id) : null,
    preferred_contractor_id: body.preferred_contractor_id ? String(body.preferred_contractor_id) : null,
    preferred_team_id: body.preferred_team_id ? String(body.preferred_team_id) : null,
    is_primary: Boolean(body.is_primary),
    is_archived: Boolean(body.is_archived)
  };
}

export async function GET(_request: Request, context: RouteContext) {
  const ctx = await requireWorkspaceSession();
  if (!ctx.ok) {
    return NextResponse.json({ error: ctx.error, code: ctx.code }, { status: ctx.status });
  }

  const { id } = await context.params;
  if (!isValidUuid(id)) {
    return NextResponse.json({ error: 'Invalid customer id.' }, { status: 400 });
  }

  const customer = await assertCustomerAccess(ctx, id);
  if (!customer) {
    return NextResponse.json({ error: 'Customer not found.' }, { status: 404 });
  }

  const canViewSensitive = isManagerRole(normalizeRole(ctx.workspace.role));
  const includeArchived = new URL(_request.url).searchParams.get('includeArchived') === '1';

  let query = ctx.supabase
    .from('customer_properties')
    .select(CUSTOMER_PROPERTY_SELECT)
    .eq('customer_id', id)
    .eq('organization_id', ctx.workspace.organizationId)
    .order('is_primary', { ascending: false })
    .order('name', { ascending: true });

  if (!includeArchived) {
    query = query.eq('is_archived', false);
  }

  const { data, error } = await query;

  if (error) {
    if (isMissingSchemaError(error)) {
      const legacy = await ctx.supabase
        .from('customer_properties')
        .select('id, customer_id, name, address, notes, created_at')
        .eq('customer_id', id)
        .eq('organization_id', ctx.workspace.organizationId)
        .order('name', { ascending: true });
      return NextResponse.json({
        properties: (legacy.data || []).map((row) =>
          stripSensitivePropertyFields(
            {
              ...row,
              formatted_address: row.address,
              property_type: 'home',
              is_primary: false,
              is_archived: false
            },
            canViewSensitive
          )
        ),
        schemaPending: true
      });
    }
    return NextResponse.json(
      { error: mapWorkspaceSaveError(error.message, 'Unable to load properties.') },
      { status: 400 }
    );
  }

  return NextResponse.json({
    properties: ((data || []) as unknown as import('@/lib/customer-property').CustomerPropertyRecord[]).map((row) =>
      stripSensitivePropertyFields(row, canViewSensitive)
    )
  });
}

export async function POST(request: Request, context: RouteContext) {
  const ctx = await requireWorkspaceSession({ requireManager: true });
  if (!ctx.ok) {
    return NextResponse.json({ error: ctx.error, code: ctx.code }, { status: ctx.status });
  }

  const { id } = await context.params;
  if (!isValidUuid(id)) {
    return NextResponse.json({ error: 'Invalid customer id.' }, { status: 400 });
  }

  const customer = await assertCustomerAccess(ctx, id);
  if (!customer) {
    return NextResponse.json({ error: 'Customer not found.' }, { status: 404 });
  }

  const raw = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const input = parseBody(raw);
  if (!input.name) {
    return NextResponse.json({ error: 'Property name is required.' }, { status: 400 });
  }

  let timezone = input.timezone?.trim() || null;
  if (timezone && !isValidTimeZone(timezone)) {
    return NextResponse.json({ error: 'Choose a valid property timezone.' }, { status: 400 });
  }
  if (!timezone && input.latitude != null && input.longitude != null) {
    timezone = timezoneFromCoordinates(input.latitude, input.longitude);
  }

  const propertyFields = buildPropertyWritePayload({ ...input, timezone });
  const payload: Record<string, unknown> = {
    ...propertyFields,
    organization_id: ctx.workspace.organizationId,
    customer_id: id,
    user_id: ctx.userId
  };

  if (propertyFields.is_primary) {
    await ctx.supabase
      .from('customer_properties')
      .update({ is_primary: false })
      .eq('customer_id', id)
      .eq('organization_id', ctx.workspace.organizationId);
  }

  const { data, error } = await ctx.supabase
    .from('customer_properties')
    .insert(payload)
    .select(CUSTOMER_PROPERTY_SELECT)
    .single();

  if (error) {
    if (isMissingSchemaError(error)) {
      const legacy = await ctx.supabase
        .from('customer_properties')
        .insert({
          organization_id: ctx.workspace.organizationId,
          customer_id: id,
          user_id: ctx.userId,
          name: input.name,
          address: String(propertyFields.formatted_address || propertyFields.address || '') || null,
          notes: input.notes || null
        })
        .select('id, customer_id, name, address, notes, created_at')
        .single();
      if (legacy.error) {
        return NextResponse.json(
          { error: mapWorkspaceSaveError(legacy.error.message, 'Unable to create property. Please try again.') },
          { status: 400 }
        );
      }
      return NextResponse.json({
        property: legacy.data,
        message: 'Property created successfully.',
        schemaPending: true
      });
    }
    return NextResponse.json(
      { error: mapWorkspaceSaveError(error.message, 'Unable to create property. Please try again.') },
      { status: 400 }
    );
  }

  const created = data as unknown as { name: string };
  await logWorkspaceActivity(
    ctx.workspace.organizationId,
    ctx.userId,
    'customer',
    id,
    'customer_property_created',
    `Customer property created: ${created.name}`
  );

  return NextResponse.json({ property: data, message: 'Property created successfully.' });
}
