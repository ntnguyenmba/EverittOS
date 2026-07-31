import type { SupabaseClient } from '@supabase/supabase-js';
import { isManagerRole, normalizeRole, type UserRole } from '@/lib/roles';
import {
  formatLocalDateOnly,
  getEffectiveJobSchedule,
  normalizeJobStatus
} from '@/lib/worker-assignment';

export const JOB_LIST_COLUMNS =
  'id, title, customer_name, customer_id, address, status, completed_at, assigned_to, assigned_email, organization_id, user_id, created_at, start_date, due_date, scheduled_start, scheduled_end, timezone, revenue_amount';

export type JobListRow = {
  id: string;
  title: string;
  customer_name: string | null;
  customer_id: string | null;
  address: string | null;
  status: string | null;
  completed_at?: string | null;
  assigned_to?: string | null;
  assigned_email?: string | null;
  organization_id?: string | null;
  user_id?: string | null;
  created_at?: string | null;
  start_date?: string | null;
  due_date?: string | null;
  scheduled_start?: string | null;
  scheduled_end?: string | null;
  timezone?: string | null;
  revenue_amount?: number | null;
  billing_status?: string | null;
};

export type JobListFilters = {
  customerId?: string | null;
  status?: string | null;
  completedSince?: string | null;
  unassignedOnly?: boolean;
  missingCompletionDateOnly?: boolean;
  assignedTo?: string | null;
  createdFrom?: string | null;
};

export function filterJobsByStatus<T extends JobListRow>(
  rows: T[],
  status: string | null | undefined,
  today = formatLocalDateOnly()
): T[] {
  if (!status) return rows;

  if (status === 'active') {
    return rows.filter((job) => {
      const normalized = normalizeJobStatus(job.status);
      return normalized === 'active' || normalized === 'unknown';
    });
  }
  if (status === 'overdue') {
    return rows.filter((job) => {
      const normalized = normalizeJobStatus(job.status);
      if (normalized === 'completed' || normalized === 'cancelled') return false;
      const effectiveDate = getEffectiveJobSchedule(job);
      return Boolean(effectiveDate && effectiveDate < today);
    });
  }
  if (status === 'completed') {
    return rows.filter((job) => normalizeJobStatus(job.status) === 'completed');
  }

  return rows.filter((job) => (job.status || '').toLowerCase() === status.toLowerCase());
}

async function workerIdsForUser(
  supabase: SupabaseClient,
  organizationId: string | null | undefined,
  userId: string
): Promise<string[]> {
  if (!organizationId) return [];

  const { data } = await supabase
    .from('workers')
    .select('id')
    .eq('organization_id', organizationId)
    .eq('auth_user_id', userId);

  return (data || []).map((row) => row.id as string).filter(Boolean);
}

async function resolveAssignedFilterIdentity(
  supabase: SupabaseClient,
  organizationId: string | null | undefined,
  filterId: string
): Promise<{ userId: string | null; workerIds: string[] }> {
  const asUserWorkerIds = await workerIdsForUser(supabase, organizationId, filterId);
  if (asUserWorkerIds.length) {
    return { userId: filterId, workerIds: asUserWorkerIds };
  }

  if (!organizationId) {
    return { userId: filterId, workerIds: [filterId] };
  }

  const { data } = await supabase
    .from('workers')
    .select('id, auth_user_id')
    .eq('organization_id', organizationId)
    .eq('id', filterId)
    .maybeSingle();

  if (data?.id) {
    return {
      userId: (data.auth_user_id as string | null) || null,
      workerIds: [data.id as string]
    };
  }

  return { userId: filterId, workerIds: [filterId] };
}

function assignedToClause(userId: string, workerIds: string[]): string {
  const ids = Array.from(new Set([userId, ...workerIds].filter(Boolean)));
  return ids.map((id) => `assigned_to.eq.${id}`).join(',');
}

function scopedAssignedToClause(organizationId: string, userId: string, workerIds: string[]): string {
  const clause = assignedToClause(userId, workerIds);
  return clause.includes(',')
    ? `and(organization_id.eq.${organizationId},or(${clause}))`
    : `and(organization_id.eq.${organizationId},${clause})`;
}

export async function countOrganizationJobs(
  supabase: SupabaseClient,
  organizationId: string,
  options?: { sinceIso?: string; status?: string; excludeStatuses?: string[] }
): Promise<{ count: number; error: string | null }> {
  let query = supabase
    .from('jobs')
    .select('id', { count: 'exact', head: true })
    .eq('organization_id', organizationId);

  if (options?.sinceIso) query = query.gte('created_at', options.sinceIso);
  if (options?.status) query = query.eq('status', options.status);
  for (const status of options?.excludeStatuses || []) query = query.neq('status', status);

  const { count, error } = await query;
  if (error) return { count: 0, error: error.message };
  return { count: count || 0, error: null };
}

export async function listWorkspaceJobs(
  supabase: SupabaseClient,
  userId: string,
  organizationId: string | null | undefined,
  role: UserRole | string | null | undefined,
  filters?: JobListFilters
): Promise<{ jobs: JobListRow[]; error: string | null }> {
  let query = supabase.from('jobs').select(JOB_LIST_COLUMNS).order('created_at', { ascending: false });

  const managerView = role === undefined || role === null || isManagerRole(normalizeRole(role));
  const currentUserWorkerIds = await workerIdsForUser(supabase, organizationId, userId);
  if (organizationId) {
    if (managerView) {
      query = query.or(`organization_id.eq.${organizationId},and(organization_id.is.null,user_id.eq.${userId})`);
    } else {
      const { data: assignmentRows } = currentUserWorkerIds.length
        ? await supabase.from('job_assignments').select('job_id').in('worker_id', currentUserWorkerIds)
        : { data: [] as Array<{ job_id: string }> };
      const assignedJobIds = Array.from(new Set((assignmentRows || []).map((row) => row.job_id as string).filter(Boolean)));
      const clauses = [
        `and(organization_id.eq.${organizationId},user_id.eq.${userId})`,
        scopedAssignedToClause(organizationId, userId, currentUserWorkerIds),
        `and(organization_id.is.null,user_id.eq.${userId})`
      ];
      if (assignedJobIds.length) clauses.push(`and(organization_id.eq.${organizationId},id.in.(${assignedJobIds.join(',')}))`);
      query = query.or(clauses.join(','));
    }
  } else {
    query = query.eq('user_id', userId);
  }

  if (filters?.customerId) query = query.eq('customer_id', filters.customerId);
  if (filters?.status && !['active', 'overdue', 'completed'].includes(filters.status)) query = query.eq('status', filters.status);
  if (filters?.completedSince && filters?.status === 'completed') query = query.gte('completed_at', filters.completedSince);
  if (filters?.assignedTo) {
    const identity = await resolveAssignedFilterIdentity(supabase, organizationId, filters.assignedTo);
    const aliasIds = Array.from(new Set([identity.userId, ...identity.workerIds, filters.assignedTo].filter(Boolean) as string[]));
    const filterWorkerIds = identity.workerIds;
    if (organizationId && (filterWorkerIds.length || aliasIds.length > 1)) {
      const { data: assignmentRows } = filterWorkerIds.length
        ? await supabase.from('job_assignments').select('job_id').in('worker_id', filterWorkerIds)
        : { data: [] as Array<{ job_id: string }> };
      const assignedJobIds = Array.from(new Set((assignmentRows || []).map((row) => row.job_id as string).filter(Boolean)));
      const clauses = [assignedToClause(aliasIds[0], aliasIds.slice(1))];
      if (assignedJobIds.length) clauses.push(`id.in.(${assignedJobIds.join(',')})`);
      query = query.or(clauses.join(','));
    } else {
      query = query.eq('assigned_to', filters.assignedTo);
    }
  }
  if (filters?.createdFrom) query = query.gte('created_at', `${filters.createdFrom}T00:00:00`);

  const { data, error } = await query;
  if (error) return { jobs: [], error: error.message };

  let rows = filterJobsByStatus((data || []) as JobListRow[], filters?.status);
  if (filters?.unassignedOnly) {
    rows = rows.filter((job) => job.status !== 'completed' && job.status !== 'cancelled' && !job.assigned_to && !job.assigned_email);
  }
  if (filters?.missingCompletionDateOnly) {
    rows = rows.filter((job) => String(job.status || '').toLowerCase() === 'completed' && !String(job.completed_at || '').trim());
  }

  return { jobs: rows, error: null };
}

export function resolveWorkspaceRole(
  membershipRole?: string | null,
  profileRole?: string | null
): UserRole {
  return normalizeRole(membershipRole || profileRole || 'owner');
}
