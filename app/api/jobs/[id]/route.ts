import { NextResponse } from 'next/server';
import { logWorkspaceActivity } from '@/lib/activity-server';
import { validateAssignedEmail } from '@/lib/job-assigned-email';
import { ensureWorkerForPerson } from '@/lib/people-assignment';
import { canAssignJobs } from '@/lib/roles';
import { mapWorkspaceSaveError } from '@/lib/workspace-server';
import { requireWorkspaceSession } from '@/lib/workspace-api-auth';

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
  'assigned_email',
  'priority',
  'customer_notes',
  'completion_verified',
  'customer_id'
]);

const INTERNAL_ONLY_FIELDS = new Set(['internal_notes']);

const MANAGER_ONLY_FIELDS = new Set([
  'title',
  'customer_name',
  'phone',
  'address',
  'notes',
  'start_date',
  'due_date',
  'scheduled_start',
  'scheduled_end',
  'assigned_to',
  'assigned_email',
  'priority',
  'customer_notes',
  'completion_verified',
  'customer_id',
  'internal_notes'
]);

const STAFF_ALLOWED_FIELDS = new Set(['status']);

async function resolveAssignedWorkerId(
  ctx: Extract<Awaited<ReturnType<typeof requireWorkspaceSession>>, { ok: true }>,
  assignedTo: unknown
): Promise<{ ok: true; workerId: string | null; assignedUserId: string | null } | { ok: false; error: string }> {
  const rawAssignedTo = typeof assignedTo === 'string' ? assignedTo.trim() : '';
  if (!rawAssignedTo) return { ok: true, workerId: null, assignedUserId: null };

  const { data: member } = await ctx.supabase
    .from('organization_members')
    .select('user_id')
    .eq('organization_id', ctx.workspace.organizationId)
    .eq('user_id', rawAssignedTo)
    .eq('active', true)
    .maybeSingle();

  if (member?.user_id) {
    const { data: profile } = await ctx.supabase
      .from('profiles')
      .select('email, full_name')
      .eq('id', rawAssignedTo)
      .maybeSingle();

    const displayName = profile?.full_name?.trim() || profile?.email?.trim() || 'Team member';
    try {
      const workerId = await ensureWorkerForPerson(
        ctx.supabase,
        ctx.workspace.organizationId,
        rawAssignedTo,
        displayName,
        ctx.workspace.ownerUserId || ctx.userId
      );
      return { ok: true, workerId, assignedUserId: rawAssignedTo };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to link this teammate to a worker record.';
      return { ok: false, error: message };
    }
  }

  const { data: worker } = await ctx.supabase
    .from('workers')
    .select('id, auth_user_id')
    .eq('id', rawAssignedTo)
    .eq('organization_id', ctx.workspace.organizationId)
    .maybeSingle();

  if (worker?.id) {
    return { ok: true, workerId: worker.id, assignedUserId: worker.auth_user_id || null };
  }

  return { ok: false, error: 'Assigned teammate must be an active member or worker in this workspace.' };
}

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

  if (Object.keys(body).some((key) => INTERNAL_ONLY_FIELDS.has(key)) && !ctx.canManage) {
    return NextResponse.json({ error: 'Only owners, admins, and managers can edit internal job notes.' }, { status: 403 });
  }

  const payload: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(body)) {
    if (ALLOWED_FIELDS.has(key) || (ctx.canManage && INTERNAL_ONLY_FIELDS.has(key))) {
      payload[key] = value;
    }
  }

  const payloadKeys = Object.keys(payload);

  if (!payloadKeys.length) {
    return NextResponse.json({ error: 'No valid fields to update.' }, { status: 400 });
  }

  if (!ctx.canManage) {
    const staffOnlyUpdate = payloadKeys.every((key) => STAFF_ALLOWED_FIELDS.has(key));
    if (!staffOnlyUpdate) {
      return NextResponse.json(
        { error: 'Only owners, admins, and managers can edit job details, schedule, customer info, and assignments.' },
        { status: 403 }
      );
    }
  }

  if (payloadKeys.some((key) => MANAGER_ONLY_FIELDS.has(key)) && !ctx.canManage) {
    return NextResponse.json({ error: 'You do not have permission to edit this job.' }, { status: 403 });
  }

  let assignedUserId: string | null = null;
  if ('assigned_to' in payload) {
    if (!canAssignJobs(ctx.workspace.role)) {
      return NextResponse.json({ error: 'You do not have permission to assign jobs.' }, { status: 403 });
    }

    const resolvedAssignment = await resolveAssignedWorkerId(ctx, payload.assigned_to);
    if (!resolvedAssignment.ok) {
      return NextResponse.json({ error: resolvedAssignment.error }, { status: 400 });
    }
    payload.assigned_to = resolvedAssignment.workerId;
    assignedUserId = resolvedAssignment.assignedUserId;
  }

  if ('assigned_email' in payload && !canAssignJobs(ctx.workspace.role)) {
    return NextResponse.json({ error: 'You do not have permission to assign jobs.' }, { status: 403 });
  }

  if ('assigned_email' in payload) {
    const emailCheck = validateAssignedEmail(payload.assigned_email);
    if (!emailCheck.ok) {
      return NextResponse.json({ error: emailCheck.error }, { status: 400 });
    }
    payload.assigned_email = emailCheck.email;
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
    ctx.canManage ? 'job_updated' : 'job_status_updated',
    ctx.canManage ? `Job updated: ${existing.title || 'Untitled'}` : `Job status updated: ${existing.title || 'Untitled'}`,
    { assignedTo: payload.assigned_to ?? null, assignedUserId }
  );

  if (assignedUserId) {
    await ctx.supabase.from('notifications').insert({
      organization_id: ctx.workspace.organizationId,
      user_id: assignedUserId,
      type: 'assignment',
      title: 'Job assignment updated',
      body: existing.title || 'Untitled job',
      related_job_id: id
    });
  }

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
