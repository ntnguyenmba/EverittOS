import { isClientRole, isContractorRole, normalizeRole, type UserRole } from '@/lib/roles';
import { safeNextPath } from '@/lib/app-url';

/** Default landing path after sign-in based on member role. */
export function defaultPathForRole(roleInput: string | null | undefined, next?: string | null): string {
  const nextPath = safeNextPath(next);
  const role = normalizeRole(roleInput);

  if (isClientRole(role)) {
    if (nextPath.startsWith('/portal/client')) return nextPath;
    return '/portal/client';
  }

  if (isContractorRole(role)) {
    if (nextPath.startsWith('/portal/contractor')) return nextPath;
    if (nextPath === '/dashboard') return '/portal/contractor';
  }

  return nextPath;
}

export function roleDisplayName(role: UserRole): string {
  switch (role) {
    case 'owner':
      return 'Owner';
    case 'admin':
      return 'Admin';
    case 'manager':
      return 'Manager';
    case 'employee':
      return 'Employee';
    case 'contractor':
      return 'Technician';
    case 'client':
      return 'Client';
    case 'viewer':
      return 'Viewer';
    default:
      return 'Member';
  }
}
