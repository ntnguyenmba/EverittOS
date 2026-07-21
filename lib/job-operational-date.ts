/**
 * Canonical job date for operational reporting.
 * Prefer work/completion dates over record creation.
 */

export type JobDateFields = {
  status?: string | null;
  completed_at?: string | null;
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

/**
 * Returns YYYY-MM-DD for the date that should drive operational reports.
 * Order: completed_at (when completed) → start_date → scheduled_start → visit_start → due_date → created_at.
 */
export function getJobOperationalDate(job: JobDateFields): string | null {
  const status = String(job.status || '').toLowerCase();
  if (status === 'completed') {
    const completed = asDateOnly(job.completed_at);
    if (completed) return completed;
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
