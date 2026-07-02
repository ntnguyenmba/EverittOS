import type { SupabaseClient } from '@supabase/supabase-js';
import { isManagerRole, normalizeRole, type UserRole } from '@/lib/roles';

export const JOB_LIST_COLUMNS =
  'id, title, customer_name, customer_id, address, status, completed_at, assigned_to, organization_id, user_id, created_at';

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
};

export type JobListFilters = {
  customerId?: string | null;
  status?: string | null;
  completedSince?: string | null;
  unassignedOnly?: boolean;
};

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
  if (filters?.status) {
    query = query.eq('status', filters.status);
  }
  if (filters?.completedSince && filters?.status === 'completed') {
    query = query.gte('completed_at', filters.completedSince);
  }

  const { data, error } = await query;
  if (error) {
    return { jobs: [], error: error.message };
  }

  let rows = (data || []) as JobListRow[];
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
