import { NextResponse } from 'next/server';
import { logWorkspaceActivity } from '@/lib/activity-server';
import { generateActiveSeriesForOrganization } from '@/lib/generate-recurring-series';
import {
  calculateExpectedJobFinance,
  centsToDollars,
  dollarsToCents,
  optionalMoneyDollars
} from '@/lib/money-decimal';
import { enforcePlanForUser } from '@/lib/plan-enforce-server';
import {
  generateOccurrences,
  parseOccurrenceLocalTime,
  RECURRING_GENERATION_WINDOW_DAYS,
  resolveGenerationFromDate,
  resolveRecurrenceEndMode,
  resolveRecurrenceInterval,
  summarizeRecurrence,
  type RecurrenceEndMode,
  type RecurrenceFrequency,
  type RecurrenceIntervalUnit
} from '@/lib/recurring-jobs';
import { occurrenceFinanceColumns, seedOccurrenceLabor } from '@/lib/seed-occurrence-finance';
import { ensureWorkerForPerson } from '@/lib/people-assignment';
import { isValidTimeZone, normalizeTimeZone } from '@/lib/time-zones';
import { isMissingSchemaError } from '@/lib/supabase-schema-errors';
import { mapWorkspaceSaveError, workspaceScopedFields } from '@/lib/workspace-server';
import { requireWorkspaceSession } from '@/lib/workspace-api-auth';
import { wallClockDateTime } from '@/lib/schedule-times';
import { createAdminSupabase } from '@/lib/supabase-admin';
import { resolveOrganizationPlan } from '@/lib/organization-plan';
import { grantJobClientAccess } from '@/lib/client-access-grant-server';

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
  expected_contractor_cost?: number | null;
  expected_additional_expense?: number | null;
  expected_expense_description?: string | null;
  contractor_pay_basis?: 'hourly' | 'flat' | 'visit' | null;
  contractor_hours?: number | null;
  contractor_hourly_rate?: number | null;
  contractor_name?: string | null;
  duration_minutes?: number | null;
  preferred_contractor_user_id?: string | null;
  assigned_to?: string | null;
  recurrence?: {
    frequency?: RecurrenceFrequency;
    interval?: number;
    intervalUnit?: RecurrenceIntervalUnit;
    weekday?: number | null;
    weekdays?: number[] | null;
    startDate?: string;
    endDate?: string | null;
    occurrenceLimit?: number | null;
    endMode?: RecurrenceEndMode | null;
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

function hasMissingColumnError(message?: string | null): boolean {
  return /column|schema cache|does not exist/i.test(String(message || ''));
}

function legacyJobPayload(row: Record<string, unknown>): Record<string, unknown> {
  const legacy = { ...row };
  delete legacy.timezone;
  delete legacy.expected_contractor_cost;
  delete legacy.expected_additional_expense;
  delete legacy.expected_expense_description;
  delete legacy.occurrence_local_time;
  return legacy;
}

export async function GET() {
  const ctx = await requireWorkspaceSession({ requireManager: true });
  if (!ctx.ok) {
    return NextResponse.json({ error: ctx.error, code: ctx.code }, { status: ctx.status });
  }

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

  const expectedRevenue = optionalMoneyDollars(body.default_price);
  const expectedContractorCost = optionalMoneyDollars(body.expected_contractor_cost);
  const expectedAdditionalExpense = optionalMoneyDollars(body.expected_additional_expense);
  if (
    (expectedRevenue !== null && expectedRevenue < 0) ||
    (expectedContractorCost !== null && expectedContractorCost < 0) ||
    (expectedAdditionalExpense !== null && expectedAdditionalExpense < 0)
  ) {
    return NextResponse.json({ error: 'Financial amounts cannot be negative.' }, { status: 400 });
  }

  const finance = calculateExpectedJobFinance({
    clientPrice: expectedRevenue ?? 0,
    contractorPay: expectedContractorCost ?? 0,
    additionalExpenses: expectedAdditionalExpense ?? 0
  });

  const financeDefaults = {
    expectedRevenue,
    expectedContractorCost,
    expectedAdditionalExpense,
    expectedExpenseDescription: body.expected_expense_description?.trim() || null,
    contractorPayBasis: body.contractor_pay_basis || 'flat',
    contractorHours: body.contractor_hours ?? null,
    contractorHourlyRate: body.contractor_hourly_rate ?? null,
    contractorName: body.contractor_name?.trim() || null,
    preferredContractorId
  };
  const financeColumns = occurrenceFinanceColumns(financeDefaults);

  const intervalInfo = resolveRecurrenceInterval({
    frequency,
    interval: recurrence.interval,
    intervalUnit: recurrence.intervalUnit,
    startDate
  });
  const weekdays = Array.from(
    new Set(
      (recurrence.weekdays?.length ? recurrence.weekdays : recurrence.weekday != null ? [recurrence.weekday] : [])
        .map((value) => Number(value))
        .filter((value) => Number.isInteger(value) && value >= 0 && value <= 6)
    )
  ).sort((a, b) => a - b);
  const endMode = resolveRecurrenceEndMode({
    endMode: recurrence.endMode,
    endDate: recurrence.endDate,
    occurrenceLimit: recurrence.occurrenceLimit
  });
  const endDate = endMode === 'on_date' ? recurrence.endDate || null : null;
  const occurrenceLimit =
    endMode === 'after_count' && recurrence.occurrenceLimit && recurrence.occurrenceLimit > 0
      ? Number(recurrence.occurrenceLimit)
      : null;

  const seriesPayload = {
    organization_id: ctx.workspace.organizationId,
    user_id: ctx.userId,
    customer_id: body.customer_id || null,
    property_id: body.property_id || null,
    title,
    recurrence_frequency: frequency === 'none' ? 'weekly' : frequency,
    recurrence_interval: intervalInfo.interval,
    recurrence_interval_unit: intervalInfo.intervalUnit,
    recurrence_weekday: weekdays[0] ?? recurrence.weekday ?? null,
    recurrence_weekdays: weekdays.length ? weekdays : null,
    start_date: startDate,
    end_date: endDate,
    occurrence_limit: occurrenceLimit,
    preferred_start_time: recurrence.preferredStartTime || null,
    duration_minutes: body.duration_minutes ?? null,
    timezone: timezone || normalizeTimeZone(null),
    default_price: expectedRevenue,
    default_contractor_cost: expectedContractorCost,
    default_additional_expense: expectedAdditionalExpense,
    default_expense_description: financeDefaults.expectedExpenseDescription,
    default_contractor_pay_basis: financeDefaults.contractorPayBasis,
    default_contractor_hours: financeDefaults.contractorHours,
    default_contractor_hourly_rate: financeDefaults.contractorHourlyRate,
    default_contractor_name: financeDefaults.contractorName,
    preferred_contractor_id: preferredContractorId,
    notes: body.notes?.trim() || null,
    customer_name: body.customer_name?.trim() || null,
    customer_email: body.customer_email?.trim() || null,
    customer_phone: body.customer_phone?.trim() || body.phone?.trim() || null,
    service_address: body.address?.trim() || null,
    status: 'active',
    next_generation_date: startDate
  };

  if (frequency === 'none') {
    const scheduledStart = recurrence.preferredStartTime
      ? wallClockDateTime(startDate, recurrence.preferredStartTime)
      : wallClockDateTime(startDate, '00:00');
    const jobPayload = {
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
      ...financeColumns
    };

    let insert = await ctx.supabase.from('jobs').insert(jobPayload).select('id').single();
    if (insert.error && hasMissingColumnError(insert.error.message)) {
      insert = await ctx.supabase
        .from('jobs')
        .insert(legacyJobPayload(jobPayload))
        .select('id')
        .single();
    }

    const job = insert.data;
    if (insert.error || !job) {
      return NextResponse.json(
        { error: mapWorkspaceSaveError(insert.error?.message || 'Unable to create job.') },
        { status: 400 }
      );
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
    await seedOccurrenceLabor(ctx.supabase, {
      organizationId: ctx.workspace.organizationId,
      jobId: job.id,
      defaults: financeDefaults
    });

    return NextResponse.json({
      oneTime: true,
      job,
      expectedFinance: finance,
      summary: summarizeRecurrence({
        frequency: 'none',
        startDate,
        preferredStartTime: recurrence.preferredStartTime,
        timezone
      })
    });
  }

  let seriesInsert = await ctx.supabase.from('recurring_job_series').insert(seriesPayload).select('*').single();
  if (
    seriesInsert.error &&
    /recurrence_interval_unit|recurrence_weekdays|column|schema cache|does not exist/i.test(
      seriesInsert.error.message || ''
    )
  ) {
    const legacyPayload = { ...seriesPayload } as Record<string, unknown>;
    delete legacyPayload.recurrence_interval_unit;
    delete legacyPayload.recurrence_weekdays;
    seriesInsert = await ctx.supabase.from('recurring_job_series').insert(legacyPayload).select('*').single();
  }

  const series = seriesInsert.data;
  const seriesError = seriesInsert.error;

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

  const fromDate = resolveGenerationFromDate(startDate, series.timezone);
  const occurrences = generateOccurrences(
    {
      frequency,
      interval: intervalInfo.interval,
      intervalUnit: intervalInfo.intervalUnit,
      weekday: weekdays[0] ?? recurrence.weekday ?? null,
      weekdays,
      startDate,
      endDate,
      occurrenceLimit,
      preferredStartTime: recurrence.preferredStartTime,
      durationMinutes: body.duration_minutes,
      timezone: series.timezone
    },
    { fromDate, windowDays: RECURRING_GENERATION_WINDOW_DAYS, existingCount: 0, skipOverdueToday: true }
  );

  const jobRows = occurrences.map((occurrence) => {
    const localTime = parseOccurrenceLocalTime(occurrence.scheduledStart, recurrence.preferredStartTime);
    return {
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
      occurrence_local_time: localTime || null,
      is_skipped: false,
      ...financeColumns
    };
  });

  const jobs: Array<{ id: string; occurrence_date?: string | null; scheduled_start?: string | null; status?: string | null }> = [];
  for (const row of jobRows) {
    let insert = await ctx.supabase
      .from('jobs')
      .insert(row)
      .select('id, occurrence_date, scheduled_start, status')
      .maybeSingle();
    if (insert.error && hasMissingColumnError(insert.error.message)) {
      insert = await ctx.supabase
        .from('jobs')
        .insert(legacyJobPayload(row))
        .select('id, occurrence_date, scheduled_start, status')
        .maybeSingle();
    }
    if (insert.error && /duplicate|unique/i.test(insert.error.message)) continue;
    if (insert.data) jobs.push(insert.data);
  }

  for (const job of jobs) {
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
    await seedOccurrenceLabor(ctx.supabase, {
      organizationId: ctx.workspace.organizationId,
      jobId: job.id,
      defaults: financeDefaults
    });
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
    interval: intervalInfo.interval,
    intervalUnit: intervalInfo.intervalUnit,
    weekday: weekdays[0] ?? recurrence.weekday ?? null,
    weekdays,
    startDate,
    endDate,
    occurrenceLimit,
    preferredStartTime: recurrence.preferredStartTime,
    timezone: series.timezone
  });

  const count = jobs.length;
  const scheduledFinance = {
    perOccurrence: finance,
    generatedCount: count,
    scheduledRevenue: centsToDollars(dollarsToCents(finance.expectedRevenue) * count),
    expectedContractorExpense: centsToDollars(dollarsToCents(finance.expectedContractorCost) * count),
    expectedAdditionalExpenses: centsToDollars(dollarsToCents(finance.expectedAdditionalExpense) * count),
    expectedProfit: centsToDollars(dollarsToCents(finance.expectedProfit) * count)
  };

  // Auto-grant client access on the first occurrence when a customer email is present.
  // Failures here must not undo series creation.
  const firstJobId = jobs[0]?.id || null;
  const customerEmail = (body.customer_email || '').trim();
  if (firstJobId && customerEmail) {
    const admin = createAdminSupabase();
    if (admin) {
      const { plan } = await resolveOrganizationPlan(ctx.supabase, ctx.userId);
      await grantJobClientAccess({
        admin,
        organizationId: ctx.workspace.organizationId,
        organizationName: ctx.workspace.organizationName,
        grantedByUserId: ctx.userId,
        jobId: firstJobId,
        jobTitle: title,
        email: customerEmail,
        plan,
        sendEmail: true
      });
    }
  }

  return NextResponse.json({
    series,
    jobs,
    generatedCount: jobs.length,
    windowDays: RECURRING_GENERATION_WINDOW_DAYS,
    summary,
    expectedFinance: finance,
    scheduledFinance,
    firstJobId
  });
}
