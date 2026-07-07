import type { SupabaseClient } from '@supabase/supabase-js';
import { mapWorkspaceSaveError } from '@/lib/workspace-server';

export type SingleVisitUpdateInput = {
  visitId?: string;
  visit_date?: string | null;
  start_time?: string | null;
  end_time?: string | null;
  notes?: string | null;
};

function normalizeDate(value: string | null | undefined) {
  const trimmed = value?.trim() || '';
  return /^\d{4}-\d{2}-\d{2}$/.test(trimmed) ? trimmed : '';
}

function normalizeTime(value: string | null | undefined) {
  const trimmed = value?.trim() || '';
  const match = trimmed.match(/^(\d{2}:\d{2})(?::\d{2})?$/);
  return match ? match[1] : '';
}

export async function updateSingleVisitSchedule(
  admin: SupabaseClient,
  organizationId: string,
  jobId: string,
  input: SingleVisitUpdateInput
): Promise<{ ok: true; changed: boolean } | { ok: false; error: string }> {
  if (!input.visitId) return { ok: true, changed: false };

  const visitDate = normalizeDate(input.visit_date);
  const startTime = normalizeTime(input.start_time);
  const endTime = normalizeTime(input.end_time);

  if (!visitDate || !startTime || !endTime) {
    return { ok: false, error: 'Visit needs a valid date, start time, and end time.' };
  }
  if (endTime <= startTime) {
    return { ok: false, error: 'Visit end time must be after start time.' };
  }

  const { error } = await admin
    .from('job_visits')
    .update({
      visit_date: visitDate,
      start_time: startTime,
      end_time: endTime,
      notes: input.notes?.trim() || null
    })
    .eq('id', input.visitId)
    .eq('job_id', jobId)
    .eq('organization_id', organizationId);

  if (error) return { ok: false, error: mapWorkspaceSaveError(error.message) };
  return { ok: true, changed: true };
}
