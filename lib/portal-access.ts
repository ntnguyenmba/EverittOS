import { isClientRole, isContractorRole, normalizeRole, type UserRole } from '@/lib/roles';

/** Personal settings paths portal roles may access (no org billing/integrations). */
export const PORTAL_PERSONAL_SETTINGS_PATHS = [
  '/settings/account',
  '/settings/security',
  '/settings/notifications',
  '/settings/privacy'
] as const;

export const CONTRACTOR_PORTAL_HOME = '/portal/contractor';
export const CLIENT_PORTAL_HOME = '/portal/client';
export const CONTRACTOR_PORTAL_SETTINGS = '/portal/contractor/settings';
export const CLIENT_PORTAL_SETTINGS = '/portal/client/settings';

function pathOnly(pathname: string): string {
  return pathname.split('?')[0].split('#')[0];
}

function pathMatchesPrefix(path: string, prefix: string): boolean {
  return path === prefix || path.startsWith(`${prefix}/`);
}

export function isPortalPersonalSettingsPath(pathname: string): boolean {
  const path = pathOnly(pathname);
  return PORTAL_PERSONAL_SETTINGS_PATHS.some((allowed) => pathMatchesPrefix(path, allowed));
}

/** Public legal pages reachable without role escalation. */
export function isPublicLegalPath(pathname: string): boolean {
  const path = pathOnly(pathname);
  return (
    path === '/privacy' ||
    path === '/terms' ||
    path === '/cookies' ||
    path === '/disclaimer' ||
    path.startsWith('/disclaimer/') ||
    path === '/security' ||
    path === '/refund-policy'
  );
}

export function isTeamInviteAcceptPath(pathname: string): boolean {
  const path = pathOnly(pathname);
  return path === '/team/accept' || path.startsWith('/team/accept/');
}

/**
 * Paths a contractor may open without being bounced back to the portal home.
 * Job detail pages enforce assignment/shared access themselves.
 */
export function isContractorAllowedPath(pathname: string): boolean {
  const path = pathOnly(pathname);
  if (pathMatchesPrefix(path, CONTRACTOR_PORTAL_HOME)) return true;
  if (isPortalPersonalSettingsPath(path)) return true;
  if (path.startsWith('/jobs/')) return true;
  if (isTeamInviteAcceptPath(path)) return true;
  if (isPublicLegalPath(path)) return true;
  return false;
}

/** Paths a client/customer may open without being bounced back to the portal home. */
export function isClientAllowedPath(pathname: string): boolean {
  const path = pathOnly(pathname);
  if (pathMatchesPrefix(path, CLIENT_PORTAL_HOME)) return true;
  if (isPortalPersonalSettingsPath(path)) return true;
  if (path.startsWith('/report/')) return true;
  if (isTeamInviteAcceptPath(path)) return true;
  if (isPublicLegalPath(path)) return true;
  return false;
}

/** Landing path for a client after invite accept or login with shared jobs. */
export function clientPortalJobsPath(jobId?: string | null): string {
  if (jobId) return `${CLIENT_PORTAL_HOME}/jobs/${jobId}`;
  return `${CLIENT_PORTAL_HOME}/jobs`;
}

/**
 * Where to send a user after accepting a workspace invitation.
 * Clients/contractors never land on billing, pricing, or owner onboarding.
 */
export function inviteAcceptLandingPath(
  roleInput: string | null | undefined,
  options?: { jobId?: string | null; sharedJobIds?: string[] | null }
): string {
  const role = normalizeRole(roleInput);
  const jobId = options?.jobId || null;
  const sharedJobIds = (options?.sharedJobIds || []).filter(Boolean);

  if (isClientRole(role)) {
    if (jobId) return clientPortalJobsPath(jobId);
    if (sharedJobIds.length === 1) return clientPortalJobsPath(sharedJobIds[0]);
    return clientPortalJobsPath();
  }

  if (isContractorRole(role)) {
    return CONTRACTOR_PORTAL_HOME;
  }

  return '/dashboard';
}

export function portalHomeForRole(roleInput: string | null | undefined): string | null {
  const role = normalizeRole(roleInput);
  if (isClientRole(role)) return CLIENT_PORTAL_HOME;
  if (isContractorRole(role)) return CONTRACTOR_PORTAL_HOME;
  return null;
}

export function isPortalRole(roleInput: string | null | undefined): boolean {
  const role = normalizeRole(roleInput);
  return isClientRole(role) || isContractorRole(role);
}

/** Operational modules managers may use day-to-day (not billing/admin). */
export function isManagerOperationalPath(pathname: string): boolean {
  const path = pathOnly(pathname);
  const operational = [
    '/dashboard',
    '/jobs',
    '/schedule',
    '/customers',
    '/leads',
    '/photos',
    '/reports',
    '/services',
    '/bookings',
    '/forms',
    '/templates',
    '/reviews',
    '/projects',
    '/inventory',
    '/routes',
    '/workflows',
    '/notifications',
    '/people',
    '/team',
    '/knowledge',
    '/settings/people',
    '/settings/team',
    '/settings/account',
    '/settings/security',
    '/settings/notifications',
    '/settings/privacy'
  ];
  return operational.some((prefix) => pathMatchesPrefix(path, prefix));
}

/** Financial modules that require org-wide or explicit finance permission. */
export function isFinancialOrgPath(pathname: string): boolean {
  const path = pathOnly(pathname);
  return (
    path === '/invoices' ||
    path.startsWith('/invoices/') ||
    path === '/expenses' ||
    path.startsWith('/expenses/') ||
    path === '/analytics' ||
    path.startsWith('/analytics/') ||
    path === '/contractor-pay' ||
    path.startsWith('/contractor-pay/')
  );
}

export function settingsHomeForRole(role: UserRole): string {
  if (isContractorRole(role)) return CONTRACTOR_PORTAL_SETTINGS;
  if (isClientRole(role)) return CLIENT_PORTAL_SETTINGS;
  return '/settings/account';
}
