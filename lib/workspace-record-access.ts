import { isManagerRole, normalizeRole, type UserRole } from '@/lib/roles';

type OrgScopedRecord = {
  organization_id?: string | null;
  user_id?: string | null;
};

/** Whether the current user may view a workspace record scoped by organization or creator. */
export function canAccessWorkspaceRecord(
  record: OrgScopedRecord,
  userId: string,
  organizationId?: string | null,
  role?: UserRole | string | null,
  assignedToUserId?: string | null
): boolean {
  const managerView = isManagerRole(normalizeRole(role || 'owner'));

  if (organizationId) {
    if (record.organization_id === organizationId) {
      if (managerView) return true;
      if (record.user_id === userId) return true;
      if (assignedToUserId === userId) return true;
      return false;
    }
    if (!record.organization_id && record.user_id === userId) return true;
    return false;
  }

  return record.user_id === userId;
}
