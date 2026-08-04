/** Shared helpers for permanent one-time and recurring job deletion. */

export const COMPLETED_JOB_STATUSES = new Set(['completed', 'done', 'complete', 'closed']);

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
