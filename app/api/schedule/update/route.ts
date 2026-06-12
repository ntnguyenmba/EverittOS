import { NextResponse } from 'next/server';
import { logWorkspaceActivity } from '@/lib/activity-server';
import { createAdminSupabase } from '@/lib/supabase-admin';
import { syncJobToGoogleCalendarSafe } from '@/lib/google-calendar-sync-job';
import { canAssignJobs } from '@/lib/roles';
import { mapWorkspaceSaveError } from '@/lib/workspace-server';
import { requireWorkspaceSession } from '@/lib/workspace-api-auth';
import { departmentBelongsToOrg, workerBelongsToOrg } from '@/lib/org-validation';
export async function POST(request: Request) {
  const ctx = await requireWorkspaceSession();
  if (!ctx.ok) {
    return NextResponse.json({ error: ctx.error, code: ctx.code }, { status: ctx.status });
  }
  if (!canAssignJobs(ctx.workspace.role)) {
    return NextResponse.json({ error: 'Permission denied' }, { status: 403 });
  }

  const body = (await request.json()) as {
    jobId?: string;
    scheduled_start?: string | null;
    scheduled_end?: string | null;
    start_date?: string | null;
    due_date?: string | null;
    assigned_to?: string | null;
    department_id?: string | null;
  };

  if (!body.jobId) return NextResponse.json({ error: 'jobId is required' }, { status: 400 });

  const admin = createAdminSupabase();
  if (!admin) return NextResponse.json({ error: 'Server not configured' }, { status: 503 });

  const { data: job } = await admin
    .from('jobs')
    .select('organization_id, title')
    .eq('id', body.jobId)
    .maybeSingle();

  if (!job || job.organization_id !== ctx.workspace.organizationId) {
    return NextResponse.json({ error: 'Job not found' }, { status: 404 });
  }

  if (body.assigned_to) {
    const validWorker = await workerBelongsToOrg(admin, body.assigned_to, ctx.workspace.organizationId);
    if (!validWorker) {
      return NextResponse.json({ error: 'Worker not found in organization' }, { status: 400 });
    }
  }

  if (body.department_id) {
    const validDepartment = await departmentBelongsToOrg(admin, body.department_id, ctx.workspace.organizationId);
    if (!validDepartment) {
      return NextResponse.json({ error: 'Department not found in organization' }, { status: 400 });
    }
  }

  const update: Record<string, unknown> = {};
  if (body.scheduled_start !== undefined) update.scheduled_start = body.scheduled_start;
  if (body.scheduled_end !== undefined) update.scheduled_end = body.scheduled_end;
  if (body.start_date !== undefined) update.start_date = body.start_date;
  if (body.due_date !== undefined) update.due_date = body.due_date;
  if (body.assigned_to !== undefined) update.assigned_to = body.assigned_to;
  if (body.department_id !== undefined) update.department_id = body.department_id;

  if (body.scheduled_start && !body.start_date) {
    update.start_date = body.scheduled_start.slice(0, 10);
  }
  if (body.scheduled_end && !body.due_date) {
    update.due_date = body.scheduled_end.slice(0, 10);
  }

  const { error } = await admin
    .from('jobs')
    .update(update)
    .eq('id', body.jobId)
    .eq('organization_id', ctx.workspace.organizationId);
  if (error) return NextResponse.json({ error: mapWorkspaceSaveError(error.message) }, { status: 400 });

  await syncJobToGoogleCalendarSafe(admin, ctx.workspace.organizationId, body.jobId);

  await logWorkspaceActivity(
    ctx.workspace.organizationId,
    ctx.userId,
    'job',
    body.jobId,
    'schedule_changed',
    `Schedule updated: ${job.title || 'Job'}`
  );

  return NextResponse.json({ ok: true, message: 'Schedule saved successfully.' });
}
