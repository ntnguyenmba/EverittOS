import { normalizeRole, type UserRole } from '@/lib/roles';

/** Roles that may be assigned via team management APIs (never includes owner). */
export const ASSIGNABLE_MEMBER_ROLES: UserRole[] = [
  'admin',
  'manager',
  'employee',
  'contractor',
  'client',
  'viewer'
];

const ASSIGNABLE_SET = new Set<string>(ASSIGNABLE_MEMBER_ROLES);

/**
 * Parse a role from user/API input. Returns null for owner, unknown, or empty values.
 * Owner promotion must use transfer-ownership only.
 */
export function parseAssignableMemberRole(value: string | null | undefined): UserRole | null {
  if (!value?.trim()) return null;
  const role = normalizeRole(value);
  if (role === 'owner') return null;
  return ASSIGNABLE_SET.has(role) ? role : null;
}
