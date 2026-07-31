/**
 * Canonical Jobs list / export filters — matches Jobs page + /api/jobs query params:
 * customer, status, period, filter=unassigned, assigned_to, from
 */

import { getEffectiveJobSchedule, normalizeJobStatus } from '@/lib/worker-assignment';

export type JobsExportPeriod = 'all' | 'today' | 'week' | 'month';

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

const PERIODS: JobsExportPeriod[] = ['all', 'today', 'week', 'month'];

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

/**
 * Match "today" using scheduled_start → start_date → due_date (local YMD).
 */
export function jobMatchesToday(
  job: {
    scheduled_start?: string | null;
    start_date?: string | null;
    due_date?: string | null;
  },
  todayYmd: string = localYmd()
): boolean {
  const effective = getEffectiveJobSchedule(job);
  return Boolean(effective && effective === todayYmd);
}

function addLocalDays(ymd: string, days: number): string {
  const match = ymd.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return ymd;
  const d = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  d.setDate(d.getDate() + days);
  return localYmd(d);
}

export function jobMatchesPeriod(
  job: {
    scheduled_start?: string | null;
    start_date?: string | null;
    due_date?: string | null;
  },
  period: JobsExportPeriod,
  todayYmd: string = localYmd()
): boolean {
  if (period === 'all') return true;
  const effective = getEffectiveJobSchedule(job);
  if (!effective) return false;
  if (period === 'today') return effective === todayYmd;
  if (period === 'week') {
    const start = addLocalDays(todayYmd, -6);
    return effective >= start && effective <= todayYmd;
  }
  if (period === 'month') {
    const start = addLocalDays(todayYmd, -29);
    return effective >= start && effective <= todayYmd;
  }
  return true;
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
 * (period=today/week/month, status=finished, and status nuances).
 */
export function applyJobsExportPostFilters<
  T extends {
    status?: string | null;
    scheduled_start?: string | null;
    start_date?: string | null;
    due_date?: string | null;
    assigned_to?: string | null;
    assigned_email?: string | null;
  }
>(jobs: T[], filters: JobsExportFilters, todayYmd: string = localYmd()): T[] {
  return jobs.filter((job) => {
    if (filters.unassignedOnly && !isUnassignedJob(job)) return false;
    if (!jobMatchesPeriod(job, filters.period, todayYmd)) return false;
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
