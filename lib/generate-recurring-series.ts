import type { SupabaseClient } from '@supabase/supabase-js';
import {
  generateOccurrences,
  parseOccurrenceLocalTime,
  RECURRING_GENERATION_WINDOW_DAYS,
  resolveGenerationFromDate,
  resolveRecurrenceInterval,
  type RecurrenceFrequency,
  type RecurrenceIntervalUnit
} from '@/lib/recurring-jobs';
import { occurrenceFinanceColumns, seedOccurrenceLabor, type OccurrenceFinanceDefaults } from '@/lib/seed-occurrence-finance';
import { workspaceScopedFields, type CurrentWorkspace } from '@/lib/workspace-server';

export type SeriesRow = {
  id: string;
  status: string;
  title: string;
  customer_id?: string | null;
  property_id?: string | null;
  customer_name?: string | null;
  customer_email?: string | null;
  customer_phone?: string | null;
  service_address?: string | null;
  notes?: string | null;
  timezone?: string | null;
  preferred_contractor_id?: string | null;
  preferred_start_time?: string | null;
  duration_minutes?: number | null;
  default_price?: number | null;
  default_contractor_cost?: number | null;
  default_additional_expense?: number | null;
  default_expense_description?: string | null;
  default_contractor_pay_basis?: string | null;
  default_contractor_hours?: number | null;
  default_contractor_hourly_rate?: number | null;
  default_contractor_name?: string | null;
  recurrence_frequency: string;
  recurrence_interval?: number | null;
  recurrence_interval_unit?: string | null;
  recurrence_weekday?: number | null;
  recurrence_weekdays?: number[] | null;
  start_date: string;
  end_date?: string | null;
  occurrence_limit?: number | null;
};

function financeDefaultsFromSeries(series: SeriesRow): OccurrenceFinanceDefaults {
  return {
    expectedRevenue: series.default_price ?? null,
    expectedContractorCost: series.default_contractor_cost ?? null,
    expectedAdditionalExpense: series.default_additional_expense ?? null,
    expectedExpenseDescription: series.default_expense_description ?? null,
    contractorPayBasis:
      series.default_contractor_pay_basis === 'hourly' ||
      series.default_contractor_pay_basis === 'flat' ||
      series.default_contractor_pay_basis === 'visit'
        ? series.default_contractor_pay_basis
        : 'flat',
    contractorHours: series.default_contractor_hours ?? null,
    contractorHourlyRate: series.default_contractor_hourly_rate ?? null,
    contractorName: series.default_contractor_name ?? null,
    preferredContractorId: series.preferred_contractor_id ?? null
  };
}

function seriesIntervalUnit(series: SeriesRow): RecurrenceIntervalUnit {
  if (series.recurrence_interval_unit === 'days' || series.recurrence_interval_unit === 'months') {
    return series.recurrence_interval_unit;
  }
  if (series.recurrence_frequency === 'monthly') return 'months';
  if (series.recurrence_frequency === 'daily') return 'days';
  return 'weeks';
}

async function syncJobAssignment(
  supabase: SupabaseClient,
  organizationId: string,
  userId: string,
  jobId: string,
  workerId: string
) {
  const assignment = {
    job_id: jobId,
    worker_id: workerId,
    user_id: userId,
    organization_id: organizationId
  };
  const { error } = await supabase.from('job_assignments').upsert(assignment, {
    onConflict: 'job_id,worker_id',
    ignoreDuplicates: true
  });
  if (!error) return;

  const { data: existing } = await supabase
    .from('job_assignments')
    .select('id')
    .eq('job_id', jobId)
    .eq('worker_id', workerId)
    .maybeSingle();
  if (!existing) {
    await supabase.from('job_assignments').insert(assignment);
  }
}

/**
 * Count successfully generated jobs for a series.
 * Includes skipped/cancelled rows so occurrence_limit cannot be bypassed by skipping.
 * Failed inserts are never counted.
 */
export async function countGeneratedOccurrencesForSeries(
  supabase: SupabaseClient,
  organizationId: string,
  seriesId: string
): Promise<number> {
  const { count, error } = await supabase
    .from('jobs')
    .select('id', { count: 'exact', head: true })
    .eq('organization_id', organizationId)
    .eq('recurring_series_id', seriesId);
  if (error) return 0;
  return count || 0;
}

/**
 * Generate missing occurrences for an active series inside the app-wide window.
 * Safe to call repeatedly — unique (series, occurrence_date, local time) prevents duplicates.
 * Paused/ended series create nothing.
 */
export async function generateSeriesWindow(
  supabase: SupabaseClient,
  workspace: CurrentWorkspace,
  userId: string,
  series: SeriesRow
): Promise<{ created: number; windowDays: number }> {
  if (series.status !== 'active') {
    return { created: 0, windowDays: RECURRING_GENERATION_WINDOW_DAYS };
  }

  const fromDate = resolveGenerationFromDate(series.start_date, series.timezone);
  const existingCount = await countGeneratedOccurrencesForSeries(
    supabase,
    workspace.organizationId,
    series.id
  );
  const intervalUnit = seriesIntervalUnit(series);
  const resolved = resolveRecurrenceInterval({
    frequency: series.recurrence_frequency as RecurrenceFrequency,
    interval: series.recurrence_interval ?? 1,
    intervalUnit,
    startDate: series.start_date
  });

  const occurrences = generateOccurrences(
    {
      frequency: series.recurrence_frequency as RecurrenceFrequency,
      interval: series.recurrence_interval ?? resolved.interval,
      intervalUnit: resolved.intervalUnit,
      weekday: series.recurrence_weekday,
      weekdays: series.recurrence_weekdays,
      startDate: series.start_date,
      endDate: series.end_date,
      occurrenceLimit: series.occurrence_limit,
      preferredStartTime: series.preferred_start_time,
      durationMinutes: series.duration_minutes,
      timezone: series.timezone
    },
    {
      fromDate,
      windowDays: RECURRING_GENERATION_WINDOW_DAYS,
      existingCount,
      skipOverdueToday: true
    }
  );

  const financeDefaults = financeDefaultsFromSeries(series);
  const financeColumns = occurrenceFinanceColumns(financeDefaults);
  let created = 0;

  for (const occurrence of occurrences) {
    const localTime = parseOccurrenceLocalTime(occurrence.scheduledStart, series.preferred_start_time);
    const row = {
      ...workspaceScopedFields(workspace, userId),
      title: series.title,
      customer_id: series.customer_id || null,
      property_id: series.property_id || null,
      customer_name: series.customer_name || null,
      customer_email: series.customer_email || null,
      phone: series.customer_phone || null,
      address: series.service_address || null,
      notes: series.notes || null,
      timezone: series.timezone || null,
      assigned_to: series.preferred_contractor_id || null,
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

    const { data, error } = await supabase.from('jobs').insert(row).select('id').maybeSingle();
    if (error) {
      if (/duplicate|unique/i.test(error.message)) continue;
      if (/column|schema cache|does not exist/i.test(error.message)) {
        const legacy = { ...row } as Record<string, unknown>;
        delete legacy.expected_contractor_cost;
        delete legacy.expected_additional_expense;
        delete legacy.expected_expense_description;
        delete legacy.occurrence_local_time;
        const retry = await supabase.from('jobs').insert(legacy).select('id').maybeSingle();
        if (retry.error || !retry.data?.id) continue;
        created += 1;
        await afterOccurrenceCreated(supabase, workspace, userId, series, retry.data.id, financeDefaults);
        continue;
      }
      continue;
    }
    if (!data?.id) continue;
    created += 1;
    await afterOccurrenceCreated(supabase, workspace, userId, series, data.id, financeDefaults);
  }

  const nextDate = occurrences.length
    ? occurrences[occurrences.length - 1]?.occurrenceDate
    : series.start_date;
  await supabase
    .from('recurring_job_series')
    .update({ next_generation_date: nextDate, updated_at: new Date().toISOString() })
    .eq('id', series.id);

  return { created, windowDays: RECURRING_GENERATION_WINDOW_DAYS };
}

async function afterOccurrenceCreated(
  supabase: SupabaseClient,
  workspace: CurrentWorkspace,
  userId: string,
  series: SeriesRow,
  jobId: string,
  financeDefaults: OccurrenceFinanceDefaults
) {
  if (series.preferred_contractor_id) {
    await syncJobAssignment(
      supabase,
      workspace.organizationId,
      userId,
      jobId,
      series.preferred_contractor_id
    );
  }
  await seedOccurrenceLabor(supabase, {
    organizationId: workspace.organizationId,
    jobId,
    defaults: financeDefaults
  });
}

/** Top up all active series for an organization (request-time scheduler). */
export async function generateActiveSeriesForOrganization(
  supabase: SupabaseClient,
  workspace: CurrentWorkspace,
  userId: string,
  limit = 25
): Promise<{ seriesProcessed: number; jobsCreated: number }> {
  const { data: seriesRows } = await supabase
    .from('recurring_job_series')
    .select('*')
    .eq('organization_id', workspace.organizationId)
    .eq('status', 'active')
    .order('next_generation_date', { ascending: true, nullsFirst: true })
    .limit(limit);

  let jobsCreated = 0;
  let seriesProcessed = 0;
  for (const series of seriesRows || []) {
    const result = await generateSeriesWindow(supabase, workspace, userId, series as SeriesRow);
    seriesProcessed += 1;
    jobsCreated += result.created;
  }
  return { seriesProcessed, jobsCreated };
}
