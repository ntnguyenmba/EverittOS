import type { SupabaseClient } from '@supabase/supabase-js';
import {
  generateOccurrences,
  RECURRING_GENERATION_WINDOW_DAYS,
  type RecurrenceFrequency
} from '@/lib/recurring-jobs';
import { workspaceScopedFields, type CurrentWorkspace } from '@/lib/workspace-server';

type SeriesRow = {
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
  recurrence_frequency: string;
  recurrence_interval?: number | null;
  recurrence_weekday?: number | null;
  start_date: string;
  end_date?: string | null;
  occurrence_limit?: number | null;
};

/**
 * Generate missing occurrences for an active series inside the app-wide window.
 * Safe to call repeatedly — unique (series, occurrence_date) prevents duplicates.
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

  const today = new Date().toISOString().slice(0, 10);
  const occurrences = generateOccurrences(
    {
      frequency: series.recurrence_frequency as RecurrenceFrequency,
      interval: series.recurrence_interval ?? 1,
      intervalUnit: series.recurrence_frequency === 'monthly' ? 'months' : 'weeks',
      weekday: series.recurrence_weekday,
      startDate: series.start_date,
      endDate: series.end_date,
      occurrenceLimit: series.occurrence_limit,
      preferredStartTime: series.preferred_start_time,
      durationMinutes: series.duration_minutes,
      timezone: series.timezone
    },
    { fromDate: today, windowDays: RECURRING_GENERATION_WINDOW_DAYS, existingCount: 0 }
  );

  let created = 0;
  for (const occurrence of occurrences) {
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
      is_skipped: false,
      revenue_amount: series.default_price ?? null
    };

    const { data, error } = await supabase.from('jobs').insert(row).select('id').maybeSingle();
    if (error) {
      if (/duplicate|unique/i.test(error.message)) continue;
      continue;
    }
    if (!data?.id) continue;
    created += 1;

    if (series.preferred_contractor_id) {
      await supabase.from('job_assignments').upsert(
        {
          job_id: data.id,
          worker_id: series.preferred_contractor_id,
          user_id: userId,
          organization_id: workspace.organizationId
        },
        { onConflict: 'job_id,worker_id', ignoreDuplicates: true }
      );
    }
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
