import { isManagerRole, normalizeRole, type UserRole } from '@/lib/roles';

/** List jobs for the active workspace, including legacy rows missing organization_id. */
export function scopeJobsForWorkspace<T extends { or: (filters: string) => T; eq: (column: string, value: string) => T }>(
  query: T,
  userId: string,
  organizationId?: string | null,
  role?: UserRole | string | null
): T {
  const normalizedRole = normalizeRole(role);
  const managerView = isManagerRole(normalizedRole);

  if (organizationId) {
    if (managerView) {
      return query.or(`organization_id.eq.${organizationId},and(organization_id.is.null,user_id.eq.${userId})`);
    }
    return query.or(
      `and(organization_id.eq.${organizationId},user_id.eq.${userId}),and(organization_id.eq.${organizationId},assigned_to.eq.${userId}),and(organization_id.is.null,user_id.eq.${userId})`
    );
  }
  return query.eq('user_id', userId);
}
