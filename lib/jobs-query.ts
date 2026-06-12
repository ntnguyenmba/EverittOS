/** List jobs for the active workspace, including legacy rows missing organization_id. */
export function scopeJobsForWorkspace<T extends { or: (filters: string) => T; eq: (column: string, value: string) => T }>(
  query: T,
  userId: string,
  organizationId?: string | null
): T {
  if (organizationId) {
    return query.or(`organization_id.eq.${organizationId},and(organization_id.is.null,user_id.eq.${userId})`);
  }
  return query.eq('user_id', userId);
}
