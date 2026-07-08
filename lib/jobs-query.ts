import { isManagerRole, normalizeRole, type UserRole } from '@/lib/roles';

/** List jobs for the active workspace, including legacy rows missing organization_id. */
export function scopeJobsForWorkspace<T extends { or: (filters: string) => T; eq: (column: string, value: string) => T }>(
  query: T,
  userId: string,
  organizationId?: string | null,
  role?: UserRole | string | null,
  assignedWorkerIds: string[] = []
): T {
  const managerView = role === undefined || role === null || isManagerRole(normalizeRole(role));

  if (organizationId) {
    if (managerView) {
      return query.or(`organization_id.eq.${organizationId},and(organization_id.is.null,user_id.eq.${userId})`);
    }

    const assignedIds = Array.from(new Set([userId, ...assignedWorkerIds].filter(Boolean)));
    const assignedClause = assignedIds.map((id) => `assigned_to.eq.${id}`).join(',');
    const scopedAssignedClause = assignedClause.includes(',')
      ? `and(organization_id.eq.${organizationId},or(${assignedClause}))`
      : `and(organization_id.eq.${organizationId},${assignedClause})`;

    return query.or(
      `and(organization_id.eq.${organizationId},user_id.eq.${userId}),${scopedAssignedClause},and(organization_id.is.null,user_id.eq.${userId})`
    );
  }
  return query.eq('user_id', userId);
}
