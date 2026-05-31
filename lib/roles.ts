export type UserRole = 'owner' | 'admin' | 'contractor' | 'staff' | 'client';

export function normalizeRole(value: string | null | undefined): UserRole {
  const role = (value || 'owner').toLowerCase();
  if (role === 'admin') return 'admin';
  if (role === 'contractor') return 'contractor';
  if (role === 'staff') return 'staff';
  if (role === 'client') return 'client';
  return 'owner';
}

export function isOwnerOrAdmin(role: UserRole): boolean {
  return role === 'owner' || role === 'admin';
}

export function isStaffRole(role: UserRole): boolean {
  return role === 'contractor' || role === 'staff';
}

export function isClientRole(role: UserRole): boolean {
  return role === 'client';
}
