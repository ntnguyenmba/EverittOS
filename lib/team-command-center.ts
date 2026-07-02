import type { SupabaseClient } from '@supabase/supabase-js';

export type WorkloadStatus = 'available' | 'busy' | 'overloaded';

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

type JobRow = {
  id: string;
  title: string;
  status: string | null;
  due_date: string | null;
  scheduled_start: string | null;
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

const COMPLETED_STATUSES = new Set(['completed', 'done', 'complete', 'closed']);
const CANCELLED_STATUSES = new Set(['cancelled', 'canceled']);

export function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

export function monthStartIso(date = new Date()): string {
  const d = new Date(date);
  d.setDate(1);
  return d.toISOString().slice(0, 10);
}

export function jobEffectiveDate(job: Pick<JobRow, 'due_date' | 'scheduled_start'>): string | null {
  if (job.due_date) return job.due_date.slice(0, 10);
  if (job.scheduled_start) return job.scheduled_start.slice(0, 10);
  return null;
}

export function isActiveJobStatus(status: string | null | undefined): boolean {
  const normalized = (status || '').toLowerCase();
  return !COMPLETED_STATUSES.has(normalized) && !CANCELLED_STATUSES.has(normalized);
}

export function isCompletedJobStatus(status: string | null | undefined): boolean {
  const normalized = (status || '').toLowerCase();
  return COMPLETED_STATUSES.has(normalized);
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

function displayName(member: MemberRow): string {
  return member.profiles?.full_name?.trim() || member.profiles?.email?.trim() || 'Pending profile';
}

function buildJobAssignees(
  jobs: JobRow[],
  workers: WorkerRow[],
  assignments: AssignmentRow[]
): Map<string, Set<string>> {
  const workerAuthById = new Map(workers.map((w) => [w.id, w.auth_user_id]).filter(([, uid]) => uid) as [string, string][]);
  const map = new Map<string, Set<string>>();

  for (const job of jobs) {
    const assignees = new Set<string>();
    if (job.assigned_to) assignees.add(job.assigned_to);
    map.set(job.id, assignees);
  }

  for (const row of assignments) {
    const authUserId = workerAuthById.get(row.worker_id);
    if (!authUserId) continue;
    const existing = map.get(row.job_id) || new Set<string>();
    existing.add(authUserId);
    map.set(row.job_id, existing);
  }

  return map;
}

function jobAssignedToUser(assignees: Map<string, Set<string>>, jobId: string, userId: string): boolean {
  return assignees.get(jobId)?.has(userId) ?? false;
}

function summarizeMemberJobs(
  userId: string,
  jobs: JobRow[],
  assignees: Map<string, Set<string>>,
  lastActivityByUser: Map<string, string>,
  today: string
): Omit<TeamCommandMember, 'userId' | 'name' | 'email' | 'role' | 'active'> {
  let activeJobs = 0;
  let completedJobs = 0;
  let overdueJobs = 0;
  let dueTodayJobs = 0;
  let nextUpcomingJob: TeamCommandMember['nextUpcomingJob'] = null;

  const memberJobs = jobs.filter((job) => jobAssignedToUser(assignees, job.id, userId));

  for (const job of memberJobs) {
    if (isCompletedJobStatus(job.status)) {
      completedJobs += 1;
      continue;
    }
    if (!isActiveJobStatus(job.status)) continue;

    activeJobs += 1;
    const effectiveDate = jobEffectiveDate(job);
    if (effectiveDate && effectiveDate < today) overdueJobs += 1;
    if (effectiveDate === today) dueTodayJobs += 1;

    if (effectiveDate && effectiveDate >= today) {
      if (!nextUpcomingJob || effectiveDate < nextUpcomingJob.date) {
        nextUpcomingJob = { id: job.id, title: job.title, date: effectiveDate };
      }
    }
  }

  return {
    activeJobs,
    completedJobs,
    overdueJobs,
    dueTodayJobs,
    workloadStatus: resolveWorkloadStatus(activeJobs, overdueJobs, dueTodayJobs),
    lastActivityAt: lastActivityByUser.get(userId) || null,
    nextUpcomingJob
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

export async function fetchTeamCommandCenterData(
  supabase: SupabaseClient,
  organizationId: string
): Promise<{ data: TeamCommandCenterData | null; error: string | null }> {
  const today = todayIso();
  const monthStart = monthStartIso();

  const [
    membersRes,
    jobsRes,
    workersRes,
    activityRes,
    activityCountRes,
    customersRes,
    photosRes,
    reportsRes
  ] = await Promise.all([
    supabase
      .from('organization_members')
      .select('user_id, role, active, profiles(email, full_name)')
      .eq('organization_id', organizationId)
      .eq('active', true)
      .order('created_at', { ascending: true }),
    supabase
      .from('jobs')
      .select('id, title, status, due_date, scheduled_start, assigned_to, created_at')
      .eq('organization_id', organizationId),
    supabase.from('workers').select('id, auth_user_id').eq('organization_id', organizationId),
    supabase
      .from('activity_logs')
      .select('id, message, actor_name, created_at, entity_type, entity_id, user_id')
      .eq('organization_id', organizationId)
      .order('created_at', { ascending: false })
      .limit(10),
    supabase
      .from('activity_logs')
      .select('id', { count: 'exact', head: true })
      .eq('organization_id', organizationId),
    supabase
      .from('customers')
      .select('id', { count: 'exact', head: true })
      .eq('organization_id', organizationId)
      .neq('pipeline_stage', 'archived'),
    supabase
      .from('job_photos')
      .select('id', { count: 'exact', head: true })
      .eq('organization_id', organizationId),
    supabase
      .from('job_reports')
      .select('id', { count: 'exact', head: true })
      .eq('organization_id', organizationId)
  ]);

  if (membersRes.error) return { data: null, error: membersRes.error.message };
  if (jobsRes.error) return { data: null, error: jobsRes.error.message };

  const jobs = (jobsRes.data || []) as JobRow[];
  const jobIds = jobs.map((j) => j.id);

  let assignments: AssignmentRow[] = [];
  if (jobIds.length) {
    const { data: assignmentRows, error: assignmentError } = await supabase
      .from('job_assignments')
      .select('job_id, worker_id')
      .in('job_id', jobIds);
    if (assignmentError) return { data: null, error: assignmentError.message };
    assignments = (assignmentRows || []) as AssignmentRow[];
  }

  const members = (membersRes.data || []) as unknown as MemberRow[];
  const workers = (workersRes.data || []) as WorkerRow[];
  const assignees = buildJobAssignees(jobs, workers, assignments);

  const lastActivityByUser = new Map<string, string>();
  const memberUserIds = members.map((m) => m.user_id);
  if (memberUserIds.length) {
    const { data: memberActivityRows, error: memberActivityError } = await supabase
      .from('activity_logs')
      .select('user_id, created_at')
      .eq('organization_id', organizationId)
      .in('user_id', memberUserIds)
      .order('created_at', { ascending: false })
      .limit(500);
    if (memberActivityError) return { data: null, error: memberActivityError.message };
    for (const row of memberActivityRows || []) {
      const userId = (row as { user_id?: string | null }).user_id;
      const createdAt = (row as { created_at?: string | null }).created_at;
      if (!userId || !createdAt || lastActivityByUser.has(userId)) continue;
      lastActivityByUser.set(userId, createdAt);
    }
  }

  const memberSummaries: TeamCommandMember[] = members.map((member) => {
    const stats = summarizeMemberJobs(member.user_id, jobs, assignees, lastActivityByUser, today);
    return {
      userId: member.user_id,
      name: displayName(member),
      email: member.profiles?.email || null,
      role: member.role,
      active: member.active,
      ...stats
    };
  });

  const orgJobTotals = summarizeOrgJobs(jobs, today, monthStart);

  const recentActivity: TeamCommandActivity[] = (activityRes.data || []).map((row) => {
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

  return {
    data: {
      members: memberSummaries,
      recentActivity,
      totals: {
        teamMembers: members.length,
        activeJobs: orgJobTotals.activeJobs,
        completedJobs: orgJobTotals.completedJobs,
        overdueJobs: orgJobTotals.overdueJobs,
        customers: customersRes.count || 0,
        photos: photosRes.count || 0,
        reports: reportsRes.count || 0,
        teamActivity: activityCountRes.count || 0,
        jobsThisMonth: orgJobTotals.jobsThisMonth
      },
      jobsThisMonthFrom: monthStart
    },
    error: null
  };
}
