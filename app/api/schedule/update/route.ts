import { NextResponse } from 'next/server';
import { logWorkspaceActivity } from '@/lib/activity-server';
import { trackProductEventServer } from '@/lib/product-analytics-server';
import { createAdminSupabase } from '@/lib/supabase-admin';
import { syncJobToGoogleCalendarSafe } from '@/lib/google-calendar-sync-job';
import { canAssignJobs } from '@/lib/roles';
import { mapWorkspaceSaveError } from '@/lib/workspace-server';
import { requireWorkspaceSession } from '@/lib/workspace-api-auth';
import { departmentBelongsToOrg, workerBelongsToOrg } from '@/lib/org-validation';

type VisitInput = {
  id?: string;
  visit_date?: string;
  start_time?: string;
  end_time?: string;
  notes?: string | null;
};

function normalizeDate(value: string | undefined) {
  const trimmed = value?.trim() || '';
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;
  return '';
}

function normalizeTime(value: string | undefined) {
  const trimmed = value?.trim() || '';
  const match = trimmed.match(/^(\d{2}:\d{2})(?::\d{2})?$/);
  return match ? match[1] : '';
}

function combineVisitDateTime(date: string, time: string) {
  return `${date}T${time}:00`;
}

function cleanVisits(visits: VisitInput[]) {
  return visits.map((visit) => ({
    id: visit.id || undefined,
    visit_date: normalizeDate(visit.visit_date),
    start_time: normalizeTime(visit.start_time),
    end_time: normalizeTime(visit.end_time),
    notes: visit.notes?.trim() || null
  }));
}

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
    const visits = cleanVisits(body.visits);
    if (visits.length === 0) {
      return NextResponse.json({ error: 'At least one visit is required.' }, { status: 400 });
    }

    for (const visit of visits) {
      if (!visit.visit_date || !visit.start_time || !visit.end_time) {
        return NextResponse.json({ error: 'Each visit needs a valid date, start time, and end time.' }, { status: 400 });
      }
      if (visit.end_time <= visit.start_time) {
        return NextResponse.json({ error: 'Visit end time must be after start time.' }, { status: 400 });
      }
    }

    visits.sort((a, b) => `${a.visit_date} ${a.start_time}`.localeCompare(`${b.visit_date} ${b.start_time}`));
    visitCount = visits.length;

    const { error: deleteError } = await admin
      .from('job_visits')
      .delete()
      .eq('job_id', body.jobId)
      .eq('organization_id', ctx.workspace.organizationId);

    if (deleteError) return NextResponse.json({ error: mapWorkspaceSaveError(deleteError.message) }, { status: 400 });

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

    const firstVisit = visits[0];
    const lastVisit = visits[visits.length - 1];
    update.start_date = firstVisit.visit_date;
    update.due_date = lastVisit.visit_date;
    update.scheduled_start = combineVisitDateTime(firstVisit.visit_date, firstVisit.start_time);
    update.scheduled_end = combineVisitDateTime(lastVisit.visit_date, lastVisit.end_time);
  } else {
    if (body.scheduled_start !== undefined) update.scheduled_start = body.scheduled_start;
    if (body.scheduled_end !== undefined) update.scheduled_end = body.scheduled_end;
    if (body.start_date !== undefined) update.start_date = body.start_date;
    if (body.due_date !== undefined) update.due_date = body.due_date;

    if (body.scheduled_start && !body.start_date) {
      update.start_date = body.scheduled_start.slice(0, 10);
    }
    if (body.scheduled_end && !body.due_date) {
      update.due_date = body.scheduled_end.slice(0, 10);
    }
  }

  if (body.assigned_to !== undefined) update.assigned_to = body.assigned_to;
  if (body.department_id !== undefined) update.department_id = body.department_id;

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

  await trackProductEventServer(ctx.supabase, 'appointment_scheduled', {
    organizationId: ctx.workspace.organizationId,
    userId: ctx.userId,
    metadata: { jobId: body.jobId, visitCount }
  });

  return NextResponse.json({ ok: true, message: Array.isArray(body.visits) ? 'Visits saved successfully.' : 'Schedule saved successfully.' });
}
