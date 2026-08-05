/**
 * Canonical Jobs list / export filters — matches Jobs page + /api/jobs query params:
 * customer, status, period, filter=unassigned, assigned_to, from
 *
 * Period dating uses the same operational-date + rangeBounds engine as the dashboard
 * so Jobs page counts reconcile with dashboard job cards.
 */

import {
  countValidJobsInPeriod,
  dashboardRangeFromJobsPeriod,
  filterValidJobsInPeriod,
  inRange,
  isValidCountableJob,
  rangeBounds,
  type DashboardDateRange,
  type JobCountRow
} from '@/lib/dashboard-metrics';
import { getJobOperationalDate } from '@/lib/job-operational-date';
import { getEffectiveJobSchedule, normalizeJobStatus } from '@/lib/worker-assignment';

export type JobsExportPeriod = 'all' | 'today' | 'week' | 'month' | 'year';

export type JobsExportStatus =
  | 'all'
  | 'active'
  | 'finished'
  | 'unscheduled'
  | 'scheduled'
  | 'in_progress'
  | 'completed'
  | 'cancelled'
  | 'canceled'
  | 'new'
  | 'pending'
  | 'confirmed'
  | string;

export type JobsExportFilters = {
  period: JobsExportPeriod;
  status: JobsExportStatus;
  /** From ?customer= */
  customerId: string | null;
  /** From ?assigned_to= */
  assignedTo: string | null;
  /** From ?filter=unassigned */
  unassignedOnly: boolean;
  /** From ?from= (created_at lower bound, YYYY-MM-DD) */
  createdFrom: string | null;
};

const PERIODS: JobsExportPeriod[] = ['all', 'today', 'week', 'month', 'year'];

export function parseJobsExportFilters(
  searchParams: URLSearchParams | { get(name: string): string | null }
): JobsExportFilters {
  const periodRaw = (searchParams.get('period') || 'all').toLowerCase();
  const period: JobsExportPeriod = PERIODS.includes(periodRaw as JobsExportPeriod)
    ? (periodRaw as JobsExportPeriod)
    : 'all';

  const statusRaw = (searchParams.get('status') || 'all').trim().toLowerCase() || 'all';
  const filterRaw = (searchParams.get('filter') || '').trim().toLowerCase();

  return {
    period,
    status: statusRaw as JobsExportStatus,
    customerId: (searchParams.get('customer') || '').trim() || null,
    assignedTo: (searchParams.get('assigned_to') || '').trim() || null,
    unassignedOnly: filterRaw === 'unassigned',
    createdFrom: (searchParams.get('from') || '').trim() || null
  };
}

/** Local calendar YYYY-MM-DD for "today" comparisons. */
export function localYmd(d = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function isUnassignedJob(job: {
  assigned_to?: string | null;
  assigned_email?: string | null;
}): boolean {
  return !String(job.assigned_to || '').trim() && !String(job.assigned_email || '').trim();
}

export function isActiveJobStatus(status: string | null | undefined): boolean {
  const normalized = normalizeJobStatus(status);
  return normalized === 'active' || normalized === 'unknown';
}

/** Finished = completed + cancelled (and common aliases). */
export function isFinishedJobStatus(status: string | null | undefined): boolean {
  const normalized = normalizeJobStatus(status);
  return normalized === 'completed' || normalized === 'cancelled';
}

function asJobCountRow(job: {
  id?: string | null;
  status?: string | null;
  completed_at?: string | null;
  start_date?: string | null;
  scheduled_start?: string | null;
  due_date?: string | null;
  created_at?: string | null;
  is_skipped?: boolean | null;
  recurring_series_id?: string | null;
  occurrence_date?: string | null;
  deleted_at?: string | null;
  latest_completed_visit_date?: string | null;
}): JobCountRow {
  return {
    id: job.id,
    status: job.status,
    completed_at: job.completed_at,
    start_date: job.start_date,
    scheduled_start: job.scheduled_start,
    due_date: job.due_date,
    created_at: job.created_at,
    is_skipped: job.is_skipped,
    recurring_series_id: job.recurring_series_id,
    occurrence_date: job.occurrence_date,
    deleted_at: job.deleted_at,
    latest_completed_visit_date: job.latest_completed_visit_date
  };
}

/**
 * Match "today" using the shared operational-date engine
 * (completed_at for completed jobs; scheduled/service date otherwise).
 */
export function jobMatchesToday(
  job: {
    id?: string | null;
    status?: string | null;
    completed_at?: string | null;
    scheduled_start?: string | null;
    start_date?: string | null;
    due_date?: string | null;
    created_at?: string | null;
    is_skipped?: boolean | null;
    recurring_series_id?: string | null;
    occurrence_date?: string | null;
  },
  todayYmd: string = localYmd()
): boolean {
  return jobMatchesPeriod(job, 'today', todayYmd);
}

/**
 * Period match shared with the dashboard job-count card.
 * Uses calendar Today / Week / Month / Year bounds from rangeBounds + operational date.
 * Status validity (cancelled/skipped/draft) is applied separately by callers.
 */
export function jobMatchesPeriod(
  job: {
    id?: string | null;
    status?: string | null;
    completed_at?: string | null;
    scheduled_start?: string | null;
    start_date?: string | null;
    due_date?: string | null;
    created_at?: string | null;
    is_skipped?: boolean | null;
    recurring_series_id?: string | null;
    occurrence_date?: string | null;
  },
  period: JobsExportPeriod,
  todayYmd: string = localYmd()
): boolean {
  if (period === 'all') return true;
  const now = new Date(`${todayYmd}T12:00:00`);
  const range = dashboardRangeFromJobsPeriod(period);
  const { start, end } = rangeBounds(range, now);
  const date = getJobOperationalDate(asJobCountRow(job));
  if (!date) return false;
  return inRange(date, start, end);
}

/**
 * Dashboard-aligned job count for a Jobs-page period filter.
 * Excludes cancelled, skipped, draft, and duplicate generated visits.
 */
export function countJobsForDashboardPeriod(
  jobs: JobCountRow[],
  period: JobsExportPeriod | DashboardDateRange | string,
  now = new Date()
): number {
  return countValidJobsInPeriod(jobs, dashboardRangeFromJobsPeriod(period), now);
}

export function jobMatchesExportStatus(
  job: {
    status?: string | null;
    scheduled_start?: string | null;
    start_date?: string | null;
    due_date?: string | null;
  },
  status: JobsExportStatus
): boolean {
  if (!status || status === 'all') return true;
  if (status === 'active') return isActiveJobStatus(job.status);
  if (status === 'finished') return isFinishedJobStatus(job.status);
  if (status === 'unscheduled') {
    return !getEffectiveJobSchedule(job);
  }
  return String(job.status || '').toLowerCase() === String(status).toLowerCase();
}

/**
 * Post-filters applied in memory after listWorkspaceJobs
 * (period=today/week/month/year, status=finished, and status nuances).
 *
 * When status is `all`, non-countable jobs (cancelled/skipped/draft) are excluded so
 * the Jobs page total reconciles with the dashboard job card for the same period.
 * Explicit status filters (including cancelled/finished) still return those rows.
 */
export function applyJobsExportPostFilters<
  T extends {
    id?: string | null;
    status?: string | null;
    completed_at?: string | null;
    scheduled_start?: string | null;
    start_date?: string | null;
    due_date?: string | null;
    created_at?: string | null;
    assigned_to?: string | null;
    assigned_email?: string | null;
    is_skipped?: boolean | null;
    recurring_series_id?: string | null;
    occurrence_date?: string | null;
  }
>(jobs: T[], filters: JobsExportFilters, todayYmd: string = localYmd()): T[] {
  const now = new Date(`${todayYmd}T12:00:00`);
  const range = dashboardRangeFromJobsPeriod(filters.period);
  const statusAll = !filters.status || filters.status === 'all';

  let working = jobs;
  if (statusAll) {
    // Same validity + period engine as the dashboard job card.
    const countable = filterValidJobsInPeriod(jobs.map((job) => asJobCountRow(job)), range, now);
    const allowedIds = new Set(countable.map((job) => String(job.id || '')).filter(Boolean));
    working = jobs.filter((job) => {
      const id = String(job.id || '');
      if (id) return allowedIds.has(id);
      return isValidCountableJob(asJobCountRow(job)) && jobMatchesPeriod(job, filters.period, todayYmd);
    });
  } else {
    working = jobs.filter((job) => jobMatchesPeriod(job, filters.period, todayYmd));
  }

  return working.filter((job) => {
    if (filters.unassignedOnly && !isUnassignedJob(job)) return false;
    if (!jobMatchesExportStatus(job, filters.status)) return false;
    return true;
  });
}

/**
 * Status values that listWorkspaceJobs / filterJobsByStatus already understand.
 * `finished` must NOT be sent to the DB layer (no such status value).
 */
export function listWorkspaceStatusParam(status: JobsExportStatus): string | undefined {
  if (!status || status === 'all' || status === 'finished' || status === 'unscheduled') {
    return undefined;
  }
  return status;
}

export function describeAppliedFilters(
  filters: JobsExportFilters,
  labels?: { customer?: string; assignee?: string }
): string[] {
  const parts: string[] = [];
  if (filters.period !== 'all') parts.push(`Period: ${filters.period}`);
  if (filters.status !== 'all') parts.push(`Status: ${filters.status}`);
  if (filters.unassignedOnly) parts.push('Needs worker (unassigned)');
  if (filters.customerId) parts.push(labels?.customer || `Customer: ${filters.customerId}`);
  if (filters.assignedTo) parts.push(labels?.assignee || `Assigned: ${filters.assignedTo}`);
  if (filters.createdFrom) parts.push(`Created from: ${filters.createdFrom}`);
  return parts;
}
