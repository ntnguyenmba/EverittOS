import type { SupabaseClient } from '@supabase/supabase-js';
import { isManagerRole, normalizeRole, type UserRole } from '@/lib/roles';

export const JOB_LIST_COLUMNS =
  'id, title, customer_name, customer_id, address, status, completed_at, assigned_to, organization_id, user_id, created_at, due_date, scheduled_start';

export type JobListRow = {
  id: string;
  title: string;
  customer_name: string | null;
  customer_id: string | null;
  address: string | null;
  status: string | null;
  completed_at?: string | null;
  assigned_to?: string | null;
  organization_id?: string | null;
  user_id?: string | null;
  created_at?: string | null;
  due_date?: string | null;
  scheduled_start?: string | null;
};

export type JobListFilters = {
  customerId?: string | null;
  status?: string | null;
  completedSince?: string | null;
  unassignedOnly?: boolean;
  assignedTo?: string | null;
  createdFrom?: string | null;
};

export function filterJobsByStatus<T extends JobListRow>(
  rows: T[],
  status: string | null | undefined,
  today = todayIso()
): T[] {
  if (!status) return rows;

  if (status === 'active') {
    return rows.filter((job) => isActiveJobStatus(job.status));
  }
  if (status === 'overdue') {
    return rows.filter((job) => {
      if (!isActiveJobStatus(job.status)) return false;
      const effectiveDate = jobEffectiveDate(job);
      return Boolean(effectiveDate && effectiveDate < today);
    });
  }
  if (status === 'completed') {
    return rows.filter((job) => isCompletedJobStatus(job.status));
  }

  return rows.filter((job) => (job.status || '').toLowerCase() === status.toLowerCase());
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function jobEffectiveDate(job: Pick<JobListRow, 'due_date' | 'scheduled_start'> & { due_date?: string | null; scheduled_start?: string | null }): string | null {
  const due = (job as { due_date?: string | null }).due_date;
  const scheduled = (job as { scheduled_start?: string | null }).scheduled_start;
  if (due) return due.slice(0, 10);
  if (scheduled) return scheduled.slice(0, 10);
  return null;
}

function isActiveJobStatus(status: string | null | undefined): boolean {
  const normalized = (status || '').toLowerCase();
  return !['completed', 'done', 'complete', 'closed', 'cancelled', 'canceled'].includes(normalized);
}

function isCompletedJobStatus(status: string | null | undefined): boolean {
  const normalized = (status || '').toLowerCase();
  return ['completed', 'done', 'complete', 'closed'].includes(normalized);
}

/** Count jobs for an organization (source of truth for analytics dashboards). */
export async function countOrganizationJobs(
  supabase: SupabaseClient,
  organizationId: string,
  options?: { sinceIso?: string; status?: string }
): Promise<{ count: number; error: string | null }> {
  let query = supabase
    .from('jobs')
    .select('id', { count: 'exact', head: true })
    .eq('organization_id', organizationId);

  if (options?.sinceIso) {
    query = query.gte('created_at', options.sinceIso);
  }
  if (options?.status) {
    query = query.eq('status', options.status);
  }

  const { count, error } = await query;
  if (error) {
    return { count: 0, error: error.message };
  }
  return { count: count || 0, error: null };
}

/** List jobs visible in the current workspace (same filter used by the Jobs page). */
export async function listWorkspaceJobs(
  supabase: SupabaseClient,
  userId: string,
  organizationId: string | null | undefined,
  role: UserRole | string | null | undefined,
  filters?: JobListFilters
): Promise<{ jobs: JobListRow[]; error: string | null }> {
  let query = supabase.from('jobs').select(JOB_LIST_COLUMNS).order('created_at', { ascending: false });

  const managerView = role === undefined || role === null || isManagerRole(normalizeRole(role));
  if (organizationId) {
    if (managerView) {
      query = query.or(`organization_id.eq.${organizationId},and(organization_id.is.null,user_id.eq.${userId})`);
    } else {
      query = query.or(
        `and(organization_id.eq.${organizationId},user_id.eq.${userId}),and(organization_id.eq.${organizationId},assigned_to.eq.${userId}),and(organization_id.is.null,user_id.eq.${userId})`
      );
    }
  } else {
    query = query.eq('user_id', userId);
  }

  if (filters?.customerId) {
    query = query.eq('customer_id', filters.customerId);
  }
  if (filters?.status && !['active', 'overdue', 'completed'].includes(filters.status)) {
    query = query.eq('status', filters.status);
  }
  if (filters?.completedSince && filters?.status === 'completed') {
    query = query.gte('completed_at', filters.completedSince);
  }
  if (filters?.assignedTo) {
    if (organizationId) {
      const { data: workerRows } = await supabase
        .from('workers')
        .select('id')
        .eq('organization_id', organizationId)
        .eq('auth_user_id', filters.assignedTo);
      const workerIds = (workerRows || []).map((row) => row.id as string).filter(Boolean);
      if (workerIds.length) {
        const { data: assignmentRows } = await supabase
          .from('job_assignments')
          .select('job_id')
          .in('worker_id', workerIds);
        const assignedJobIds = Array.from(
          new Set((assignmentRows || []).map((row) => row.job_id as string).filter(Boolean))
        );
        if (assignedJobIds.length) {
          query = query.or(
            `assigned_to.eq.${filters.assignedTo},id.in.(${assignedJobIds.join(',')})`
          );
        } else {
          query = query.eq('assigned_to', filters.assignedTo);
        }
      } else {
        query = query.eq('assigned_to', filters.assignedTo);
      }
    } else {
      query = query.eq('assigned_to', filters.assignedTo);
    }
  }
  if (filters?.createdFrom) {
    query = query.gte('created_at', `${filters.createdFrom}T00:00:00`);
  }

  const { data, error } = await query;
  if (error) {
    return { jobs: [], error: error.message };
  }

  let rows = filterJobsByStatus((data || []) as JobListRow[], filters?.status);
  if (filters?.unassignedOnly) {
    rows = rows.filter(
      (job) => job.status !== 'completed' && job.status !== 'cancelled' && !job.assigned_to
    );
  }

  return { jobs: rows, error: null };
}

export function resolveWorkspaceRole(
  membershipRole?: string | null,
  profileRole?: string | null
): UserRole {
  return normalizeRole(membershipRole || profileRole || 'owner');
}
