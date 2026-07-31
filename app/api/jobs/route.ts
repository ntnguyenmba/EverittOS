import { NextResponse } from 'next/server';
import { logWorkspaceActivity } from '@/lib/activity-server';
import { syncJobToGoogleCalendarSafe } from '@/lib/google-calendar-sync-job';
import { logJobFlowEvent } from '@/lib/job-flow-log';
import {
  cleanVisits,
  scheduleFieldsFromVisits,
  sortVisits,
  validateVisits,
  type VisitInput
} from '@/lib/job-visits';
import { generateActiveSeriesForOrganization } from '@/lib/generate-recurring-series';
import { fetchJobBillingStatuses } from '@/lib/jobs/billing-status';
import { listWorkspaceJobs } from '@/lib/jobs-org-query';
import { canAccessFinancials } from '@/lib/finance-access';
import { resolveOrganizationPlan } from '@/lib/organization-plan';
import { enforcePlanForUser } from '@/lib/plan-enforce-server';
import { trackProductEventServer } from '@/lib/product-analytics-server';
import { validateAssignedEmail } from '@/lib/job-assigned-email';
import { ensureWorkerForPerson } from '@/lib/people-assignment';
import { isAdminRole, isManagerRole, normalizeRole } from '@/lib/roles';
import { createAdminSupabase } from '@/lib/supabase-admin';
import { mapWorkspaceSaveError, workspaceScopedFields } from '@/lib/workspace-server';
import { requireWorkspaceSession } from '@/lib/workspace-api-auth';
import { localDateFromIso } from '@/lib/schedule-times';
import { isValidTimeZone } from '@/lib/time-zones';
import { isMissingSchemaError } from '@/lib/supabase-schema-errors';

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
  const missingCompletionDateOnly = assignmentFilter === 'missing_completion_date';

  if (missingCompletionDateOnly && !isAdminRole(normalizeRole(ctx.workspace.role))) {
    return NextResponse.json({ error: 'Only owners and admins can use this filter.' }, { status: 403 });
  }

  const completedSince =
    period === 'week' && status === 'completed'
      ? new Date(Date.now() - 7 * 86400000).toISOString()
      : undefined;

  // Managers: top up recurring windows on normal app traffic (no paid cron required).
  if (isManagerRole(normalizeRole(ctx.workspace.role))) {
    void generateActiveSeriesForOrganization(ctx.supabase, ctx.workspace, ctx.userId).catch(() => undefined);
  }

  const { jobs, error } = await listWorkspaceJobs(
    ctx.supabase,
    ctx.userId,
    ctx.workspace.organizationId,
    ctx.workspace.role,
    {
      customerId,
      status: missingCompletionDateOnly ? 'completed' : status,
      completedSince,
      unassignedOnly: assignmentFilter === 'unassigned',
      missingCompletionDateOnly,
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

  let enrichedJobs = jobs;
  const { plan } = await resolveOrganizationPlan(ctx.supabase, ctx.userId);
  const canSeeBilling = canAccessFinancials(ctx.workspace.role, plan);
  if (canSeeBilling && ctx.workspace.organizationId && jobs.length) {
    const billing = await fetchJobBillingStatuses(
      ctx.supabase,
      ctx.workspace.organizationId,
      jobs.map((job) => job.id)
    );
    enrichedJobs = jobs.map((job) => ({
      ...job,
      billing_status: billing[job.id] || 'not_invoiced'
    }));
  }

  return NextResponse.json({
    jobs: enrichedJobs,
    organizationId: ctx.workspace.organizationId,
    total: enrichedJobs.length
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
    customer_email?: string;
    phone?: string;
    address?: string;
    notes?: string;
    customer_id?: string | null;
    property_id?: string | null;
    assigned_to?: string | null;
    assigned_email?: string | null;
    status?: string;
    start_date?: string | null;
    due_date?: string | null;
    scheduled_start?: string | null;
    scheduled_end?: string | null;
    timezone?: string | null;
    revenue_amount?: number | string | null;
    expected_contractor_cost?: number | string | null;
    expected_additional_expense?: number | string | null;
    expected_expense_description?: string | null;
    visits?: VisitInput[];
  };

  if (!body.title?.trim()) {
    return NextResponse.json({ error: 'Job title is required.' }, { status: 400 });
  }

  const requestedTimeZone = body.timezone?.trim() || null;
  if (requestedTimeZone && !isValidTimeZone(requestedTimeZone)) {
    return NextResponse.json({ error: 'Choose a valid job timezone.' }, { status: 400 });
  }

  const emailCheck = validateAssignedEmail(body.assigned_email);
  if (!emailCheck.ok) {
    return NextResponse.json({ error: emailCheck.error }, { status: 400 });
  }

  const assignedUserId = body.assigned_to?.trim() || null;
  let assignedWorkerId: string | null = null;
  let assignedDisplayName = 'Team member';

  if (assignedUserId) {
    const { data: member } = await ctx.supabase
      .from('organization_members')
      .select('user_id')
      .eq('organization_id', ctx.workspace.organizationId)
      .eq('user_id', assignedUserId)
      .eq('active', true)
      .maybeSingle();

    if (!member) {
      return NextResponse.json({ error: 'Assigned teammate must be an active member of this company.' }, { status: 400 });
    }

    const { data: profile } = await ctx.supabase
      .from('profiles')
      .select('email, full_name')
      .eq('id', assignedUserId)
      .maybeSingle();

    assignedDisplayName = profile?.full_name?.trim() || profile?.email?.trim() || 'Team member';

    try {
      assignedWorkerId = await ensureWorkerForPerson(
        ctx.supabase,
        ctx.workspace.organizationId,
        assignedUserId,
        assignedDisplayName,
        ctx.workspace.ownerUserId || ctx.userId,
        profile?.email
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to link this teammate to a worker record.';
      return NextResponse.json({ error: message }, { status: 400 });
    }
  }

  const planCheck = await enforcePlanForUser(ctx.supabase, ctx.userId, 'jobs');
  if (!planCheck.allowed) {
    return NextResponse.json({ error: planCheck.message || 'Plan limit reached.' }, { status: 403 });
  }

  let schedule: {
    start_date: string | null;
    due_date: string | null;
    scheduled_start: string | null;
    scheduled_end: string | null;
  } = {
    start_date: body.start_date?.trim() || null,
    due_date: body.due_date?.trim() || null,
    scheduled_start: body.scheduled_start?.trim() || null,
    scheduled_end: body.scheduled_end?.trim() || null
  };
  let visitsToInsert: ReturnType<typeof cleanVisits> = [];

  if (Array.isArray(body.visits) && body.visits.length > 0) {
    const cleaned = sortVisits(cleanVisits(body.visits));
    const visitError = validateVisits(cleaned);
    if (visitError) {
      return NextResponse.json({ error: visitError }, { status: 400 });
    }
    visitsToInsert = cleaned;
    schedule = scheduleFieldsFromVisits(cleaned);
  } else if (schedule.scheduled_start || schedule.scheduled_end || schedule.start_date || schedule.due_date) {
    if (schedule.scheduled_start && !schedule.start_date) {
      schedule.start_date = localDateFromIso(schedule.scheduled_start) || schedule.scheduled_start.slice(0, 10);
    }
    if (schedule.scheduled_end && !schedule.due_date) {
      schedule.due_date = localDateFromIso(schedule.scheduled_end) || schedule.scheduled_end.slice(0, 10);
    }
  }

  let propertyId = body.property_id?.trim() || null;
  let resolvedTimeZone = requestedTimeZone;
  let resolvedAddress = body.address?.trim() || null;
  let resolvedCustomerId = body.customer_id?.trim() || null;

  if (propertyId) {
    const { data: property } = await ctx.supabase
      .from('customer_properties')
      .select('id, customer_id, formatted_address, address, timezone, is_archived')
      .eq('id', propertyId)
      .eq('organization_id', ctx.workspace.organizationId)
      .maybeSingle();

    if (!property || property.is_archived) {
      return NextResponse.json({ error: 'Selected property was not found.' }, { status: 400 });
    }

    if (resolvedCustomerId && property.customer_id !== resolvedCustomerId) {
      return NextResponse.json({ error: 'Property does not belong to the selected customer.' }, { status: 400 });
    }

    resolvedCustomerId = property.customer_id;
    resolvedAddress = resolvedAddress || property.formatted_address || property.address || null;
    if (!resolvedTimeZone && property.timezone) {
      resolvedTimeZone = property.timezone;
    }
  }

  if (resolvedCustomerId) {
    const { data: customer } = await ctx.supabase
      .from('customers')
      .select('id')
      .eq('id', resolvedCustomerId)
      .eq('organization_id', ctx.workspace.organizationId)
      .maybeSingle();
    if (!customer) {
      return NextResponse.json({ error: 'Selected customer was not found.' }, { status: 400 });
    }
  }

  const insertPayload: Record<string, unknown> = {
    ...workspaceScopedFields(ctx.workspace, ctx.userId),
    title: body.title.trim(),
    customer_name: body.customer_name?.trim() || null,
    customer_email: body.customer_email?.trim() || null,
    phone: body.phone?.trim() || null,
    address: resolvedAddress,
    notes: body.notes?.trim() || null,
    customer_id: resolvedCustomerId,
    assigned_to: assignedWorkerId,
    assigned_email: emailCheck.email,
    status: body.status?.trim() || 'new',
    start_date: schedule.start_date,
    due_date: schedule.due_date,
    scheduled_start: schedule.scheduled_start,
    scheduled_end: schedule.scheduled_end,
    timezone: resolvedTimeZone,
    revenue_amount:
      body.revenue_amount === undefined || body.revenue_amount === null || body.revenue_amount === ''
        ? null
        : Number(body.revenue_amount),
    expected_contractor_cost:
      body.expected_contractor_cost === undefined || body.expected_contractor_cost === null
        ? null
        : Number(body.expected_contractor_cost),
    expected_additional_expense:
      body.expected_additional_expense === undefined || body.expected_additional_expense === null
        ? null
        : Number(body.expected_additional_expense),
    expected_expense_description: body.expected_expense_description?.trim?.() || body.expected_expense_description || null
  };

  if (propertyId) {
    insertPayload.property_id = propertyId;
  }

  let { data, error } = await ctx.supabase
    .from('jobs')
    .insert(insertPayload)
    .select('id, timezone, property_id, customer_id')
    .single();

  if (error && isMissingSchemaError(error)) {
    const fallbackPayload = { ...insertPayload };
    delete fallbackPayload.property_id;
    delete fallbackPayload.timezone;
    delete fallbackPayload.expected_contractor_cost;
    delete fallbackPayload.expected_additional_expense;
    delete fallbackPayload.expected_expense_description;
    const retry = await ctx.supabase
      .from('jobs')
      .insert(fallbackPayload)
      .select('id, customer_id')
      .single();
    data = retry.data as typeof data;
    error = retry.error;
  }

  if (error || !data) {
    logJobFlowEvent('job_create_failed', {
      userId: ctx.userId,
      organizationId: ctx.workspace.organizationId,
      reason: error?.message || 'Job insert returned no row'
    });
    return NextResponse.json({ error: mapWorkspaceSaveError(error?.message || 'Unable to save job.') }, { status: 400 });
  }

  const createdJob = data;

  // Keep jobs.assigned_to and job_assignments in sync so detail UI does not
  // prompt managers to assign the same contractor again after create.
  if (assignedWorkerId) {
    const { error: assignmentError } = await ctx.supabase.from('job_assignments').upsert(
      {
        job_id: createdJob.id,
        worker_id: assignedWorkerId,
        user_id: ctx.userId,
        organization_id: ctx.workspace.organizationId
      },
      { onConflict: 'job_id,worker_id', ignoreDuplicates: true }
    );
    if (assignmentError) {
      // Fallback insert without upsert options for older PostgREST schemas.
      await ctx.supabase.from('job_assignments').insert({
        job_id: createdJob.id,
        worker_id: assignedWorkerId,
        user_id: ctx.userId,
        organization_id: ctx.workspace.organizationId
      });
    }
  }

  if (visitsToInsert.length > 0) {
    const { error: visitInsertError } = await ctx.supabase.from('job_visits').insert(
      visitsToInsert.map((visit) => ({
        organization_id: ctx.workspace.organizationId,
        job_id: createdJob.id,
        visit_date: visit.visit_date,
        start_time: visit.start_time,
        end_time: visit.end_time,
        notes: visit.notes
      }))
    );

    if (visitInsertError) {
      await ctx.supabase.from('jobs').delete().eq('id', createdJob.id).eq('organization_id', ctx.workspace.organizationId);
      logJobFlowEvent('job_create_failed', {
        userId: ctx.userId,
        organizationId: ctx.workspace.organizationId,
        reason: visitInsertError.message
      });
      return NextResponse.json({ error: mapWorkspaceSaveError(visitInsertError.message) }, { status: 400 });
    }
  }

  const admin = createAdminSupabase();
  if (admin && (schedule.scheduled_start || visitsToInsert.length > 0)) {
    await syncJobToGoogleCalendarSafe(admin, ctx.workspace.organizationId, createdJob.id);
  }

  logJobFlowEvent('job_create_succeeded', {
    userId: ctx.userId,
    organizationId: ctx.workspace.organizationId,
    jobId: createdJob.id
  });

  await logWorkspaceActivity(
    ctx.workspace.organizationId,
    ctx.userId,
    'job',
    createdJob.id,
    'job_created',
    `Job created: ${body.title.trim()}`,
    { assignedTo: assignedWorkerId, assignedUserId, assignedEmail: emailCheck.email, timezone: requestedTimeZone }
  );

  if (assignedUserId) {
    await ctx.supabase.from('notifications').insert({
      organization_id: ctx.workspace.organizationId,
      user_id: assignedUserId,
      type: 'assignment',
      title: 'New job assigned',
      body: body.title.trim(),
      related_job_id: createdJob.id
    });

    await logWorkspaceActivity(
      ctx.workspace.organizationId,
      ctx.userId,
      'job',
      createdJob.id,
      'job_assigned',
      'Job assigned to a teammate',
      { assignedTo: assignedWorkerId, assignedUserId, assignedEmail: emailCheck.email }
    );
  }

  await trackProductEventServer(ctx.supabase, 'job_created', {
    organizationId: ctx.workspace.organizationId,
    userId: ctx.userId,
    metadata: { jobId: createdJob.id, assignedTo: assignedWorkerId, assignedUserId, timezone: requestedTimeZone }
  });

  return NextResponse.json({ ok: true, job: createdJob, message: 'Job saved successfully.' });
}
