import { NextResponse } from 'next/server';
import { logWorkspaceActivity } from '@/lib/activity-server';
import { generateActiveSeriesForOrganization } from '@/lib/generate-recurring-series';
import { enforcePlanForUser } from '@/lib/plan-enforce-server';
import {
  generateOccurrences,
  RECURRING_GENERATION_WINDOW_DAYS,
  resolveRecurrenceInterval,
  summarizeRecurrence,
  type RecurrenceFrequency
} from '@/lib/recurring-jobs';
import { ensureWorkerForPerson } from '@/lib/people-assignment';
import { isValidTimeZone, normalizeTimeZone } from '@/lib/time-zones';
import { isMissingSchemaError } from '@/lib/supabase-schema-errors';
import { mapWorkspaceSaveError, workspaceScopedFields } from '@/lib/workspace-server';
import { requireWorkspaceSession } from '@/lib/workspace-api-auth';
import { wallClockDateTime } from '@/lib/schedule-times';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type CreateBody = {
  title?: string;
  customer_id?: string | null;
  property_id?: string | null;
  customer_name?: string | null;
  customer_email?: string | null;
  customer_phone?: string | null;
  phone?: string | null;
  address?: string | null;
  notes?: string | null;
  timezone?: string | null;
  default_price?: number | null;
  duration_minutes?: number | null;
  preferred_contractor_user_id?: string | null;
  assigned_to?: string | null;
  recurrence?: {
    frequency?: RecurrenceFrequency;
    interval?: number;
    intervalUnit?: 'weeks' | 'months';
    weekday?: number | null;
    startDate?: string;
    endDate?: string | null;
    occurrenceLimit?: number | null;
    preferredStartTime?: string | null;
  };
};

async function resolveWorkerId(
  ctx: Awaited<ReturnType<typeof requireWorkspaceSession>>,
  userId: string | null
): Promise<string | null> {
  if (!ctx.ok || !userId) return null;
  const { data: profile } = await ctx.supabase.from('profiles').select('email, full_name').eq('id', userId).maybeSingle();
  const label = profile?.full_name?.trim() || profile?.email?.trim() || 'Team member';
  return ensureWorkerForPerson(
    ctx.supabase,
    ctx.workspace.organizationId,
    userId,
    label,
    ctx.workspace.ownerUserId || ctx.userId,
    profile?.email
  );
}

export async function GET() {
  const ctx = await requireWorkspaceSession({ requireManager: true });
  if (!ctx.ok) {
    return NextResponse.json({ error: ctx.error, code: ctx.code }, { status: ctx.status });
  }

  // Request-time top-up so series stay populated without a paid external scheduler.
  const generation = await generateActiveSeriesForOrganization(ctx.supabase, ctx.workspace, ctx.userId);

  const { data, error } = await ctx.supabase
    .from('recurring_job_series')
    .select('*')
    .eq('organization_id', ctx.workspace.organizationId)
    .order('created_at', { ascending: false })
    .limit(100);

  if (error) {
    if (isMissingSchemaError(error)) {
      return NextResponse.json({ series: [], schemaPending: true });
    }
    return NextResponse.json({ error: mapWorkspaceSaveError(error.message) }, { status: 400 });
  }

  return NextResponse.json({
    series: data || [],
    windowDays: RECURRING_GENERATION_WINDOW_DAYS,
    generation
  });
}

export async function POST(request: Request) {
  const ctx = await requireWorkspaceSession({ requireManager: true });
  if (!ctx.ok) {
    return NextResponse.json({ error: ctx.error, code: ctx.code }, { status: ctx.status });
  }

  const body = (await request.json().catch(() => ({}))) as CreateBody;
  const title = String(body.title || '').trim();
  if (!title) {
    return NextResponse.json({ error: 'Job title is required.' }, { status: 400 });
  }

  const recurrence = body.recurrence || {};
  const frequency = (recurrence.frequency || 'none') as RecurrenceFrequency;
  const startDate = String(recurrence.startDate || '').trim();
  if (!startDate) {
    return NextResponse.json({ error: 'Start date is required.' }, { status: 400 });
  }

  const planCheck = await enforcePlanForUser(ctx.supabase, ctx.userId, 'jobs');
  if (!planCheck.allowed) {
    return NextResponse.json({ error: planCheck.message || 'Plan limit reached.' }, { status: 403 });
  }

  const timezone = body.timezone?.trim()
    ? isValidTimeZone(body.timezone)
      ? body.timezone.trim()
      : null
    : null;
  if (body.timezone?.trim() && !timezone) {
    return NextResponse.json({ error: 'Choose a valid timezone.' }, { status: 400 });
  }

  const assignedUserId = body.assigned_to?.trim() || body.preferred_contractor_user_id?.trim() || null;
  let preferredContractorId: string | null = null;
  try {
    preferredContractorId = await resolveWorkerId(ctx, assignedUserId);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unable to assign contractor.' },
      { status: 400 }
    );
  }

  const intervalInfo = resolveRecurrenceInterval({
    frequency,
    interval: recurrence.interval,
    intervalUnit: recurrence.intervalUnit,
    startDate
  });

  const seriesPayload = {
    organization_id: ctx.workspace.organizationId,
    user_id: ctx.userId,
    customer_id: body.customer_id || null,
    property_id: body.property_id || null,
    title,
    recurrence_frequency: frequency === 'none' ? 'weekly' : frequency,
    recurrence_interval: intervalInfo.interval,
    recurrence_weekday: recurrence.weekday ?? null,
    start_date: startDate,
    end_date: recurrence.endDate || null,
    occurrence_limit: recurrence.occurrenceLimit || null,
    preferred_start_time: recurrence.preferredStartTime || null,
    duration_minutes: body.duration_minutes ?? null,
    timezone: timezone || normalizeTimeZone(null),
    default_price: body.default_price ?? null,
    preferred_contractor_id: preferredContractorId,
    notes: body.notes?.trim() || null,
    customer_name: body.customer_name?.trim() || null,
    customer_email: body.customer_email?.trim() || null,
    customer_phone: body.customer_phone?.trim() || body.phone?.trim() || null,
    service_address: body.address?.trim() || null,
    status: 'active',
    next_generation_date: startDate
  };

  // One-time jobs skip the series table.
  if (frequency === 'none') {
    const scheduledStart = wallClockDateTime(startDate, recurrence.preferredStartTime || '09:00');
    const { data: job, error } = await ctx.supabase
      .from('jobs')
      .insert({
        ...workspaceScopedFields(ctx.workspace, ctx.userId),
        title,
        customer_id: body.customer_id || null,
        property_id: body.property_id || null,
        customer_name: body.customer_name?.trim() || null,
        customer_email: body.customer_email?.trim() || null,
        phone: body.customer_phone?.trim() || body.phone?.trim() || null,
        address: body.address?.trim() || null,
        notes: body.notes?.trim() || null,
        timezone,
        assigned_to: preferredContractorId,
        status: 'new',
        start_date: startDate,
        due_date: startDate,
        scheduled_start: scheduledStart,
        revenue_amount: body.default_price ?? null
      })
      .select('id')
      .single();

    if (error || !job) {
      return NextResponse.json({ error: mapWorkspaceSaveError(error?.message || 'Unable to create job.') }, { status: 400 });
    }

    if (preferredContractorId) {
      await ctx.supabase.from('job_assignments').upsert(
        {
          job_id: job.id,
          worker_id: preferredContractorId,
          user_id: ctx.userId,
          organization_id: ctx.workspace.organizationId
        },
        { onConflict: 'job_id,worker_id', ignoreDuplicates: true }
      );
    }

    return NextResponse.json({
      oneTime: true,
      job,
      summary: summarizeRecurrence({
        frequency: 'none',
        startDate,
        preferredStartTime: recurrence.preferredStartTime,
        timezone
      })
    });
  }

  const { data: series, error: seriesError } = await ctx.supabase
    .from('recurring_job_series')
    .insert(seriesPayload)
    .select('*')
    .single();

  if (seriesError || !series) {
    if (seriesError && isMissingSchemaError(seriesError)) {
      return NextResponse.json(
        { error: 'Recurring jobs migration is not applied yet. Run the latest Supabase migration.' },
        { status: 503 }
      );
    }
    return NextResponse.json(
      { error: mapWorkspaceSaveError(seriesError?.message || 'Unable to create recurring series.') },
      { status: 400 }
    );
  }

  const occurrences = generateOccurrences({
    frequency,
    interval: recurrence.interval,
    intervalUnit: recurrence.intervalUnit,
    weekday: recurrence.weekday,
    startDate,
    endDate: recurrence.endDate,
    occurrenceLimit: recurrence.occurrenceLimit,
    preferredStartTime: recurrence.preferredStartTime,
    durationMinutes: body.duration_minutes,
    timezone: series.timezone
  });

  const jobRows = occurrences.map((occurrence) => ({
    ...workspaceScopedFields(ctx.workspace, ctx.userId),
    title,
    customer_id: body.customer_id || null,
    property_id: body.property_id || null,
    customer_name: body.customer_name?.trim() || null,
    customer_email: body.customer_email?.trim() || null,
    phone: body.customer_phone?.trim() || body.phone?.trim() || null,
    address: body.address?.trim() || null,
    notes: body.notes?.trim() || null,
    timezone: series.timezone,
    assigned_to: preferredContractorId,
    status: 'scheduled',
    start_date: occurrence.occurrenceDate,
    due_date: occurrence.occurrenceDate,
    scheduled_start: occurrence.scheduledStart,
    scheduled_end: occurrence.scheduledEnd,
    recurring_series_id: series.id,
    occurrence_date: occurrence.occurrenceDate,
    is_skipped: false,
    revenue_amount: body.default_price ?? null
  }));

  const { data: createdJobs, error: jobsError } = await ctx.supabase
    .from('jobs')
    .upsert(jobRows, { onConflict: 'recurring_series_id,occurrence_date', ignoreDuplicates: true })
    .select('id, occurrence_date, scheduled_start, status');

  // Unique index may not be exposed as onConflict target; fall back to insert-ignore loop.
  let jobs = createdJobs || [];
  if (jobsError) {
    jobs = [];
    for (const row of jobRows) {
      const insert = await ctx.supabase.from('jobs').insert(row).select('id, occurrence_date, scheduled_start, status').maybeSingle();
      if (insert.data) jobs.push(insert.data);
    }
  }

  if (preferredContractorId) {
    for (const job of jobs) {
      await ctx.supabase.from('job_assignments').upsert(
        {
          job_id: job.id,
          worker_id: preferredContractorId,
          user_id: ctx.userId,
          organization_id: ctx.workspace.organizationId
        },
        { onConflict: 'job_id,worker_id', ignoreDuplicates: true }
      );
    }
  }

  const nextDate = occurrences.length
    ? occurrences[occurrences.length - 1].occurrenceDate
    : startDate;

  await ctx.supabase
    .from('recurring_job_series')
    .update({ next_generation_date: nextDate, updated_at: new Date().toISOString() })
    .eq('id', series.id);

  await logWorkspaceActivity(
    ctx.workspace.organizationId,
    ctx.userId,
    'job',
    jobs[0]?.id || series.id,
    'recurring_series_created',
    `Recurring series created: ${title}`
  );

  const summary = summarizeRecurrence({
    frequency,
    interval: recurrence.interval,
    intervalUnit: recurrence.intervalUnit,
    weekday: recurrence.weekday,
    startDate,
    endDate: recurrence.endDate,
    occurrenceLimit: recurrence.occurrenceLimit,
    preferredStartTime: recurrence.preferredStartTime,
    timezone: series.timezone
  });

  return NextResponse.json({
    series,
    jobs,
    generatedCount: jobs.length,
    windowDays: RECURRING_GENERATION_WINDOW_DAYS,
    summary,
    firstJobId: jobs[0]?.id || null
  });
}
