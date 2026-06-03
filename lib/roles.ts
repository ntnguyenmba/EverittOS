/** Canonical SaaS roles (stored on organization_members and profiles). */
export type UserRole = 'owner' | 'manager' | 'employee' | 'contractor' | 'client';

export function normalizeRole(value: string | null | undefined): UserRole {
  const role = (value || 'owner').toLowerCase();
  if (role === 'owner') return 'owner';
  if (role === 'manager' || role === 'admin') return 'manager';
  if (role === 'employee' || role === 'staff') return 'employee';
  if (role === 'contractor' || role === 'crew_lead') return 'contractor';
  if (role === 'client') return 'client';
  return 'owner';
}

/** DB role string for inserts */
export function roleToDb(role: UserRole): string {
  return role;
}

export function isOwner(role: UserRole): boolean {
  return role === 'owner';
}

export function isManagerRole(role: UserRole): boolean {
  return role === 'owner' || role === 'manager';
}

export function isEmployeeRole(role: UserRole): boolean {
  return role === 'employee';
}

export function isContractorRole(role: UserRole): boolean {
  return role === 'contractor';
}

export function isClientRole(role: UserRole): boolean {
  return role === 'client';
}

export function isOwnerOrAdmin(role: UserRole): boolean {
  return isManagerRole(role);
}

export function isStaffRole(role: UserRole): boolean {
  return role === 'employee' || role === 'contractor';
}

export function canManageTeam(role: UserRole): boolean {
  return isManagerRole(role);
}

export function canAssignJobs(role: UserRole): boolean {
  return isManagerRole(role);
}

export function canManageBilling(role: UserRole): boolean {
  return role === 'owner';
}

export function canViewInternalNotes(role: UserRole): boolean {
  return isManagerRole(role) || role === 'employee';
}

export function dashboardVariant(role: UserRole): 'owner' | 'manager' | 'employee' | 'contractor' | 'client' {
  return role;
}
