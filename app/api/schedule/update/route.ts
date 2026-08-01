import { NextResponse } from 'next/server';
import { logWorkspaceActivity } from '@/lib/activity-server';
import { trackProductEventServer } from '@/lib/product-analytics-server';
import { createAdminSupabase } from '@/lib/supabase-admin';
import { syncJobToGoogleCalendarSafe } from '@/lib/google-calendar-sync-job';
import {
  cleanVisits,
  scheduleFieldsFromVisits,
  sortVisits,
  validateVisits,
  type VisitInput
} from '@/lib/job-visits';
import { localDateFromIso, normalizeJobScheduleTimestamp } from '@/lib/schedule-times';
import { canAssignJobs } from '@/lib/roles';
import { isValidTimeZone } from '@/lib/time-zones';
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
    timezone?: string | null;
    visits?: VisitInput[];
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
  let visitCount = 0;

  if (Array.isArray(body.visits)) {
    const visits = sortVisits(cleanVisits(body.visits));
    if (visits.length > 0) {
      const visitError = validateVisits(visits);
      if (visitError) {
        return NextResponse.json({ error: visitError }, { status: 400 });
      }
    }

    visitCount = visits.length;

    const { error: deleteError } = await admin
      .from('job_visits')
      .delete()
      .eq('job_id', body.jobId)
      .eq('organization_id', ctx.workspace.organizationId);

    if (deleteError) return NextResponse.json({ error: mapWorkspaceSaveError(deleteError.message) }, { status: 400 });

    if (visits.length > 0) {
      const { error: insertError } = await admin.from('job_visits').insert(
        visits.map((visit) => ({
          organization_id: ctx.workspace.organizationId,
          job_id: body.jobId,
          visit_date: visit.visit_date,
          start_time: visit.start_time,
          end_time: visit.end_time,
          notes: visit.notes
        }))
      );

      if (insertError) return NextResponse.json({ error: mapWorkspaceSaveError(insertError.message) }, { status: 400 });

      Object.assign(update, scheduleFieldsFromVisits(visits));
    } else {
      Object.assign(update, {
        scheduled_start: null,
        scheduled_end: null,
        start_date: null,
        due_date: null
      });
    }
  } else {
    const normalizedStart = normalizeJobScheduleTimestamp(body.scheduled_start);
    const normalizedEnd = normalizeJobScheduleTimestamp(body.scheduled_end);

    if (body.scheduled_start !== undefined) {
      if (body.scheduled_start && !normalizedStart) {
        return NextResponse.json({ error: 'Invalid scheduled start time.' }, { status: 400 });
      }
      update.scheduled_start = normalizedStart;
    }
    if (body.scheduled_end !== undefined) {
      if (body.scheduled_end && !normalizedEnd) {
        return NextResponse.json({ error: 'Invalid scheduled end time.' }, { status: 400 });
      }
      update.scheduled_end = normalizedEnd;
    }
    if (body.start_date !== undefined) update.start_date = body.start_date;
    if (body.due_date !== undefined) update.due_date = body.due_date;

    if (normalizedStart && !body.start_date) {
      update.start_date = localDateFromIso(normalizedStart) || normalizedStart.slice(0, 10);
    }
    if (normalizedEnd && !body.due_date) {
      update.due_date = localDateFromIso(normalizedEnd) || normalizedEnd.slice(0, 10);
    }
  }

  if (body.assigned_to !== undefined) update.assigned_to = body.assigned_to;
  if (body.department_id !== undefined) update.department_id = body.department_id;
  if (body.timezone !== undefined) {
    if (body.timezone === null || body.timezone === '') {
      update.timezone = null;
    } else if (!isValidTimeZone(body.timezone)) {
      return NextResponse.json({ error: 'Invalid job timezone.' }, { status: 400 });
    } else {
      update.timezone = body.timezone.trim();
    }
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
    Array.isArray(body.visits) && visitCount === 0
      ? `Schedule cleared: ${job.title || 'Job'}`
      : `Schedule updated: ${job.title || 'Job'}`,
    { timezone: body.timezone ?? null, visitCount }
  );

  await trackProductEventServer(ctx.supabase, 'appointment_scheduled', {
    organizationId: ctx.workspace.organizationId,
    userId: ctx.userId,
    metadata: { jobId: body.jobId, visitCount, timezone: body.timezone ?? null }
  });

  return NextResponse.json({
    ok: true,
    message: Array.isArray(body.visits)
      ? visitCount === 0
        ? 'Schedule cleared successfully.'
        : 'Visits saved successfully.'
      : 'Schedule saved successfully.'
  });
}
