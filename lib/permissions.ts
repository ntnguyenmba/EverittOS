import type { UserRole } from '@/lib/roles';
import { isClientRole, isContractorRole, isManagerRole, normalizeRole } from '@/lib/roles';

export type Permission =
  | 'view_assigned_tasks'
  | 'view_assigned_jobs'
  | 'upload_before_photos'
  | 'upload_after_photos'
  | 'add_notes'
  | 'update_status'
  | 'view_schedules'
  | 'view_assigned_customers'
  | 'view_assigned_projects'
  | 'manage_team'
  | 'manage_billing'
  | 'view_all_org_data';

const ROLE_PERMISSIONS: Record<UserRole, Permission[]> = {
  owner: [
    'view_assigned_tasks',
    'view_assigned_jobs',
    'upload_before_photos',
    'upload_after_photos',
    'add_notes',
    'update_status',
    'view_schedules',
    'view_assigned_customers',
    'view_assigned_projects',
    'manage_team',
    'manage_billing',
    'view_all_org_data'
  ],
  admin: [
    'view_assigned_tasks',
    'view_assigned_jobs',
    'upload_before_photos',
    'upload_after_photos',
    'add_notes',
    'update_status',
    'view_schedules',
    'view_assigned_customers',
    'view_assigned_projects',
    'manage_team',
    'view_all_org_data'
  ],
  manager: [
    'view_assigned_tasks',
    'view_assigned_jobs',
    'upload_before_photos',
    'upload_after_photos',
    'add_notes',
    'update_status',
    'view_schedules',
    'view_assigned_customers',
    'view_assigned_projects',
    'manage_team',
    'view_all_org_data'
  ],
  employee: [
    'view_assigned_tasks',
    'view_assigned_jobs',
    'upload_before_photos',
    'upload_after_photos',
    'add_notes',
    'update_status',
    'view_schedules',
    'view_assigned_customers',
    'view_assigned_projects'
  ],
  contractor: [
    'view_assigned_tasks',
    'view_assigned_jobs',
    'upload_before_photos',
    'upload_after_photos',
    'add_notes',
    'update_status',
    'view_schedules'
  ],
  viewer: [
    'view_assigned_tasks',
    'view_assigned_jobs',
    'view_schedules',
    'view_assigned_customers',
    'view_assigned_projects'
  ],
  client: ['view_assigned_jobs', 'view_assigned_projects']
};

export function permissionsForRole(roleInput: string | null | undefined): Permission[] {
  const role = normalizeRole(roleInput);
  return ROLE_PERMISSIONS[role] || ROLE_PERMISSIONS.owner;
}

export function hasPermission(roleInput: string | null | undefined, permission: Permission): boolean {
  return permissionsForRole(roleInput).includes(permission);
}

/** Contractors and viewers must not browse unrelated org records in the UI. */
export function requiresAssignmentScope(roleInput: string | null | undefined): boolean {
  const role = normalizeRole(roleInput);
  return isContractorRole(role) || role === 'viewer';
}

export function canSeeOrgWideData(roleInput: string | null | undefined): boolean {
  const role = normalizeRole(roleInput);
  if (isClientRole(role)) return false;
  return hasPermission(role, 'view_all_org_data');
}

export const PERMISSION_LABELS: Record<Permission, string> = {
  view_assigned_tasks: 'View assigned tasks',
  view_assigned_jobs: 'View assigned jobs',
  upload_before_photos: 'Upload before photos',
  upload_after_photos: 'Upload after photos',
  add_notes: 'Add notes',
  update_status: 'Update status',
  view_schedules: 'View schedules',
  view_assigned_customers: 'View assigned customers only',
  view_assigned_projects: 'View assigned projects only',
  manage_team: 'Manage team',
  manage_billing: 'Manage billing',
  view_all_org_data: 'View all organization data'
};
