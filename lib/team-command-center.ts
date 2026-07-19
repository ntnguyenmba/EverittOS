import type { PostgrestError, SupabaseClient } from '@supabase/supabase-js';
import { isMissingColumnError } from '@/lib/profile-query';
import { isMissingSchemaError } from '@/lib/supabase-schema-errors';
import {
  buildAssignmentWorkerIdsByJob,
  formatLocalDateOnly,
  getEffectiveJobSchedule,
  getWorkerAssignmentSummary,
  isJobAssignedToWorker,
  normalizeJobStatus,
  type WorkerIdentity
} from '@/lib/worker-assignment';

export type WorkloadStatus = 'available' | 'busy' | 'overloaded';

export type TeamCommandMemberDebugJob = {
  id: string;
  title: string;
  status: string | null;
  effectiveDate: string | null;
  assignedDirectly: boolean;
  assignedThroughWorker: boolean;
  active: boolean;
  completed: boolean;
  overdue: boolean;
  dueToday: boolean;
};

export type TeamCommandMemberDebug = {
  workspaceJobCount: number;
  workerIds: string[];
  assignmentRowsForWorker: number;
  directAssignedJobIds: string[];
  assignmentJobIds: string[];
  matchingJobIds: string[];
  unassignedWorkspaceJobIds: string[];
  otherAssignedWorkspaceJobIds: string[];
  matchingJobDetails: TeamCommandMemberDebugJob[];
  note: string;
};

export type TeamCommandMember = {
  userId: string;
  name: string;
  email: string | null;
  role: string;
  active: boolean;
  activeJobs: number;
  completedJobs: number;
  overdueJobs: number;
  dueTodayJobs: number;
  workloadStatus: WorkloadStatus;
  lastActivityAt: string | null;
  nextUpcomingJob: { id: string; title: string; date: string } | null;
  hasUnscheduledAssignments: boolean;
  debug?: TeamCommandMemberDebug;
};

export type TeamCommandActivity = {
  id: string;
  message: string | null;
  actorName: string | null;
  createdAt: string | null;
  entityType: string | null;
  entityId: string | null;
  href: string | null;
};

export type TeamCommandTotals = {
  teamMembers: number;
  activeJobs: number;
  completedJobs: number;
  overdueJobs: number;
  customers: number;
  photos: number;
  reports: number;
  teamActivity: number;
  jobsThisMonth: number;
};

export type TeamCommandCenterData = {
  members: TeamCommandMember[];
  recentActivity: TeamCommandActivity[];
  totals: TeamCommandTotals;
  jobsThisMonthFrom: string;
};

export const EMPTY_TEAM_COMMAND_TOTALS: TeamCommandTotals = {
  teamMembers: 0,
  activeJobs: 0,
  completedJobs: 0,
  overdueJobs: 0,
  customers: 0,
  photos: 0,
  reports: 0,
  teamActivity: 0,
  jobsThisMonth: 0
};

type JobRow = {
  id: string;
  title: string;
  status: string | null;
  due_date: string | null;
  scheduled_start: string | null;
  start_date: string | null;
  assigned_to: string | null;
  created_at: string | null;
};

type MemberRow = {
  user_id: string;
  role: string;
  active: boolean;
  profiles: { email: string | null; full_name: string | null } | null;
};

type WorkerRow = { id: string; auth_user_id: string | null };
type AssignmentRow = { job_id: string; worker_id: string };

const JOBS_SELECT_FULL =
  'id, title, status, due_date, scheduled_start, start_date, assigned_to, created_at';
const JOBS_SELECT_BASE = 'id, title, status, due_date, assigned_to, created_at';

export function todayIso(): string {
  return formatLocalDateOnly();
}

export function monthStartIso(date = new Date()): string {
  const d = new Date(date.getFullYear(), date.getMonth(), 1);
  return formatLocalDateOnly(d);
}

/** @deprecated Prefer getEffectiveJobSchedule from worker-assignment. */
export function jobEffectiveDate(
  job: Pick<JobRow, 'due_date' | 'scheduled_start' | 'start_date'>
): string | null {
  return getEffectiveJobSchedule(job);
}

export function isActiveJobStatus(status: string | null | undefined): boolean {
  return normalizeJobStatus(status) === 'active' || normalizeJobStatus(status) === 'unknown';
}

export function isCompletedJobStatus(status: string | null | undefined): boolean {
  return normalizeJobStatus(status) === 'completed';
}

export function resolveWorkloadStatus(
  activeJobs: number,
  overdueJobs: number,
  dueTodayJobs: number
): WorkloadStatus {
  if (activeJobs >= 8 || overdueJobs > 0) return 'overloaded';
  if (activeJobs >= 4 || dueTodayJobs > 0) return 'busy';
  if (activeJobs <= 3 && overdueJobs === 0) return 'available';
  return 'busy';
}

export function activityEntityHref(entityType: string | null, entityId: string | null): string | null {
  if (!entityType || !entityId) return null;
  if (entityType === 'job') return `/jobs/${entityId}`;
  if (entityType === 'customer') return `/customers/${entityId}`;
  return null;
}

export function normalizeTeamCommandCenterData(
  payload:
    | (Partial<Omit<TeamCommandCenterData, 'totals' | 'recentActivity'>> & {
        recentActivity?: TeamCommandActivity[] | null;
        totals?: Partial<TeamCommandTotals> | null;
      })
    | null
    | undefined
): TeamCommandCenterData {
  const totals = payload?.totals || EMPTY_TEAM_COMMAND_TOTALS;
  return {
    members: Array.isArray(payload?.members) ? payload!.members : [],
    recentActivity: Array.isArray(payload?.recentActivity) ? payload!.recentActivity : [],
    totals: {
      teamMembers: totals.teamMembers ?? 0,
      activeJobs: totals.activeJobs ?? 0,
      completedJobs: totals.completedJobs ?? 0,
      overdueJobs: totals.overdueJobs ?? 0,
      customers: totals.customers ?? 0,
      photos: totals.photos ?? 0,
      reports: totals.reports ?? 0,
      teamActivity: totals.teamActivity ?? 0,
      jobsThisMonth: totals.jobsThisMonth ?? 0
    },
    jobsThisMonthFrom: payload?.jobsThisMonthFrom || monthStartIso()
  };
}

function logTeamCommandQueryError(label: string, error: PostgrestError | Error | string | null | undefined) {
  console.error(`Team Command Center [${label}]:`, error);
}

function isRecoverableQueryError(error: PostgrestError | null | undefined): boolean {
  if (!error) return false;
  return isMissingSchemaError(error) || isMissingColumnError(error.message || '');
}

function displayName(member: MemberRow): string {
  return member.profiles?.full_name?.trim() || member.profiles?.email?.trim() || 'Pending profile';
}

function workerIdsForUser(workers: WorkerRow[], userId: string): string[] {
  return workers.filter((worker) => worker.auth_user_id === userId).map((worker) => worker.id).filter(Boolean);
}

function identityForMember(userId: string, workers: WorkerRow[]): WorkerIdentity {
  return {
    userId,
    workerIds: workerIdsForUser(workers, userId)
  };
}

function summarizeMemberJobs(
  userId: string,
  jobs: JobRow[],
  workers: WorkerRow[],
  assignmentWorkerIdsByJob: Map<string, string[]>,
  lastActivityByUser: Map<string, string>,
  today: string
): Omit<TeamCommandMember, 'userId' | 'name' | 'email' | 'role' | 'active' | 'debug'> {
  const summary = getWorkerAssignmentSummary(
    jobs,
    identityForMember(userId, workers),
    today,
    assignmentWorkerIdsByJob
  );

  return {
    activeJobs: summary.active,
    completedJobs: summary.completed,
    overdueJobs: summary.overdue,
    dueTodayJobs: summary.dueToday,
    workloadStatus: resolveWorkloadStatus(summary.active, summary.overdue, summary.dueToday),
    lastActivityAt: lastActivityByUser.get(userId) || null,
    nextUpcomingJob: summary.nextAssignment,
    hasUnscheduledAssignments: summary.hasUnscheduledAssignments
  };
}

function buildMemberDebug(
  userId: string,
  jobs: JobRow[],
  workers: WorkerRow[],
  assignments: AssignmentRow[],
  assignmentWorkerIdsByJob: Map<string, string[]>,
  today: string
): TeamCommandMemberDebug {
  const identity = identityForMember(userId, workers);
  const workerIds = identity.workerIds || [];
  const workerIdSet = new Set(workerIds);
  const assignmentRowsForWorker = assignments.filter((assignment) => workerIdSet.has(assignment.worker_id));
  const assignmentJobIds = Array.from(new Set(assignmentRowsForWorker.map((assignment) => assignment.job_id)));
  const directAssignedJobIds = jobs
    .filter((job) => isJobAssignedToWorker(job, identity))
    .map((job) => job.id);
  const matchingJobs = jobs.filter((job) => isJobAssignedToWorker(job, identity, assignmentWorkerIdsByJob));
  const matchingJobIds = matchingJobs.map((job) => job.id);
  const unassignedWorkspaceJobIds = jobs
    .filter((job) => !job.assigned_to && !(assignmentWorkerIdsByJob.get(job.id)?.length))
    .map((job) => job.id);
  const otherAssignedWorkspaceJobIds = jobs
    .filter(
      (job) =>
        !isJobAssignedToWorker(job, identity, assignmentWorkerIdsByJob) &&
        (Boolean(job.assigned_to) || Boolean(assignmentWorkerIdsByJob.get(job.id)?.length))
    )
    .map((job) => job.id);

  const matchingJobDetails = matchingJobs.map((job) => {
    const effectiveDate = jobEffectiveDate(job);
    const completed = isCompletedJobStatus(job.status);
    const active = isActiveJobStatus(job.status);
    return {
      id: job.id,
      title: job.title,
      status: job.status,
      effectiveDate,
      assignedDirectly: Boolean(job.assigned_to && (job.assigned_to === userId || workerIdSet.has(job.assigned_to))),
      assignedThroughWorker: assignmentJobIds.includes(job.id),
      active,
      completed,
      overdue: active && Boolean(effectiveDate && effectiveDate < today),
      dueToday: active && effectiveDate === today
    };
  });

  let note = 'Assigned jobs found for this member.';
  if (matchingJobIds.length === 0) {
    if (directAssignedJobIds.length === 0 && assignmentJobIds.length === 0 && workerIds.length === 0) {
      note = 'No direct assignment and no worker profile was found for this member.';
    } else if (directAssignedJobIds.length === 0 && assignmentJobIds.length === 0) {
      note = 'A worker profile exists, but no direct or worker-based job assignments were found.';
    } else {
      note = 'Assignment records exist, but none matched jobs in this workspace query.';
    }
  }

  return {
    workspaceJobCount: jobs.length,
    workerIds,
    assignmentRowsForWorker: assignmentRowsForWorker.length,
    directAssignedJobIds,
    assignmentJobIds,
    matchingJobIds,
    unassignedWorkspaceJobIds,
    otherAssignedWorkspaceJobIds,
    matchingJobDetails,
    note
  };
}

function summarizeOrgJobs(jobs: JobRow[], today: string, monthStart: string) {
  let activeJobs = 0;
  let completedJobs = 0;
  let overdueJobs = 0;
  let jobsThisMonth = 0;

  for (const job of jobs) {
    if (job.created_at && job.created_at.slice(0, 10) >= monthStart) jobsThisMonth += 1;

    if (isCompletedJobStatus(job.status)) {
      completedJobs += 1;
      continue;
    }
    if (!isActiveJobStatus(job.status)) continue;

    activeJobs += 1;
    const effectiveDate = jobEffectiveDate(job);
    if (effectiveDate && effectiveDate < today) overdueJobs += 1;
  }

  return { activeJobs, completedJobs, overdueJobs, jobsThisMonth };
}

async function fetchOrgMembers(
  supabase: SupabaseClient,
  organizationId: string
): Promise<{ members: MemberRow[]; error: string | null }> {
  const membersRes = await supabase
    .from('organization_members')
    .select('user_id, role, active')
    .eq('organization_id', organizationId)
    .eq('active', true)
    .order('created_at', { ascending: true });

  if (membersRes.error) {
    logTeamCommandQueryError('organization_members', membersRes.error);
    return { members: [], error: membersRes.error.message };
  }

  const rawMembers = membersRes.data || [];
  const userIds = rawMembers.map((row) => row.user_id).filter(Boolean);
  const profileMap = new Map<string, { email: string | null; full_name: string | null }>();

  if (userIds.length) {
    const profilesRes = await supabase.from('profiles').select('id, email, full_name').in('id', userIds);
    if (profilesRes.error) {
      logTeamCommandQueryError('profiles', profilesRes.error);
    } else {
      for (const profile of profilesRes.data || []) {
        profileMap.set(profile.id, {
          email: profile.email ?? null,
          full_name: profile.full_name ?? null
        });
      }
    }
  }

  const members: MemberRow[] = rawMembers.map((row) => ({
    user_id: row.user_id,
    role: row.role,
    active: row.active,
    profiles: profileMap.get(row.user_id) || null
  }));

  return { members, error: null };
}

async function fetchOrgJobs(supabase: SupabaseClient, organizationId: string): Promise<JobRow[]> {
  const fullRes = await supabase.from('jobs').select(JOBS_SELECT_FULL).eq('organization_id', organizationId);
  let queryError = fullRes.error;
  let rawRows: Record<string, unknown>[] = (fullRes.data || []) as Record<string, unknown>[];

  if (queryError && isRecoverableQueryError(queryError)) {
    logTeamCommandQueryError('jobs (full select)', queryError);
    const baseRes = await supabase.from('jobs').select(JOBS_SELECT_BASE).eq('organization_id', organizationId);
    rawRows = (baseRes.data || []) as Record<string, unknown>[];
    queryError = baseRes.error;
  }

  if (queryError) {
    logTeamCommandQueryError('jobs', queryError);
    return [];
  }

  return rawRows.map((row) => ({
    id: String(row.id),
    title: String(row.title || 'Untitled job'),
    status: typeof row.status === 'string' ? row.status : null,
    due_date: typeof row.due_date === 'string' ? row.due_date : null,
    scheduled_start: typeof row.scheduled_start === 'string' ? row.scheduled_start : null,
    start_date: typeof row.start_date === 'string' ? row.start_date : null,
    assigned_to: typeof row.assigned_to === 'string' ? row.assigned_to : null,
    created_at: typeof row.created_at === 'string' ? row.created_at : null
  }));
}

async function fetchWorkers(
  supabase: SupabaseClient,
  organizationId: string
): Promise<WorkerRow[]> {
  const workersRes = await supabase
    .from('workers')
    .select('id, auth_user_id')
    .eq('organization_id', organizationId);

  if (workersRes.error) {
    if (isRecoverableQueryError(workersRes.error)) {
      logTeamCommandQueryError('workers (skipped)', workersRes.error);
      return [];
    }
    logTeamCommandQueryError('workers', workersRes.error);
    return [];
  }

  return (workersRes.data || []) as WorkerRow[];
}

async function fetchJobAssignments(
  supabase: SupabaseClient,
  jobIds: string[]
): Promise<AssignmentRow[]> {
  if (!jobIds.length) return [];

  const assignmentsRes = await supabase
    .from('job_assignments')
    .select('job_id, worker_id')
    .in('job_id', jobIds);

  if (assignmentsRes.error) {
    if (isRecoverableQueryError(assignmentsRes.error)) {
      logTeamCommandQueryError('job_assignments (skipped)', assignmentsRes.error);
      return [];
    }
    logTeamCommandQueryError('job_assignments', assignmentsRes.error);
    return [];
  }

  return (assignmentsRes.data || []) as AssignmentRow[];
}

async function fetchRecentActivity(
  supabase: SupabaseClient,
  organizationId: string
): Promise<TeamCommandActivity[]> {
  const activityRes = await supabase
    .from('activity_logs')
    .select('id, message, actor_name, created_at, entity_type, entity_id')
    .eq('organization_id', organizationId)
    .order('created_at', { ascending: false })
    .limit(10);

  if (activityRes.error) {
    if (isRecoverableQueryError(activityRes.error)) {
      logTeamCommandQueryError('activity_logs recent (skipped)', activityRes.error);
      return [];
    }
    logTeamCommandQueryError('activity_logs recent', activityRes.error);
    return [];
  }

  return (activityRes.data || []).map((row) => {
    const item = row as {
      id: string;
      message: string | null;
      actor_name: string | null;
      created_at: string | null;
      entity_type: string | null;
      entity_id: string | null;
    };
    return {
      id: item.id,
      message: item.message,
      actorName: item.actor_name,
      createdAt: item.created_at,
      entityType: item.entity_type,
      entityId: item.entity_id,
      href: activityEntityHref(item.entity_type, item.entity_id)
    };
  });
}

async function fetchActivityCount(supabase: SupabaseClient, organizationId: string): Promise<number> {
  const activityCountRes = await supabase
    .from('activity_logs')
    .select('id', { count: 'exact', head: true })
    .eq('organization_id', organizationId);

  if (activityCountRes.error) {
    if (isRecoverableQueryError(activityCountRes.error)) {
      logTeamCommandQueryError('activity_logs count (skipped)', activityCountRes.error);
      return 0;
    }
    logTeamCommandQueryError('activity_logs count', activityCountRes.error);
    return 0;
  }

  return activityCountRes.count || 0;
}

async function fetchMemberLastActivity(
  supabase: SupabaseClient,
  organizationId: string,
  memberUserIds: string[]
): Promise<Map<string, string>> {
  const lastActivityByUser = new Map<string, string>();
  if (!memberUserIds.length) return lastActivityByUser;

  const memberActivityRes = await supabase
    .from('activity_logs')
    .select('user_id, created_at')
    .eq('organization_id', organizationId)
    .in('user_id', memberUserIds)
    .order('created_at', { ascending: false })
    .limit(500);

  if (memberActivityRes.error) {
    if (isRecoverableQueryError(memberActivityRes.error)) {
      logTeamCommandQueryError('activity_logs member last (skipped)', memberActivityRes.error);
      return lastActivityByUser;
    }
    logTeamCommandQueryError('activity_logs member last', memberActivityRes.error);
    return lastActivityByUser;
  }

  for (const row of memberActivityRes.data || []) {
    const userId = (row as { user_id?: string | null }).user_id;
    const createdAt = (row as { created_at?: string | null }).created_at;
    if (!userId || !createdAt || lastActivityByUser.has(userId)) continue;
    lastActivityByUser.set(userId, createdAt);
  }

  return lastActivityByUser;
}

async function fetchOrgCount(
  supabase: SupabaseClient,
  table: 'customers' | 'job_photos' | 'job_reports',
  organizationId: string
): Promise<number> {
  if (table === 'customers') {
    const filteredRes = await supabase
      .from('customers')
      .select('id', { count: 'exact', head: true })
      .eq('organization_id', organizationId)
      .neq('pipeline_stage', 'archived');

    if (!filteredRes.error) return filteredRes.count || 0;
    if (!isRecoverableQueryError(filteredRes.error)) {
      logTeamCommandQueryError(`${table} count`, filteredRes.error);
      return 0;
    }
    logTeamCommandQueryError(`${table} count (pipeline filter skipped)`, filteredRes.error);
  }

  const countRes = await supabase
    .from(table)
    .select('id', { count: 'exact', head: true })
    .eq('organization_id', organizationId);

  if (countRes.error) {
    if (isRecoverableQueryError(countRes.error)) {
      logTeamCommandQueryError(`${table} count (skipped)`, countRes.error);
      return 0;
    }
    logTeamCommandQueryError(`${table} count`, countRes.error);
    return 0;
  }

  return countRes.count || 0;
}

export async function fetchTeamCommandCenterData(
  supabase: SupabaseClient,
  organizationId: string | null | undefined
): Promise<{ data: TeamCommandCenterData | null; error: string | null; warnings: string[] }> {
  const warnings: string[] = [];
  const today = todayIso();
  const monthStart = monthStartIso();

  if (!organizationId) {
    const message = 'No organization workspace found for the current user.';
    logTeamCommandQueryError('organization', message);
    return { data: null, error: message, warnings };
  }

  const membersResult = await fetchOrgMembers(supabase, organizationId);
  if (membersResult.error) warnings.push(`members: ${membersResult.error}`);

  const jobs = await fetchOrgJobs(supabase, organizationId);
  const workers = await fetchWorkers(supabase, organizationId);
  const assignments = await fetchJobAssignments(
    supabase,
    jobs.map((job) => job.id)
  );
  const recentActivity = await fetchRecentActivity(supabase, organizationId);
  const teamActivity = await fetchActivityCount(supabase, organizationId);
  const customers = await fetchOrgCount(supabase, 'customers', organizationId);
  const photos = await fetchOrgCount(supabase, 'job_photos', organizationId);
  const reports = await fetchOrgCount(supabase, 'job_reports', organizationId);

  const members = membersResult.members;
  const assignmentWorkerIdsByJob = buildAssignmentWorkerIdsByJob(assignments);
  const lastActivityByUser = await fetchMemberLastActivity(
    supabase,
    organizationId,
    members.map((member) => member.user_id)
  );

  const memberSummaries: TeamCommandMember[] = members.map((member) => {
    const stats = summarizeMemberJobs(
      member.user_id,
      jobs,
      workers,
      assignmentWorkerIdsByJob,
      lastActivityByUser,
      today
    );
    return {
      userId: member.user_id,
      name: displayName(member),
      email: member.profiles?.email || null,
      role: member.role,
      active: member.active,
      ...stats,
      debug: buildMemberDebug(member.user_id, jobs, workers, assignments, assignmentWorkerIdsByJob, today)
    };
  });

  const orgJobTotals = summarizeOrgJobs(jobs, today, monthStart);

  const data = normalizeTeamCommandCenterData({
    members: memberSummaries,
    recentActivity,
    totals: {
      teamMembers: members.length,
      activeJobs: orgJobTotals.activeJobs,
      completedJobs: orgJobTotals.completedJobs,
      overdueJobs: orgJobTotals.overdueJobs,
      customers,
      photos,
      reports,
      teamActivity,
      jobsThisMonth: orgJobTotals.jobsThisMonth
    },
    jobsThisMonthFrom: monthStart
  });

  return {
    data,
    error: warnings.length ? warnings.join('; ') : null,
    warnings
  };
}
