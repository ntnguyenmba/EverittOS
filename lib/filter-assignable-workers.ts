import { isAssignableJobWorkerRole } from '@/lib/roles';

export function isAssignableWorkerRecord(row: {
  worker_type?: string | null;
  auth_user_id?: string | null;
}, clientUserIds: Set<string>) {
  const type = String(row.worker_type || '').toLowerCase();
  if (type === 'client' || type === 'customer') return false;
  const authId = String(row.auth_user_id || '');
  if (authId && clientUserIds.has(authId)) return false;
  return true;
}

export function clientUserIdSet(members: Array<{ user_id?: string | null; role?: string | null }>) {
  return new Set(
    members
      .filter((member) => !isAssignableJobWorkerRole(member.role))
      .map((member) => String(member.user_id || ''))
      .filter(Boolean)
  );
}
