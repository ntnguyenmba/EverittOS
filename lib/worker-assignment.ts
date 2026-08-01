/**
 * Canonical worker/contractor assignment helpers.
 *
 * Write path (jobs API): jobs.assigned_to stores workers.id.
 * Legacy rows may still store auth.users.id in jobs.assigned_to.
 * job_assignments.worker_id is an additional assignment source.
 *
 * All summary/filter reads should use these helpers so auth user IDs and
 * worker IDs resolve to the same person.
 */

export type AssignableJob = {
  id?: string | null;
  assigned_to?: string | null;
  status?: string | null;
  due_date?: string | null;
  scheduled_start?: string | null;
  start_date?: string | null;
  organization_id?: string | null;
};

export type WorkerIdentity = {
  /** Auth user id when the person is an organization member. */
  userId?: string | null;
  /** One or more workers.id rows linked to this person. */
  workerIds?: string[] | null;
};

export type NormalizedJobStatus = 'active' | 'completed' | 'cancelled' | 'unknown';

export type WorkerAssignmentSummary = {
  dueToday: number;
  overdue: number;
  completed: number;
  active: number;
  unscheduled: number;
  nextAssignment: { id: string; title: string; date: string } | null;
  hasUnscheduledAssignments: boolean;
  nextAssignmentLabel: 'scheduled' | 'unscheduled' | 'none';
};

const COMPLETED_STATUSES = new Set(['completed', 'done', 'complete', 'closed']);
const CANCELLED_STATUSES = new Set(['cancelled', 'canceled']);

export function formatLocalDateOnly(date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function formatStoredSchedule(value: string | null | undefined): string | null {
  const raw = String(value || '').trim();
  if (!raw) return null;

  const date = raw.slice(0, 10);
  const timeMatch = raw.match(/[T\s](\d{2}):(\d{2})/);
  if (!timeMatch) return date || null;

  const hour24 = Number(timeMatch[1]);
  const minute = timeMatch[2];
  if (!Number.isFinite(hour24) || hour24 < 0 || hour24 > 23) return date || null;

  const period = hour24 >= 12 ? 'PM' : 'AM';
  const hour12 = hour24 % 12 || 12;
  return `${date} · ${hour12}:${minute} ${period}`;
}

function scheduleDateKey(value: string | null | undefined): string {
  return String(value || '').slice(0, 10);
}

/** Canonical assigned worker/user id from a job row. */
export function getAssignedWorkerId(job: Pick<AssignableJob, 'assigned_to'>): string | null {
  const value = typeof job.assigned_to === 'string' ? job.assigned_to.trim() : '';
  return value || null;
}

/** All identity ids that represent this worker/person. */
export function workerIdentityAliases(identity: WorkerIdentity): Set<string> {
  const ids = new Set<string>();
  const userId = identity.userId?.trim();
  if (userId) ids.add(userId);
  for (const workerId of identity.workerIds || []) {
    const trimmed = workerId?.trim();
    if (trimmed) ids.add(trimmed);
  }
  return ids;
}

/**
 * True when the job is assigned to this worker via jobs.assigned_to
 * (worker id or legacy auth user id) or via job_assignments.worker_id.
 */
export function isJobAssignedToWorker(
  job: Pick<AssignableJob, 'id' | 'assigned_to'>,
  identity: WorkerIdentity,
  assignmentWorkerIdsByJob?: Map<string, string[]>
): boolean {
  const aliases = workerIdentityAliases(identity);
  if (!aliases.size) return false;

  const assigned = getAssignedWorkerId(job);
  if (assigned && aliases.has(assigned)) return true;

  const jobId = job.id ? String(job.id) : '';
  if (!jobId || !assignmentWorkerIdsByJob) return false;
  const assignedWorkerIds = assignmentWorkerIdsByJob.get(jobId) || [];
  return assignedWorkerIds.some((workerId) => aliases.has(workerId));
}

/**
 * Effective contractor-facing schedule.
 * Prefers scheduled_start and keeps its time, then start_date, then due_date.
 */
export function getEffectiveJobSchedule(
  job: Pick<AssignableJob, 'scheduled_start' | 'start_date' | 'due_date'>
): string | null {
  const scheduled = formatStoredSchedule(job.scheduled_start);
  if (scheduled) return scheduled;
  const start = String(job.start_date || '').slice(0, 10);
  if (start) return start;
  const due = String(job.due_date || '').slice(0, 10);
  if (due) return due;
  return null;
}

export function normalizeJobStatus(status: string | null | undefined): NormalizedJobStatus {
  const normalized = String(status || '')
    .trim()
    .toLowerCase();
  if (!normalized) return 'unknown';
  if (COMPLETED_STATUSES.has(normalized)) return 'completed';
  if (CANCELLED_STATUSES.has(normalized)) return 'cancelled';
  return 'active';
}

export function buildAssignmentWorkerIdsByJob(
  assignments: Array<{ job_id?: string | null; worker_id?: string | null }>
): Map<string, string[]> {
  const map = new Map<string, string[]>();
  for (const row of assignments) {
    const jobId = row.job_id ? String(row.job_id) : '';
    const workerId = row.worker_id ? String(row.worker_id) : '';
    if (!jobId || !workerId) continue;
    const list = map.get(jobId) || [];
    if (!list.includes(workerId)) list.push(workerId);
    map.set(jobId, list);
  }
  return map;
}

export function getWorkerAssignmentSummary(
  jobs: Array<AssignableJob & { title?: string | null }>,
  identity: WorkerIdentity,
  today = formatLocalDateOnly(),
  assignmentWorkerIdsByJob?: Map<string, string[]>
): WorkerAssignmentSummary {
  let dueToday = 0;
  let overdue = 0;
  let completed = 0;
  let active = 0;
  let unscheduled = 0;
  let nextAssignment: WorkerAssignmentSummary['nextAssignment'] = null;

  for (const job of jobs) {
    if (!isJobAssignedToWorker(job, identity, assignmentWorkerIdsByJob)) continue;

    const status = normalizeJobStatus(job.status);
    if (status === 'cancelled') continue;

    if (status === 'completed') {
      completed += 1;
      continue;
    }

    active += 1;
    const schedule = getEffectiveJobSchedule(job);
    const scheduleDate = scheduleDateKey(schedule);
    if (!scheduleDate) {
      unscheduled += 1;
      continue;
    }

    if (scheduleDate === today) dueToday += 1;
    if (scheduleDate < today) overdue += 1;

    if (scheduleDate >= today) {
      if (!nextAssignment || scheduleDate < scheduleDateKey(nextAssignment.date)) {
        nextAssignment = {
          id: String(job.id || ''),
          title: String(job.title || 'Untitled job'),
          date: schedule || scheduleDate
        };
      }
    }
  }

  const hasUnscheduledAssignments = unscheduled > 0;
  let nextAssignmentLabel: WorkerAssignmentSummary['nextAssignmentLabel'] = 'none';
  if (nextAssignment) nextAssignmentLabel = 'scheduled';
  else if (hasUnscheduledAssignments) nextAssignmentLabel = 'unscheduled';

  return {
    dueToday,
    overdue,
    completed,
    active,
    unscheduled,
    nextAssignment,
    hasUnscheduledAssignments,
    nextAssignmentLabel
  };
}

/** Resolve filter aliases when a page receives either a user id or worker id. */
export function assignmentFilterAliases(input: {
  filterId: string | null | undefined;
  userId?: string | null;
  workerIds?: string[] | null;
}): string[] {
  const filterId = input.filterId?.trim() || '';
  if (!filterId) return [];
  return Array.from(
    workerIdentityAliases({
      userId: input.userId || filterId,
      workerIds: input.workerIds || [filterId]
    })
  );
}
