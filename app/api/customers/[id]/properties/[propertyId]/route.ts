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
import { isMissingSchemaError } from '@/lib/supabase-schema-errors';
import { mapWorkspaceSaveError } from '@/lib/workspace-server';
import { requireWorkspaceSession } from '@/lib/workspace-api-auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type RouteContext = { params: Promise<{ id: string; propertyId: string }> };

async function getCustomerProperty(
  ctx: Awaited<ReturnType<typeof requireWorkspaceSession>>,
  customerId: string,
  propertyId: string
) {
  if (!ctx.ok) return null;

  const { data, error } = await ctx.supabase
    .from('customer_properties')
    .select(CUSTOMER_PROPERTY_SELECT)
    .eq('id', propertyId)
    .eq('customer_id', customerId)
    .eq('organization_id', ctx.workspace.organizationId)
    .maybeSingle();

  if (error && isMissingSchemaError(error)) {
    const legacy = await ctx.supabase
      .from('customer_properties')
      .select('id, customer_id, name, address, notes, created_at')
      .eq('id', propertyId)
      .eq('customer_id', customerId)
      .eq('organization_id', ctx.workspace.organizationId)
      .maybeSingle();
    return legacy.data;
  }

  return data;
}

function mergePatch(existing: Record<string, unknown>, body: Record<string, unknown>): PropertyWriteInput {
  return {
    name: body.name != null ? String(body.name).trim() : String(existing.name || ''),
    property_type:
      body.property_type != null
        ? normalizePropertyType(body.property_type)
        : normalizePropertyType(existing.property_type),
    formatted_address:
      body.formatted_address != null
        ? String(body.formatted_address)
        : body.address != null
          ? String(body.address)
          : (existing.formatted_address as string | null) || (existing.address as string | null),
    address_line_1: body.address_line_1 != null ? String(body.address_line_1) : (existing.address_line_1 as string | null),
    address_line_2: body.address_line_2 != null ? String(body.address_line_2) : (existing.address_line_2 as string | null),
    city: body.city != null ? String(body.city) : (existing.city as string | null),
    county: body.county != null ? String(body.county) : (existing.county as string | null),
    state: body.state != null ? String(body.state) : (existing.state as string | null),
    state_code: body.state_code != null ? String(body.state_code) : (existing.state_code as string | null),
    postal_code: body.postal_code != null ? String(body.postal_code) : (existing.postal_code as string | null),
    country: body.country != null ? String(body.country) : (existing.country as string | null),
    country_code: body.country_code != null ? String(body.country_code) : (existing.country_code as string | null),
    latitude:
      body.latitude !== undefined
        ? body.latitude == null || body.latitude === ''
          ? null
          : Number(body.latitude)
        : (existing.latitude as number | null),
    longitude:
      body.longitude !== undefined
        ? body.longitude == null || body.longitude === ''
          ? null
          : Number(body.longitude)
        : (existing.longitude as number | null),
    timezone: body.timezone !== undefined ? (body.timezone == null ? null : String(body.timezone)) : (existing.timezone as string | null),
    access_instructions:
      body.access_instructions !== undefined
        ? body.access_instructions == null
          ? null
          : String(body.access_instructions)
        : (existing.access_instructions as string | null),
    gate_code:
      body.gate_code !== undefined
        ? body.gate_code == null
          ? null
          : String(body.gate_code)
        : (existing.gate_code as string | null),
    lockbox_code:
      body.lockbox_code !== undefined
        ? body.lockbox_code == null
          ? null
          : String(body.lockbox_code)
        : (existing.lockbox_code as string | null),
    parking_instructions:
      body.parking_instructions !== undefined
        ? body.parking_instructions == null
          ? null
          : String(body.parking_instructions)
        : (existing.parking_instructions as string | null),
    pet_notes:
      body.pet_notes !== undefined ? (body.pet_notes == null ? null : String(body.pet_notes)) : (existing.pet_notes as string | null),
    supply_notes:
      body.supply_notes !== undefined
        ? body.supply_notes == null
          ? null
          : String(body.supply_notes)
        : (existing.supply_notes as string | null),
    internal_notes:
      body.internal_notes !== undefined
        ? body.internal_notes == null
          ? null
          : String(body.internal_notes)
        : body.notes !== undefined
          ? body.notes == null
            ? null
            : String(body.notes)
          : (existing.internal_notes as string | null) || (existing.notes as string | null),
    notes: body.notes !== undefined ? (body.notes == null ? null : String(body.notes)) : (existing.notes as string | null),
    default_price:
      body.default_price !== undefined
        ? body.default_price == null || body.default_price === ''
          ? null
          : Number(body.default_price)
        : (existing.default_price as number | null),
    default_duration_minutes:
      body.default_duration_minutes !== undefined
        ? body.default_duration_minutes == null || body.default_duration_minutes === ''
          ? null
          : Number(body.default_duration_minutes)
        : (existing.default_duration_minutes as number | null),
    default_checklist_id:
      body.default_checklist_id !== undefined
        ? body.default_checklist_id
          ? String(body.default_checklist_id)
          : null
        : (existing.default_checklist_id as string | null),
    preferred_contractor_id:
      body.preferred_contractor_id !== undefined
        ? body.preferred_contractor_id
          ? String(body.preferred_contractor_id)
          : null
        : (existing.preferred_contractor_id as string | null),
    preferred_team_id:
      body.preferred_team_id !== undefined
        ? body.preferred_team_id
          ? String(body.preferred_team_id)
          : null
        : (existing.preferred_team_id as string | null),
    is_primary: body.is_primary !== undefined ? Boolean(body.is_primary) : Boolean(existing.is_primary),
    is_archived: body.is_archived !== undefined ? Boolean(body.is_archived) : Boolean(existing.is_archived)
  };
}

export async function GET(_request: Request, context: RouteContext) {
  const ctx = await requireWorkspaceSession();
  if (!ctx.ok) {
    return NextResponse.json({ error: ctx.error, code: ctx.code }, { status: ctx.status });
  }

  const { id, propertyId } = await context.params;
  if (!isValidUuid(id) || !isValidUuid(propertyId)) {
    return NextResponse.json({ error: 'Invalid customer or property id.' }, { status: 400 });
  }

  const existing = await getCustomerProperty(ctx, id, propertyId);
  if (!existing) {
    return NextResponse.json({ error: 'Property not found.' }, { status: 404 });
  }

  const canViewSensitive = isManagerRole(normalizeRole(ctx.workspace.role));
  return NextResponse.json({
    property: stripSensitivePropertyFields(existing as Record<string, unknown>, canViewSensitive)
  });
}

export async function PATCH(request: Request, context: RouteContext) {
  const ctx = await requireWorkspaceSession({ requireManager: true });
  if (!ctx.ok) {
    return NextResponse.json({ error: ctx.error, code: ctx.code }, { status: ctx.status });
  }

  const { id, propertyId } = await context.params;
  if (!isValidUuid(id) || !isValidUuid(propertyId)) {
    return NextResponse.json({ error: 'Invalid customer or property id.' }, { status: 400 });
  }

  const existing = await getCustomerProperty(ctx, id, propertyId);
  if (!existing) {
    return NextResponse.json({ error: 'Property not found.' }, { status: 404 });
  }

  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const input = mergePatch(existing as Record<string, unknown>, body);
  if (!input.name) {
    return NextResponse.json({ error: 'Property name is required.' }, { status: 400 });
  }

  let timezone = input.timezone?.trim() || null;
  if (timezone && !isValidTimeZone(timezone)) {
    return NextResponse.json({ error: 'Choose a valid property timezone.' }, { status: 400 });
  }

  const addressChanged =
    body.formatted_address !== undefined ||
    body.address !== undefined ||
    body.address_line_1 !== undefined ||
    body.latitude !== undefined ||
    body.longitude !== undefined;

  if (addressChanged && input.latitude != null && input.longitude != null) {
    timezone = timezoneFromCoordinates(input.latitude, input.longitude, timezone) || timezone;
  }

  const patch = buildPropertyWritePayload({ ...input, timezone });

  if (patch.is_primary) {
    await ctx.supabase
      .from('customer_properties')
      .update({ is_primary: false })
      .eq('customer_id', id)
      .eq('organization_id', ctx.workspace.organizationId)
      .neq('id', propertyId);
  }

  const { data, error } = await ctx.supabase
    .from('customer_properties')
    .update(patch)
    .eq('id', propertyId)
    .eq('customer_id', id)
    .eq('organization_id', ctx.workspace.organizationId)
    .select(CUSTOMER_PROPERTY_SELECT)
    .single();

  if (error) {
    if (isMissingSchemaError(error)) {
      const legacyPatch: Record<string, string | null> = {};
      if (body.name !== undefined) legacyPatch.name = input.name;
      if (body.address !== undefined || body.formatted_address !== undefined) {
        legacyPatch.address = String(patch.formatted_address || '') || null;
      }
      if (body.notes !== undefined) legacyPatch.notes = input.notes || null;
      const legacy = await ctx.supabase
        .from('customer_properties')
        .update(legacyPatch)
        .eq('id', propertyId)
        .eq('customer_id', id)
        .eq('organization_id', ctx.workspace.organizationId)
        .select('id, customer_id, name, address, notes, created_at')
        .single();
      if (legacy.error) {
        return NextResponse.json(
          { error: mapWorkspaceSaveError(legacy.error.message, 'Unable to save property. Please try again.') },
          { status: 400 }
        );
      }
      return NextResponse.json({ property: legacy.data, message: 'Property saved successfully.', schemaPending: true });
    }
    return NextResponse.json(
      { error: mapWorkspaceSaveError(error.message, 'Unable to save property. Please try again.') },
      { status: 400 }
    );
  }

  const saved = data as unknown as { name: string };
  await logWorkspaceActivity(
    ctx.workspace.organizationId,
    ctx.userId,
    'customer',
    id,
    'customer_property_updated',
    `Customer property updated: ${saved.name}`
  );

  return NextResponse.json({ property: data, message: 'Property saved successfully.' });
}

export async function DELETE(_request: Request, context: RouteContext) {
  const ctx = await requireWorkspaceSession({ requireManager: true });
  if (!ctx.ok) {
    return NextResponse.json({ error: ctx.error, code: ctx.code }, { status: ctx.status });
  }

  const { id, propertyId } = await context.params;
  if (!isValidUuid(id) || !isValidUuid(propertyId)) {
    return NextResponse.json({ error: 'Invalid customer or property id.' }, { status: 400 });
  }

  const existing = await getCustomerProperty(ctx, id, propertyId);
  if (!existing) {
    return NextResponse.json({ error: 'Property not found.' }, { status: 404 });
  }

  // Soft-archive by default to preserve historical job links.
  const { data, error } = await ctx.supabase
    .from('customer_properties')
    .update({ is_archived: true, is_primary: false, updated_at: new Date().toISOString() })
    .eq('id', propertyId)
    .eq('customer_id', id)
    .eq('organization_id', ctx.workspace.organizationId)
    .select('id, name')
    .single();

  if (error) {
    if (isMissingSchemaError(error)) {
      const hard = await ctx.supabase
        .from('customer_properties')
        .delete()
        .eq('id', propertyId)
        .eq('customer_id', id)
        .eq('organization_id', ctx.workspace.organizationId);
      if (hard.error) {
        return NextResponse.json(
          { error: mapWorkspaceSaveError(hard.error.message, 'Unable to remove property. Please try again.') },
          { status: 400 }
        );
      }
      return NextResponse.json({ ok: true, message: 'Property removed successfully.', schemaPending: true });
    }
    return NextResponse.json(
      { error: mapWorkspaceSaveError(error.message, 'Unable to archive property. Please try again.') },
      { status: 400 }
    );
  }

  await logWorkspaceActivity(
    ctx.workspace.organizationId,
    ctx.userId,
    'customer',
    id,
    'customer_property_archived',
    `Customer property archived: ${data?.name || (existing as { name?: string }).name || propertyId}`
  );

  return NextResponse.json({ ok: true, message: 'Property archived successfully.' });
}
