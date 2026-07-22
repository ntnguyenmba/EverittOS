/**
 * Canonical job date for operational reporting.
 * Prefer work/completion dates over record creation.
 */

export type JobDateFields = {
  id?: string | null;
  status?: string | null;
  completed_at?: string | null;
  /** Latest job_visits.visit_date for a completed job (safe fallback). */
  latest_completed_visit_date?: string | null;
  start_date?: string | null;
  scheduled_start?: string | null;
  due_date?: string | null;
  visit_start?: string | null;
  created_at?: string | null;
};

function asDateOnly(value: string | null | undefined): string | null {
  if (!value) return null;
  const trimmed = String(value).trim();
  if (!trimmed) return null;
  return trimmed.slice(0, 10);
}

export function isCompletedJobStatus(status: string | null | undefined): boolean {
  return String(status || '').toLowerCase() === 'completed';
}

/** Completed jobs that need a completion date correction (admin maintenance only). */
export function isCompletedJobMissingCompletedAt(job: JobDateFields): boolean {
  return isCompletedJobStatus(job.status) && !asDateOnly(job.completed_at);
}

/**
 * Latest visit_date from visit rows (used as completed-job fallback).
 */
export function latestVisitDate(
  visits: Array<{ visit_date?: string | null } | null | undefined>
): string | null {
  let latest: string | null = null;
  for (const visit of visits) {
    const date = asDateOnly(visit?.visit_date);
    if (!date) continue;
    if (!latest || date > latest) latest = date;
  }
  return latest;
}

/**
 * Reporting date for completed jobs used in period totals.
 * Prefer completed_at; otherwise latest completed visit, start_date, scheduled_start.
 * Returns null when no safe operational date exists (exclude from date-based totals).
 * Does not use created_at for completed-job period assignment.
 */
export function getCompletedJobReportingDate(job: JobDateFields): string | null {
  if (!isCompletedJobStatus(job.status)) return null;
  return (
    asDateOnly(job.completed_at) ||
    asDateOnly(job.latest_completed_visit_date) ||
    asDateOnly(job.start_date) ||
    asDateOnly(job.scheduled_start) ||
    null
  );
}

/**
 * Returns YYYY-MM-DD for the date that should drive operational reports.
 * Completed jobs: completed_at → latest visit → start_date → scheduled_start (else null).
 * Other jobs: start/scheduled/visit/due, then created_at only when no operational date exists.
 */
export function getJobOperationalDate(job: JobDateFields): string | null {
  if (isCompletedJobStatus(job.status)) {
    return getCompletedJobReportingDate(job);
  }

  return (
    asDateOnly(job.start_date) ||
    asDateOnly(job.scheduled_start) ||
    asDateOnly(job.visit_start) ||
    asDateOnly(job.due_date) ||
    asDateOnly(job.created_at) ||
    null
  );
}

export function isCancelledJobStatus(status: string | null | undefined): boolean {
  const value = String(status || '').toLowerCase();
  return value === 'cancelled' || value === 'canceled';
}

/** Stages that must never count as active customers. */
const NON_ACTIVE_CUSTOMER_STAGES = new Set([
  'past',
  'inactive',
  'former',
  'archived',
  'cancelled',
  'canceled',
  'lead',
  'open',
  'contacted',
  'qualified',
  'quoted',
  'won',
  'lost',
  'reopened'
]);

/**
 * Active customers: record_type=customer and pipeline_stage=active.
 * Blank/null stage is treated as active for legacy records.
 * Past, inactive, archived, cancelled, and other non-active stages are excluded.
 */
export function isActiveCustomerStage(pipelineStage: string | null | undefined): boolean {
  const stage = String(pipelineStage || '').trim().toLowerCase();
  if (!stage) return true;
  if (NON_ACTIVE_CUSTOMER_STAGES.has(stage)) return false;
  return stage === 'active';
}

export function isActiveCustomerRecord(input: {
  record_type?: string | null;
  pipeline_stage?: string | null;
}): boolean {
  const recordType = String(input.record_type || 'customer').toLowerCase();
  if (recordType !== 'customer') return false;
  return isActiveCustomerStage(input.pipeline_stage);
}
