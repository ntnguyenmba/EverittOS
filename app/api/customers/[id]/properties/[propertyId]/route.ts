import { NextResponse } from 'next/server';
import { logWorkspaceActivity } from '@/lib/activity-server';
import { isValidUuid } from '@/lib/input-validation';
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

  const { data } = await ctx.supabase
    .from('customer_properties')
    .select('id, customer_id, name, address')
    .eq('id', propertyId)
    .eq('customer_id', customerId)
    .eq('organization_id', ctx.workspace.organizationId)
    .maybeSingle();

  return data;
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

  const body = (await request.json()) as { name?: string; address?: string };
  const patch: Record<string, string | null> = {};

  if (body.name !== undefined) {
    const name = String(body.name).trim();
    if (!name) {
      return NextResponse.json({ error: 'Property name is required.' }, { status: 400 });
    }
    patch.name = name;
  }

  if (body.address !== undefined) {
    patch.address = String(body.address).trim() || null;
  }

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: 'No property changes were provided.' }, { status: 400 });
  }

  const { data, error } = await ctx.supabase
    .from('customer_properties')
    .update(patch)
    .eq('id', propertyId)
    .eq('customer_id', id)
    .eq('organization_id', ctx.workspace.organizationId)
    .select('id, customer_id, name, address')
    .single();

  if (error) {
    return NextResponse.json(
      { error: mapWorkspaceSaveError(error.message, 'Unable to save property. Please try again.') },
      { status: 400 }
    );
  }

  await logWorkspaceActivity(
    ctx.workspace.organizationId,
    ctx.userId,
    'customer',
    id,
    'customer_property_updated',
    `Customer property updated: ${data.name}`
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

  const { error } = await ctx.supabase
    .from('customer_properties')
    .delete()
    .eq('id', propertyId)
    .eq('customer_id', id)
    .eq('organization_id', ctx.workspace.organizationId);

  if (error) {
    const message = error.message.toLowerCase();
    if (message.includes('foreign key') || message.includes('violates')) {
      return NextResponse.json(
        { error: 'This property is linked to other records. Update those records first, then try again.' },
        { status: 409 }
      );
    }

    return NextResponse.json(
      { error: mapWorkspaceSaveError(error.message, 'Unable to remove property. Please try again.') },
      { status: 400 }
    );
  }

  await logWorkspaceActivity(
    ctx.workspace.organizationId,
    ctx.userId,
    'customer',
    id,
    'customer_property_deleted',
    `Customer property removed: ${existing.name}`
  );

  return NextResponse.json({ ok: true, message: 'Property removed successfully.' });
}
