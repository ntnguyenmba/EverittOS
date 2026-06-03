export type UserRole = 'owner' | 'admin' | 'manager' | 'crew_lead' | 'staff' | 'client';

export function normalizeRole(value: string | null | undefined): UserRole {
  const role = (value || 'owner').toLowerCase();
  if (role === 'admin') return 'admin';
  if (role === 'manager') return 'manager';
  if (role === 'crew_lead' || role === 'contractor') return 'crew_lead';
  if (role === 'staff') return 'staff';
  if (role === 'client') return 'client';
  return 'owner';
}

export function isOwnerOrAdmin(role: UserRole): boolean {
  return role === 'owner' || role === 'admin';
}

export function isManagerRole(role: UserRole): boolean {
  return role === 'manager' || isOwnerOrAdmin(role);
}

export function isCrewLeadRole(role: UserRole): boolean {
  return role === 'crew_lead' || isManagerRole(role);
}

export function isStaffRole(role: UserRole): boolean {
  return role === 'staff' || role === 'crew_lead';
}

export function isClientRole(role: UserRole): boolean {
  return role === 'client';
}

export function canManageTeam(role: UserRole): boolean {
  return isOwnerOrAdmin(role) || role === 'manager';
}

export function canAssignJobs(role: UserRole): boolean {
  return isManagerRole(role);
}

export function dashboardVariant(role: UserRole): 'owner' | 'admin' | 'manager' | 'crew' {
  if (role === 'owner') return 'owner';
  if (role === 'admin') return 'admin';
  if (role === 'manager') return 'manager';
  return 'crew';
}
