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
  const body = (await request.json()) as { name?: string; role?: string; phone?: string };

  const { data: existing, error: readError } = await ctx.supabase
    .from('workers')
    .select('id, name')
    .eq('id', id)
    .eq('organization_id', ctx.workspace.organizationId)
    .maybeSingle();

  if (readError) {
    return NextResponse.json({ error: mapWorkspaceSaveError(readError.message) }, { status: 400 });
  }
  if (!existing) {
    return NextResponse.json({ error: 'Worker not found.' }, { status: 404 });
  }

  const payload: Record<string, string | null> = {};
  if (body.name !== undefined) payload.name = body.name.trim() || '';
  if (body.role !== undefined) payload.role = body.role?.trim() || null;
  if (body.phone !== undefined) payload.phone = body.phone?.trim() || null;

  if (!Object.keys(payload).length) {
    return NextResponse.json({ error: 'No valid fields to update.' }, { status: 400 });
  }

  const { error } = await ctx.supabase.from('workers').update(payload).eq('id', id);

  if (error) {
    return NextResponse.json({ error: mapWorkspaceSaveError(error.message) }, { status: 400 });
  }

  await logWorkspaceActivity(
    ctx.workspace.organizationId,
    ctx.userId,
    'worker',
    id,
    'worker_updated',
    `Worker updated: ${existing.name}`
  );

  return NextResponse.json({ ok: true, message: 'Worker saved successfully.' });
}

export async function DELETE(_request: Request, context: RouteContext) {
  const ctx = await requireWorkspaceSession({ requireManager: true });
  if (!ctx.ok) {
    return NextResponse.json({ error: ctx.error, code: ctx.code }, { status: ctx.status });
  }

  const { id } = await context.params;

  const { data: existing, error: readError } = await ctx.supabase
    .from('workers')
    .select('id, name')
    .eq('id', id)
    .eq('organization_id', ctx.workspace.organizationId)
    .maybeSingle();

  if (readError) {
    return NextResponse.json({ error: mapWorkspaceSaveError(readError.message) }, { status: 400 });
  }
  if (!existing) {
    return NextResponse.json({ error: 'Worker not found.' }, { status: 404 });
  }

  const { error } = await ctx.supabase.from('workers').delete().eq('id', id);

  if (error) {
    return NextResponse.json({ error: mapWorkspaceSaveError(error.message) }, { status: 400 });
  }

  await logWorkspaceActivity(
    ctx.workspace.organizationId,
    ctx.userId,
    'worker',
    id,
    'worker_deleted',
    `Worker removed: ${existing.name}`
  );

  return NextResponse.json({ ok: true, message: 'Worker removed successfully.' });
}
