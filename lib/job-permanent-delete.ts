/** Shared helpers for permanent one-time and recurring job deletion. */

export const COMPLETED_JOB_STATUSES = new Set(['completed', 'done', 'complete', 'closed']);

export const FINANCIAL_HISTORY_DELETE_MESSAGE =
  'Jobs with invoices or payments cannot be permanently deleted. Cancel the job instead so financial history stays accurate.';

export function isCompletedJobStatus(status: string | null | undefined): boolean {
  return COMPLETED_JOB_STATUSES.has(String(status || '').toLowerCase());
}

/** Prefer occurrence_date; fall back to start_date only when needed. */
export function resolveOccurrenceAnchorDate(job: {
  occurrence_date?: string | null;
  start_date?: string | null;
}): string | null {
  const occurrence = typeof job.occurrence_date === 'string' ? job.occurrence_date.trim() : '';
  if (occurrence) return occurrence.slice(0, 10);
  const start = typeof job.start_date === 'string' ? job.start_date.trim() : '';
  if (start) return start.slice(0, 10);
  return null;
}

export function previousIsoDate(value: string): string {
  const date = new Date(`${value.slice(0, 10)}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() - 1);
  return date.toISOString().slice(0, 10);
}

export type DeletableRecurringJob = {
  id: string;
  status?: string | null;
  occurrence_date?: string | null;
  start_date?: string | null;
};

/**
 * Selected occurrence + future non-completed occurrences.
 * Completed visits on or after the anchor are preserved.
 */
export function selectRecurringJobsForPermanentDelete(
  jobs: DeletableRecurringJob[],
  selectedJobId: string,
  anchorDate: string
): string[] {
  const anchor = anchorDate.slice(0, 10);
  const ids: string[] = [];

  for (const job of jobs) {
    if (isCompletedJobStatus(job.status)) continue;
    const jobDate = resolveOccurrenceAnchorDate(job);
    if (!jobDate) {
      if (job.id === selectedJobId) ids.push(job.id);
      continue;
    }
    if (jobDate >= anchor) ids.push(job.id);
  }

  if (!ids.includes(selectedJobId)) {
    const selected = jobs.find((job) => job.id === selectedJobId);
    if (selected && !isCompletedJobStatus(selected.status)) {
      ids.unshift(selectedJobId);
    }
  }

  return Array.from(new Set(ids));
}

export function isFinancialHistoryDeleteError(message: string | null | undefined): boolean {
  const text = String(message || '');
  if (!text) return false;
  return (
    /invoices or payments cannot be permanently deleted/i.test(text) ||
    /invoices, payments, worker labor, or expenses/i.test(text) ||
    (/cannot be permanently deleted/i.test(text) && /cancel the job instead/i.test(text)) ||
    /HAS_FINANCIAL_HISTORY/i.test(text)
  );
}

export function isPermanentDeleteConflictError(message: string | null | undefined): boolean {
  const text = String(message || '');
  if (isFinancialHistoryDeleteError(text)) return true;
  return /reference|foreign key|still reference|could not be permanently deleted/i.test(text);
}
