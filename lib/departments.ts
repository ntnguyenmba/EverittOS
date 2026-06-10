import type { SupabaseClient } from '@supabase/supabase-js';
import { isClientRole, isManagerRole, normalizeRole, type UserRole } from '@/lib/roles';
import { limitsForPlan } from '@/lib/everittos-limits';
import type { EverittosPlan } from '@/lib/everittos-plans';

export async function getUserDepartmentIds(
  supabase: SupabaseClient,
  userId: string,
  organizationId: string
): Promise<string[]> {
  const { data } = await supabase
    .from('department_memberships')
    .select('department_id')
    .eq('organization_id', organizationId)
    .eq('user_id', userId);

  return (data || []).map((row) => row.department_id as string);
}

/** Returns null when user can see all departments in the org. */
export async function departmentFilterForUser(
  supabase: SupabaseClient,
  userId: string,
  organizationId: string,
  role: UserRole,
  plan: EverittosPlan
): Promise<string[] | null> {
  if (!limitsForPlan(plan).multiLocation) {
    return null;
  }

  if (isClientRole(role)) {
    return [];
  }

  if (role === 'owner' || role === 'manager') {
    return null;
  }

  return getUserDepartmentIds(supabase, userId, organizationId);
}

export function canManageDepartments(role: UserRole, plan: EverittosPlan): boolean {
  return isManagerRole(role) && limitsForPlan(plan).multiLocation;
}

export function normalizeDepartmentRole(role: string | null | undefined): UserRole {
  return normalizeRole(role);
}
