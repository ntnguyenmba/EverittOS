import { isManagerRole, normalizeRole, type UserRole } from '@/lib/roles';

/** Scope customer queries to the current workspace. Managers see all org customers. */
export function scopeCustomersForWorkspace<T extends { eq: (column: string, value: string) => T }>(
  query: T,
  userId: string,
  organizationId?: string | null,
  role?: UserRole | string | null
): T {
  const managerView = role === undefined || role === null || isManagerRole(normalizeRole(role));

  if (organizationId) {
    if (managerView) {
      return query.eq('organization_id', organizationId);
    }
    return query.eq('organization_id', organizationId).eq('user_id', userId);
  }

  return query.eq('user_id', userId);
}

/** Scope lead queries (same table pattern as customers in many workspaces). */
export function scopeLeadsForWorkspace<T extends { eq: (column: string, value: string) => T }>(
  query: T,
  userId: string,
  organizationId?: string | null,
  role?: UserRole | string | null
): T {
  return scopeCustomersForWorkspace(query, userId, organizationId, role);
}
