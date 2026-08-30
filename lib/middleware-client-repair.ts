import { isClientRole, normalizeRole, type UserRole } from '@/lib/roles';

type SupabaseLike = {
  rpc(name: string, args: Record<string, unknown>): PromiseLike<{ data?: unknown }>;
};

export type MiddlewareClientRepairResult = {
  role: UserRole;
  repaired: boolean;
  redirectToClientJobs: boolean;
};

export function shouldAttemptMiddlewareClientRepair(role: UserRole, pathname: string) {
  return (
    isClientRole(role) ||
    pathname.startsWith('/portal/client') ||
    pathname === '/dashboard' ||
    pathname.startsWith('/settings/billing') ||
    pathname === '/billing' ||
    pathname.startsWith('/pricing')
  );
}

export async function resolveMiddlewareClientRepair(
  supabase: SupabaseLike,
  userId: string,
  role: UserRole,
  pathname: string
): Promise<MiddlewareClientRepairResult> {
  if ((role !== 'owner' && !isClientRole(role)) || !shouldAttemptMiddlewareClientRepair(role, pathname)) {
    return { role, repaired: false, redirectToClientJobs: false };
  }

  try {
    const { data: repairResult } = await supabase.rpc('repair_client_portal_access_for_user', {
      p_user_id: userId
    });
    const repairedRole =
      repairResult && typeof repairResult === 'object'
        ? normalizeRole((repairResult as { role?: string }).role)
        : role;
    const repaired = Boolean(
      repairResult &&
        typeof repairResult === 'object' &&
        (repairResult as { ok?: boolean }).ok &&
        !(repairResult as { skipped?: boolean }).skipped
    );
    const nextRole = repaired ? repairedRole : role;
    const redirectToClientJobs = Boolean(
      isClientRole(nextRole) &&
        repaired &&
        (pathname.startsWith('/settings/billing') ||
          pathname === '/billing' ||
          pathname.startsWith('/pricing') ||
          pathname === '/dashboard')
    );
    return { role: nextRole, repaired, redirectToClientJobs };
  } catch {
    return { role, repaired: false, redirectToClientJobs: false };
  }
}
