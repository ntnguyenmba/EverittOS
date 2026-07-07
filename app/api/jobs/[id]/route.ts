import { NextResponse } from 'next/server';
import { logWorkspaceActivity } from '@/lib/activity-server';
import { resolveAssigneeWorkerId } from '@/lib/job-assignee';
import { mapWorkspaceSaveError } from '@/lib/workspace-server';
import { requireWorkspaceSession } from '@/lib/workspace-api-auth';
import { canAssignJobs } from '@/lib/roles';
import { validateAssignedEmail } from '@/lib/job-assigned-email';

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

  if ('assigned_to' in payload && !canAssignJobs(ctx.workspace.role)) {
    return NextResponse.json({ error: 'You do not have permission to assign jobs.' }, { status: 403 });
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

  let assignedUserId: string | null = null;
  let assignedWorkerId: string | null = null;

  if ('assigned_to' in payload) {
    assignedUserId = typeof payload.assigned_to === 'string' && payload.assigned_to.trim() ? payload.assigned_to.trim() : null;

    if (assignedUserId) {
      const { data: member } = await ctx.supabase
        .from('organization_members')
        .select('user_id')
        .eq('organization_id', ctx.workspace.organizationId)
        .eq('user_id', assignedUserId)
        .eq('active', true)
        .maybeSingle();

      if (!member) {
        return NextResponse.json({ error: 'Assigned teammate must be an active member of this workspace.' }, { status: 400 });
      }

      try {
        assignedWorkerId = await resolveAssigneeWorkerId(
          ctx.supabase,
          ctx.workspace.organizationId,
          ctx.workspace.ownerUserId || ctx.userId,
          assignedUserId
        );
      } catch (error) {
        return NextResponse.json(
          { error: error instanceof Error ? error.message : 'Unable to link assigned teammate.' },
          { status: 400 }
        );
      }
    }

    payload.assigned_to = assignedWorkerId || assignedUserId;
  }

  const { error } = await ctx.supabase.from('jobs').update(payload).eq('id', id);

  if (error) {
    return NextResponse.json({ error: mapWorkspaceSaveError(error.message) }, { status: 400 });
  }

  if (assignedWorkerId) {
    await ctx.supabase.from('job_assignments').upsert(
      {
        organization_id: ctx.workspace.organizationId,
        user_id: ctx.userId,
        job_id: id,
        worker_id: assignedWorkerId,
        responsibility: 'primary'
      },
      { onConflict: 'job_id,worker_id' }
    );
  }

  await logWorkspaceActivity(
    ctx.workspace.organizationId,
    ctx.userId,
    'job',
    id,
    ctx.canManage ? 'job_updated' : 'job_status_updated',
    ctx.canManage ? `Job updated: ${existing.title || 'Untitled'}` : `Job status updated: ${existing.title || 'Untitled'}`,
    assignedUserId || assignedWorkerId ? { assignedTo: assignedUserId, assignedWorkerId } : undefined
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
