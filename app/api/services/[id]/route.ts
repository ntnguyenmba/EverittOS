import { NextResponse } from 'next/server';
import { logWorkspaceActivity } from '@/lib/activity-server';
import { mapWorkspaceSaveError } from '@/lib/workspace-server';
import { requireWorkspaceSession } from '@/lib/workspace-api-auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type RouteContext = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, context: RouteContext) {
  const ctx = await requireWorkspaceSession({ requireManager: true });
  if (!ctx.ok) {
    return NextResponse.json({ error: ctx.error, code: ctx.code }, { status: ctx.status });
  }

  const { id } = await context.params;
  const body = (await request.json()) as Record<string, unknown>;

  const payload: Record<string, unknown> = {};
  if (body.name !== undefined) payload.name = String(body.name).trim();
  if (body.category !== undefined) payload.category = body.category ? String(body.category).trim() : null;
  if (body.description !== undefined) payload.description = body.description ? String(body.description).trim() : null;
  if (body.duration_minutes !== undefined) payload.duration_minutes = Math.round(Number(body.duration_minutes));
  if (body.price_cents !== undefined) payload.price_cents = Math.round(Number(body.price_cents));
  if (body.is_active !== undefined) payload.is_active = Boolean(body.is_active);

  if (!Object.keys(payload).length) {
    return NextResponse.json({ error: 'No valid fields to update.' }, { status: 400 });
  }

  const { data, error } = await ctx.supabase
    .from('services')
    .update(payload)
    .eq('id', id)
    .eq('organization_id', ctx.workspace.organizationId)
    .select('*')
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: mapWorkspaceSaveError(error.message) }, { status: 400 });
  }
  if (!data) {
    return NextResponse.json({ error: 'Service not found.' }, { status: 404 });
  }

  await logWorkspaceActivity(
    ctx.workspace.organizationId,
    ctx.userId,
    'service',
    id,
    'service_updated',
    `Service updated: ${data.name}`
  );

  return NextResponse.json({ ok: true, service: data, message: 'Service updated successfully.' });
}

export async function DELETE(_request: Request, context: RouteContext) {
  const ctx = await requireWorkspaceSession({ requireManager: true });
  if (!ctx.ok) {
    return NextResponse.json({ error: ctx.error, code: ctx.code }, { status: ctx.status });
  }

  const { id } = await context.params;

  const { data: existing } = await ctx.supabase
    .from('services')
    .select('id, name')
    .eq('id', id)
    .eq('organization_id', ctx.workspace.organizationId)
    .maybeSingle();

  if (!existing) {
    return NextResponse.json({ error: 'Service not found.' }, { status: 404 });
  }

  const { error } = await ctx.supabase
    .from('services')
    .delete()
    .eq('id', id)
    .eq('organization_id', ctx.workspace.organizationId);

  if (error) {
    return NextResponse.json({ error: mapWorkspaceSaveError(error.message) }, { status: 400 });
  }

  await logWorkspaceActivity(
    ctx.workspace.organizationId,
    ctx.userId,
    'service',
    id,
    'service_deleted',
    `Service removed: ${existing.name}`
  );

  return NextResponse.json({ ok: true, message: 'Service removed successfully.' });
}
