import { NextResponse } from 'next/server';
import { logWorkspaceActivity } from '@/lib/activity-server';
import { logJobFlowEvent } from '@/lib/job-flow-log';
import { listWorkspaceJobs } from '@/lib/jobs-org-query';
import { resolveAssigneeWorkerId } from '@/lib/job-assignee';
import { enforcePlanForUser } from '@/lib/plan-enforce-server';
import { trackProductEventServer } from '@/lib/product-analytics-server';
import { validateAssignedEmail } from '@/lib/job-assigned-email';
import { mapWorkspaceSaveError, workspaceScopedFields } from '@/lib/workspace-server';
import { requireWorkspaceSession } from '@/lib/workspace-api-auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const ctx = await requireWorkspaceSession();
  if (!ctx.ok) {
    return NextResponse.json({ error: ctx.error, code: ctx.code }, { status: ctx.status });
  }

  const url = new URL(request.url);
  const customerId = url.searchParams.get('customer') || undefined;
  const status = url.searchParams.get('status') || undefined;
  const period = url.searchParams.get('period');
  const assignmentFilter = url.searchParams.get('filter');
  const assignedTo = url.searchParams.get('assigned_to') || undefined;
  const createdFrom = url.searchParams.get('from') || undefined;
  const completedSince =
    period === 'week' && status === 'completed'
      ? new Date(Date.now() - 7 * 86400000).toISOString()
      : undefined;

  const { jobs, error } = await listWorkspaceJobs(
    ctx.supabase,
    ctx.userId,
    ctx.workspace.organizationId,
    ctx.workspace.role,
    {
      customerId,
      status,
      completedSince,
      unassignedOnly: assignmentFilter === 'unassigned',
      assignedTo,
      createdFrom
    }
  );

  if (error) {
    logJobFlowEvent('job_list_failed', {
      userId: ctx.userId,
      organizationId: ctx.workspace.organizationId,
      reason: error
    });
    return NextResponse.json({ error: 'Unable to load jobs. Try refreshing the page.' }, { status: 500 });
  }

  return NextResponse.json({
    jobs,
    organizationId: ctx.workspace.organizationId,
    total: jobs.length
  });
}

export async function POST(request: Request) {
  const ctx = await requireWorkspaceSession({ requireManager: true });
  if (!ctx.ok) {
    return NextResponse.json({ error: ctx.error, code: ctx.code }, { status: ctx.status });
  }

  const body = (await request.json()) as {
    title?: string;
    customer_name?: string;
    phone?: string;
    address?: string;
    notes?: string;
    customer_id?: string | null;
    assigned_to?: string | null;
    assigned_email?: string | null;
    status?: string;
  };

  if (!body.title?.trim()) {
    return NextResponse.json({ error: 'Job title is required.' }, { status: 400 });
  }

  const emailCheck = validateAssignedEmail(body.assigned_email);
  if (!emailCheck.ok) {
    return NextResponse.json({ error: emailCheck.error }, { status: 400 });
  }

  const assignedTo = body.assigned_to?.trim() || null;
  let assignedWorkerId: string | null = null;

  if (assignedTo) {
    const { data: member } = await ctx.supabase
      .from('organization_members')
      .select('user_id')
      .eq('organization_id', ctx.workspace.organizationId)
      .eq('user_id', assignedTo)
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
        assignedTo
      );
    } catch (error) {
      return NextResponse.json(
        { error: error instanceof Error ? error.message : 'Unable to link assigned teammate.' },
        { status: 400 }
      );
    }
  }

  const planCheck = await enforcePlanForUser(ctx.supabase, ctx.userId, 'jobs');
  if (!planCheck.allowed) {
    return NextResponse.json({ error: planCheck.message || 'Plan limit reached.' }, { status: 403 });
  }

  const { data, error } = await ctx.supabase
    .from('jobs')
    .insert({
      ...workspaceScopedFields(ctx.workspace, ctx.userId),
      title: body.title.trim(),
      customer_name: body.customer_name?.trim() || null,
      phone: body.phone?.trim() || null,
      address: body.address?.trim() || null,
      notes: body.notes?.trim() || null,
      customer_id: body.customer_id || null,
      assigned_to: assignedWorkerId || assignedTo,
      assigned_email: emailCheck.email,
      status: body.status?.trim() || 'new'
    })
    .select('id')
    .single();

  if (error) {
    logJobFlowEvent('job_create_failed', {
      userId: ctx.userId,
      organizationId: ctx.workspace.organizationId,
      reason: error.message
    });
    return NextResponse.json({ error: mapWorkspaceSaveError(error.message) }, { status: 400 });
  }

  if (assignedWorkerId) {
    await ctx.supabase.from('job_assignments').upsert(
      {
        organization_id: ctx.workspace.organizationId,
        user_id: ctx.userId,
        job_id: data.id,
        worker_id: assignedWorkerId,
        responsibility: 'primary'
      },
      { onConflict: 'job_id,worker_id' }
    );
  }

  logJobFlowEvent('job_create_succeeded', {
    userId: ctx.userId,
    organizationId: ctx.workspace.organizationId,
    jobId: data.id
  });

  await logWorkspaceActivity(
    ctx.workspace.organizationId,
    ctx.userId,
    'job',
    data.id,
    'job_created',
    `Job created: ${body.title.trim()}`,
    { assignedTo, assignedWorkerId, assignedEmail: emailCheck.email }
  );

  if (assignedTo) {
    await ctx.supabase.from('notifications').insert({
      organization_id: ctx.workspace.organizationId,
      user_id: assignedTo,
      type: 'assignment',
      title: 'New job assigned',
      body: body.title.trim(),
      related_job_id: data.id
    });

    await logWorkspaceActivity(
      ctx.workspace.organizationId,
      ctx.userId,
      'job',
      data.id,
      'job_assigned',
      `Job assigned to a teammate`,
      { assignedTo, assignedWorkerId, assignedEmail: emailCheck.email }
    );
  }

  await trackProductEventServer(ctx.supabase, 'job_created', {
    organizationId: ctx.workspace.organizationId,
    userId: ctx.userId,
    metadata: { jobId: data.id, assignedTo, assignedWorkerId }
  });

  return NextResponse.json({ ok: true, job: data, message: 'Job saved successfully.' });
}
