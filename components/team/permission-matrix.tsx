'use client';

import type { UserRole } from '@/lib/roles';
import { PERMISSION_LABELS, permissionsForRole, type Permission } from '@/lib/permissions';

const MATRIX_ROLES: { key: UserRole; label: string }[] = [
  { key: 'owner', label: 'Owner' },
  { key: 'admin', label: 'Admin' },
  { key: 'manager', label: 'Manager' },
  { key: 'contractor', label: 'Technician' },
  { key: 'client', label: 'Client' }
];

const MATRIX_PERMISSIONS: Permission[] = [
  'view_all_org_data',
  'manage_team',
  'manage_billing',
  'view_team',
  'view_schedules',
  'view_assigned_jobs',
  'upload_after_photos',
  'update_status'
];

export function PermissionMatrix() {
  return (
    <div className="permission-matrix-wrap">
      <table className="data-table permission-matrix">
        <thead>
          <tr>
            <th scope="col">Permission</th>
            {MATRIX_ROLES.map((role) => (
              <th key={role.key} scope="col">
                {role.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {MATRIX_PERMISSIONS.map((perm) => (
            <tr key={perm}>
              <td>{PERMISSION_LABELS[perm]}</td>
              {MATRIX_ROLES.map((role) => {
                const allowed = permissionsForRole(role.key).includes(perm);
                return (
                  <td key={role.key} className={allowed ? 'perm-yes' : 'perm-no'} aria-label={allowed ? 'Allowed' : 'Not allowed'}>
                    {allowed ? 'Yes' : 'No'}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
