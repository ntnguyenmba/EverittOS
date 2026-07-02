import { NextResponse } from 'next/server';
import { logWorkspaceActivity } from '@/lib/activity-server';
import { mapWorkspaceSaveError } from '@/lib/workspace-server';
import { requireWorkspaceSession } from '@/lib/workspace-api-auth';
import { canAssignJobs } from '@/lib/roles';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type RouteContext = { params: Promise<{ id: string }> };

const ALLOWED_FIELDS = new Set([
  'title',
  'customer_name',
  'phone',
  'address',
  'notes',
  'status',
  'start_date',
  'due_date',
  'scheduled_start',
  'scheduled_end',
  'assigned_to',
  'priority',
  'internal_notes',
  'customer_notes',
  'completion_verified',
  'customer_id'
]);

export async function PATCH(request: Request, context: RouteContext) {
  const ctx = await requireWorkspaceSession();
  if (!ctx.ok) {
    return NextResponse.json({ error: ctx.error, code: ctx.code }, { status: ctx.status });
  }

  const { id } = await context.params;
  const body = (await request.json()) as Record<string, unknown>;

  const { data: existing, error: readError } = await ctx.supabase
    .from('jobs')
    .select('id, title')
    .eq('id', id)
    .eq('organization_id', ctx.workspace.organizationId)
    .maybeSingle();

  if (readError) {
    return NextResponse.json({ error: mapWorkspaceSaveError(readError.message) }, { status: 400 });
  }
  if (!existing) {
    return NextResponse.json({ error: 'Job not found.' }, { status: 404 });
  }

  const payload: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(body)) {
    if (ALLOWED_FIELDS.has(key)) {
      payload[key] = value;
    }
  }

  if ('assigned_to' in payload && !canAssignJobs(ctx.workspace.role)) {
    return NextResponse.json({ error: 'You do not have permission to assign jobs.' }, { status: 403 });
  }

  if (!Object.keys(payload).length) {
    return NextResponse.json({ error: 'No valid fields to update.' }, { status: 400 });
  }

  const { error } = await ctx.supabase.from('jobs').update(payload).eq('id', id);

  if (error) {
    return NextResponse.json({ error: mapWorkspaceSaveError(error.message) }, { status: 400 });
  }

  await logWorkspaceActivity(
    ctx.workspace.organizationId,
    ctx.userId,
    'job',
    id,
    'job_updated',
    `Job updated: ${existing.title || 'Untitled'}`
  );

  return NextResponse.json({ ok: true, message: 'Job saved successfully.' });
}

export async function DELETE(_request: Request, context: RouteContext) {
  const ctx = await requireWorkspaceSession({ requireManager: true });
  if (!ctx.ok) {
    return NextResponse.json({ error: ctx.error, code: ctx.code }, { status: ctx.status });
  }

  const { id } = await context.params;

  const { data: existing, error: readError } = await ctx.supabase
    .from('jobs')
    .select('id, title')
    .eq('id', id)
    .eq('organization_id', ctx.workspace.organizationId)
    .maybeSingle();

  if (readError) {
    return NextResponse.json({ error: mapWorkspaceSaveError(readError.message) }, { status: 400 });
  }
  if (!existing) {
    return NextResponse.json({ error: 'Job not found.' }, { status: 404 });
  }

  const { error } = await ctx.supabase.from('jobs').delete().eq('id', id);

  if (error) {
    const msg = error.message.toLowerCase();
    if (msg.includes('foreign key') || msg.includes('violates')) {
      const { error: cancelError } = await ctx.supabase
        .from('jobs')
        .update({ status: 'cancelled' })
        .eq('id', id);
      if (cancelError) {
        return NextResponse.json({ error: mapWorkspaceSaveError(cancelError.message) }, { status: 400 });
      }
      await logWorkspaceActivity(
        ctx.workspace.organizationId,
        ctx.userId,
        'job',
        id,
        'job_deleted',
        `Job cancelled: ${existing.title || 'Untitled'}`
      );
      return NextResponse.json({ ok: true, cancelled: true, message: 'Job removed from schedule.' });
    }
    return NextResponse.json({ error: mapWorkspaceSaveError(error.message) }, { status: 400 });
  }

  await logWorkspaceActivity(
    ctx.workspace.organizationId,
    ctx.userId,
    'job',
    id,
    'job_deleted',
    `Job deleted: ${existing.title || 'Untitled'}`
  );

  return NextResponse.json({ ok: true, message: 'Job removed successfully.' });
}
