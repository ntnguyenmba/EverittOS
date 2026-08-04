import { NextResponse } from 'next/server';
import { sendAssignmentNotification } from '@/lib/assignment-notifications';
import { logWorkspaceActivity } from '@/lib/activity-server';
import { syncJobToGoogleCalendarSafe } from '@/lib/google-calendar-sync-job';
import { validateAssignedEmail } from '@/lib/job-assigned-email';
import {
  previousIsoDate,
  resolveOccurrenceAnchorDate,
  selectRecurringJobsForPermanentDelete
} from '@/lib/job-permanent-delete';
import { ensureWorkerForPerson } from '@/lib/people-assignment';
import { canAssignJobs } from '@/lib/roles';
import { localDateFromIso, normalizeJobScheduleTimestamp } from '@/lib/schedule-times';
import { createAdminSupabase } from '@/lib/supabase-admin';
import { isValidTimeZone } from '@/lib/time-zones';
import { mapWorkspaceSaveError } from '@/lib/workspace-server';
import { requireWorkspaceSession } from '@/lib/workspace-api-auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type RouteContext = { params: Promise<{ id: string }> };

const ALLOWED_FIELDS = new Set([
  'title',
  'customer_name',
  'customer_email',
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
  'customer_id',
  'property_id',
  'timezone'
]);

const INTERNAL_ONLY_FIELDS = new Set(['internal_notes']);

const MANAGER_ONLY_FIELDS = new Set([
  'title',
  'customer_name',
  'customer_email',
  'phone',
  'address',
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
  'property_id',
  'internal_notes',
  'timezone'
]);

const STAFF_ALLOWED_FIELDS = new Set(['status', 'notes']);

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
        ctx.workspace.ownerUserId || ctx.userId,
        profile?.email
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
    .select('id, title, completed_at, status')
    .eq('id', id)
    .eq('organization_id', ctx.workspace.organizationId)
    .maybeSingle();

  if (readError) {
    return NextResponse.json({ error: mapWorkspaceSaveError(readError.message) }, { status: 400 });
  }
  if (!existing) {
    return NextResponse.json({ error: 'Job not found.' }, { status: 404 });
  }

  const { data: editableShare } = ctx.canManage
    ? { data: null }
    : await ctx.supabase
        .from('record_shares')
        .select('id')
        .eq('organization_id', ctx.workspace.organizationId)
        .eq('record_type', 'job')
        .eq('record_id', id)
        .eq('shared_with_user_id', ctx.userId)
        .eq('access_level', 'edit')
        .maybeSingle();

  const canEditSharedJob = Boolean(editableShare?.id);
  const canEditJobDetails = ctx.canManage || canEditSharedJob;

  if (Object.keys(body).some((key) => INTERNAL_ONLY_FIELDS.has(key)) && !ctx.canManage) {
    return NextResponse.json({ error: 'Only owners, admins, and managers can edit internal job notes.' }, { status: 403 });
  }

  const payload: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(body)) {
    if (ALLOWED_FIELDS.has(key) || (ctx.canManage && INTERNAL_ONLY_FIELDS.has(key))) {
      payload[key] = value;
    }
  }

  delete payload.completed_at;
  if (String(payload.status || '').toLowerCase() === 'completed' && !existing.completed_at) {
    payload.completed_at = new Date().toISOString();
  }

  const payloadKeys = Object.keys(payload);

  if (!payloadKeys.length) {
    return NextResponse.json({ error: 'No valid fields to update.' }, { status: 400 });
  }

  if (!canEditJobDetails) {
    const staffOnlyUpdate = payloadKeys.every((key) => STAFF_ALLOWED_FIELDS.has(key));
    if (!staffOnlyUpdate) {
      return NextResponse.json(
        { error: 'Only owners, admins, managers, or teammates with edit access can edit job details.' },
        { status: 403 }
      );
    }
  }

  if (payloadKeys.some((key) => MANAGER_ONLY_FIELDS.has(key)) && !canEditJobDetails) {
    return NextResponse.json({ error: 'You do not have permission to edit this job.' }, { status: 403 });
  }

  if ('timezone' in payload) {
    const rawTimeZone = payload.timezone;
    if (rawTimeZone === null || rawTimeZone === '') {
      payload.timezone = null;
    } else if (!isValidTimeZone(rawTimeZone)) {
      return NextResponse.json({ error: 'Invalid job timezone.' }, { status: 400 });
    } else {
      payload.timezone = rawTimeZone.trim();
    }
  }

  if ('scheduled_start' in payload) {
    const rawStart = payload.scheduled_start;
    if (rawStart !== null && typeof rawStart !== 'string') {
      return NextResponse.json({ error: 'Invalid scheduled start time.' }, { status: 400 });
    }
    const normalizedStart = normalizeJobScheduleTimestamp(rawStart);
    if (rawStart && !normalizedStart) {
      return NextResponse.json({ error: 'Invalid scheduled start time.' }, { status: 400 });
    }
    payload.scheduled_start = normalizedStart;
    if (normalizedStart && !('start_date' in payload)) {
      payload.start_date = localDateFromIso(normalizedStart);
    }
  }

  if ('scheduled_end' in payload) {
    const rawEnd = payload.scheduled_end;
    if (rawEnd !== null && typeof rawEnd !== 'string') {
      return NextResponse.json({ error: 'Invalid scheduled end time.' }, { status: 400 });
    }
    const normalizedEnd = normalizeJobScheduleTimestamp(rawEnd);
    if (rawEnd && !normalizedEnd) {
      return NextResponse.json({ error: 'Invalid scheduled end time.' }, { status: 400 });
    }
    payload.scheduled_end = normalizedEnd;
    if (normalizedEnd && !('due_date' in payload)) {
      payload.due_date = localDateFromIso(normalizedEnd);
    }
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

  const { error } = await ctx.supabase
    .from('jobs')
    .update(payload)
    .eq('id', id)
    .eq('organization_id', ctx.workspace.organizationId);

  if (error) {
    return NextResponse.json({ error: mapWorkspaceSaveError(error.message) }, { status: 400 });
  }

  const scheduleChanged = ['scheduled_start', 'scheduled_end', 'start_date', 'due_date', 'timezone'].some((field) => field in payload);
  if (scheduleChanged) {
    const admin = createAdminSupabase();
    if (admin) {
      await syncJobToGoogleCalendarSafe(admin, ctx.workspace.organizationId, id);
    }
  }

  await logWorkspaceActivity(
    ctx.workspace.organizationId,
    ctx.userId,
    'job',
    id,
    canEditJobDetails ? 'job_updated' : 'job_status_updated',
    canEditJobDetails ? `Job updated: ${existing.title || 'Untitled'}` : `Job status updated: ${existing.title || 'Untitled'}`,
    { assignedTo: payload.assigned_to ?? null, assignedUserId, timezone: payload.timezone ?? null }
  );

  if (assignedUserId) {
    await sendAssignmentNotification({
      supabase: ctx.supabase,
      organizationId: ctx.workspace.organizationId,
      assignedUserId,
      kind: 'job',
      recordId: id,
      title: existing.title || 'Untitled job',
      email: typeof payload.assigned_email === 'string' ? payload.assigned_email : null
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
    .select('id, title, status, recurring_series_id, occurrence_date, start_date')
    .eq('id', id)
    .eq('organization_id', ctx.workspace.organizationId)
    .maybeSingle();

  if (readError) {
    return NextResponse.json({ error: mapWorkspaceSaveError(readError.message) }, { status: 400 });
  }
  if (!existing) {
    return NextResponse.json({ error: 'Job not found.' }, { status: 404 });
  }

  // Prefer atomic DB function when available (series truncate + deletes in one transaction).
  const rpc = await ctx.supabase.rpc('permanently_delete_job', { p_job_id: id });
  if (!rpc.error && rpc.data) {
    const result = rpc.data as {
      ok?: boolean;
      deletedJobCount?: number;
      recurringSeriesEnded?: boolean;
      deletedFromDate?: string | null;
      deletedJobIds?: string[];
    };
    const deletedJobCount = Number(result.deletedJobCount || 0);
    await logWorkspaceActivity(
      ctx.workspace.organizationId,
      ctx.userId,
      'job',
      id,
      'job_deleted',
      existing.recurring_series_id
        ? `Recurring job deleted from ${result.deletedFromDate || 'selected visit'}: ${existing.title || 'Untitled'}`
        : `Job deleted: ${existing.title || 'Untitled'}`,
      {
        deletedJobCount,
        recurringSeriesId: existing.recurring_series_id || null,
        deletedFromDate: result.deletedFromDate || null,
        deletedJobIds: result.deletedJobIds || []
      }
    );
    return NextResponse.json({
      ok: true,
      deletedJobCount,
      recurringSeriesEnded: Boolean(result.recurringSeriesEnded),
      message: existing.recurring_series_id
        ? `${deletedJobCount} recurring visit${deletedJobCount === 1 ? '' : 's'} removed.`
        : 'Job removed.'
    });
  }

  if (rpc.error && !/could not find|does not exist|schema cache|function/i.test(rpc.error.message || '')) {
    const message = mapWorkspaceSaveError(rpc.error.message);
    const conflict = /reference|foreign key|still reference|could not be permanently deleted/i.test(
      rpc.error.message || ''
    );
    return NextResponse.json(
      {
        error: conflict
          ? `This job could not be permanently deleted because related records still reference it. ${message}`
          : message
      },
      { status: conflict ? 409 : 400 }
    );
  }

  let jobIds = [existing.id];
  let deletedFromDate: string | null = null;

  if (existing.recurring_series_id) {
    deletedFromDate = resolveOccurrenceAnchorDate(existing);
    if (!deletedFromDate) {
      return NextResponse.json({ error: 'This recurring visit is missing its occurrence date.' }, { status: 400 });
    }

    const { data: seriesJobs, error: futureError } = await ctx.supabase
      .from('jobs')
      .select('id, status, occurrence_date, start_date')
      .eq('organization_id', ctx.workspace.organizationId)
      .eq('recurring_series_id', existing.recurring_series_id);

    if (futureError) {
      return NextResponse.json({ error: mapWorkspaceSaveError(futureError.message) }, { status: 400 });
    }

    jobIds = selectRecurringJobsForPermanentDelete(seriesJobs || [], existing.id, deletedFromDate);

    if (!jobIds.length) {
      return NextResponse.json(
        { error: 'Completed historical visits were preserved and there is nothing to delete.' },
        { status: 400 }
      );
    }

    // End the series before deletes so the generator cannot recreate removed visits.
    const { error: seriesError } = await ctx.supabase
      .from('recurring_job_series')
      .update({
        status: 'ended',
        end_date: previousIsoDate(deletedFromDate),
        next_generation_date: null,
        updated_at: new Date().toISOString()
      })
      .eq('id', existing.recurring_series_id)
      .eq('organization_id', ctx.workspace.organizationId);

    if (seriesError) {
      return NextResponse.json({ error: mapWorkspaceSaveError(seriesError.message) }, { status: 400 });
    }
  }

  if (!jobIds.length) {
    return NextResponse.json(
      { error: 'Completed historical visits were preserved and there is nothing to delete.' },
      { status: 400 }
    );
  }

  await ctx.supabase
    .from('record_shares')
    .delete()
    .eq('organization_id', ctx.workspace.organizationId)
    .eq('record_type', 'job')
    .in('record_id', jobIds);

  const { error: deleteError } = await ctx.supabase
    .from('jobs')
    .delete()
    .eq('organization_id', ctx.workspace.organizationId)
    .in('id', jobIds);

  if (deleteError) {
    return NextResponse.json(
      {
        error: `This job could not be permanently deleted because related records still reference it. ${mapWorkspaceSaveError(deleteError.message)}`
      },
      { status: 409 }
    );
  }

  await logWorkspaceActivity(
    ctx.workspace.organizationId,
    ctx.userId,
    'job',
    id,
    'job_deleted',
    existing.recurring_series_id
      ? `Recurring job deleted from ${deletedFromDate}: ${existing.title || 'Untitled'}`
      : `Job deleted: ${existing.title || 'Untitled'}`,
    { deletedJobCount: jobIds.length, recurringSeriesId: existing.recurring_series_id || null, deletedFromDate }
  );

  return NextResponse.json({
    ok: true,
    deletedJobCount: jobIds.length,
    recurringSeriesEnded: Boolean(existing.recurring_series_id),
    message: existing.recurring_series_id
      ? `${jobIds.length} recurring visit${jobIds.length === 1 ? '' : 's'} removed.`
      : 'Job removed.'
  });
}
