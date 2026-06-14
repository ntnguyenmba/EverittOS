import { NextResponse } from 'next/server';
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

  if (body.starts_at !== undefined) payload.starts_at = body.starts_at;
  if (body.ends_at !== undefined) payload.ends_at = body.ends_at;
  if (body.buffer_minutes !== undefined) payload.buffer_minutes = Number(body.buffer_minutes);
  if (body.max_bookings !== undefined) payload.max_bookings = Number(body.max_bookings);
  if (body.is_active !== undefined) payload.is_active = Boolean(body.is_active);
  if (body.day_of_week !== undefined) payload.day_of_week = Number(body.day_of_week);

  const { data, error } = await ctx.supabase
    .from('staff_availability')
    .update(payload)
    .eq('id', id)
    .eq('organization_id', ctx.workspace.organizationId)
    .select('*')
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: mapWorkspaceSaveError(error.message) }, { status: 400 });
  }
  if (!data) {
    return NextResponse.json({ error: 'Availability not found.' }, { status: 404 });
  }

  return NextResponse.json({ ok: true, availability: data, message: 'Availability updated successfully.' });
}

export async function DELETE(_request: Request, context: RouteContext) {
  const ctx = await requireWorkspaceSession({ requireManager: true });
  if (!ctx.ok) {
    return NextResponse.json({ error: ctx.error, code: ctx.code }, { status: ctx.status });
  }

  const { id } = await context.params;

  const { error } = await ctx.supabase
    .from('staff_availability')
    .delete()
    .eq('id', id)
    .eq('organization_id', ctx.workspace.organizationId);

  if (error) {
    return NextResponse.json({ error: mapWorkspaceSaveError(error.message) }, { status: 400 });
  }

  return NextResponse.json({ ok: true, message: 'Availability removed successfully.' });
}
