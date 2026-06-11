import { safeNextPath } from '@/lib/app-url';
import { defaultPathForRole } from '@/lib/role-routes';

export const DEFAULT_DASHBOARD_PATH = '/dashboard';

/** Authenticated landing path for the member's dashboard (role-aware). */
export function dashboardPathForRole(role: string | null | undefined): string {
  return defaultPathForRole(role, DEFAULT_DASHBOARD_PATH);
}

/** Sign-in URL that returns to the role-appropriate dashboard after login. */
export function loginUrlWithDashboardNext(role?: string | null): string {
  const destination = dashboardPathForRole(role);
  return `/login?next=${encodeURIComponent(safeNextPath(destination))}`;
}
