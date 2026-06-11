/** Canonical SaaS roles (stored on organization_members and profiles). */
export type UserRole = 'owner' | 'admin' | 'manager' | 'employee' | 'contractor' | 'client' | 'viewer';

export function normalizeRole(value: string | null | undefined): UserRole {
  const role = (value || 'owner').toLowerCase();
  if (role === 'owner') return 'owner';
  if (role === 'admin') return 'admin';
  if (role === 'manager') return 'manager';
  if (role === 'employee' || role === 'staff') return 'employee';
  if (role === 'contractor' || role === 'crew_lead') return 'contractor';
  if (role === 'client') return 'client';
  if (role === 'viewer') return 'viewer';
  return 'owner';
}

/** DB role string for inserts */
export function roleToDb(role: UserRole): string {
  return role;
}

export function isOwner(role: UserRole): boolean {
  return role === 'owner';
}

export function isAdminRole(role: UserRole): boolean {
  return role === 'owner' || role === 'admin';
}

export function isManagerRole(role: UserRole): boolean {
  return role === 'owner' || role === 'admin' || role === 'manager';
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

export function isViewerRole(role: UserRole): boolean {
  return role === 'viewer';
}

export function isOwnerOrAdmin(role: UserRole): boolean {
  return isAdminRole(role) || role === 'manager';
}

export function isStaffRole(role: UserRole): boolean {
  return role === 'employee' || role === 'contractor' || role === 'viewer';
}

export function canManageTeam(role: UserRole): boolean {
  return role === 'owner' || role === 'admin';
}

export function canViewTeam(role: UserRole): boolean {
  return role === 'owner' || role === 'admin' || role === 'manager';
}

export function canAssignJobs(role: UserRole): boolean {
  return isManagerRole(role);
}

export function canManageBilling(role: UserRole): boolean {
  return role === 'owner' || role === 'admin';
}

export function canManageOrganizationSettings(role: UserRole): boolean {
  return role === 'owner' || role === 'admin';
}

export function canViewInternalNotes(role: UserRole): boolean {
  return isManagerRole(role) || role === 'employee';
}

export function dashboardVariant(role: UserRole): 'owner' | 'manager' | 'employee' | 'contractor' | 'client' {
  if (role === 'admin') return 'manager';
  if (role === 'viewer') return 'employee';
  return role;
}
