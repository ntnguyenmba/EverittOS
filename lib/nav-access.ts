import { limitsForPlan } from '@/lib/everittos-limits';
import { hasTeamManagement, normalizePlan, planShortBadgeName, type EverittosPlan } from '@/lib/everittos-plans';
import { meetsMinimumPlan, minimumPlanForPath, planRank } from '@/lib/plan-access';
import { canSeeOrgWideData, hasPermission } from '@/lib/permissions';
import type { AppNavHref } from '@/lib/nav-links';
import { APP_NAV_LINKS } from '@/lib/nav-links';
import {
  CLIENT_PORTAL_HOME,
  CLIENT_PORTAL_SETTINGS,
  CONTRACTOR_PORTAL_HOME,
  CONTRACTOR_PORTAL_SETTINGS,
  isPortalPersonalSettingsPath
} from '@/lib/portal-access';
import {
  canManageBilling,
  canManageOrganizationSettings,
  canViewTeam,
  isClientRole,
  isContractorRole,
  isManagerRole,
  type UserRole
} from '@/lib/roles';

export type SettingsNavLink = {
  href: string;
  label: string;
};

export const SETTINGS_NAV_LINKS: SettingsNavLink[] = [
  { href: '/settings/account', label: 'Profile' },
  { href: '/settings', label: 'Organization' },
  { href: '/settings/notifications', label: 'Notifications' },
  { href: '/settings/branding', label: 'Appearance' },
  { href: '/settings/privacy', label: 'Privacy' },
  { href: '/terms', label: 'Terms' },
  { href: '/settings/privacy#delete-account', label: 'Delete Account' },
  { href: '/settings/billing', label: 'Subscription' }
];

const PORTAL_SETTINGS_LINKS: SettingsNavLink[] = [
  { href: '/settings/account', label: 'Profile' },
  { href: '/settings/notifications', label: 'Notifications' },
  { href: '/settings/privacy', label: 'Privacy' }
];

export type NavItemResolution = {
  visible: boolean;
  accessible: boolean;
  requiredPlan?: EverittosPlan;
};

function navPath(href: string): string {
  return href.split('?')[0];
}

function isManagerOperationalModule(path: string): boolean {
  switch (path) {
    case '/customers':
    case '/projects':
    case '/forms':
    case '/templates':
    case '/reviews':
    case '/services':
    case '/bookings':
    case '/leads':
    case '/photos':
    case '/reports':
    case '/inventory':
    case '/routes':
    case '/workflows':
      return true;
    default:
      return false;
  }
}

/** Role-only gate: should this item appear in navigation at all? */
export function canShowNavHref(role: UserRole, href: string): boolean {
  const path = navPath(href);

  if (isClientRole(role)) {
    return (
      path === CLIENT_PORTAL_HOME ||
      path === CLIENT_PORTAL_SETTINGS ||
      path.startsWith(`${CLIENT_PORTAL_HOME}/`) ||
      isPortalPersonalSettingsPath(path)
    );
  }

  if (isContractorRole(role)) {
    return (
      path === CONTRACTOR_PORTAL_HOME ||
      path === CONTRACTOR_PORTAL_SETTINGS ||
      path.startsWith(`${CONTRACTOR_PORTAL_HOME}/`) ||
      path.startsWith('/jobs/') ||
      isPortalPersonalSettingsPath(path)
    );
  }

  switch (path) {
    case '/dashboard':
      return true;
    case '/jobs':
      return hasPermission(role, 'view_assigned_jobs');
    case '/schedule':
      return hasPermission(role, 'view_schedules');
    case '/customers':
    case '/leads':
    case '/reports':
      return canSeeOrgWideData(role) || role === 'manager';
    case '/invoices':
      // Payments — owners/admins only in primary nav.
      return canSeeOrgWideData(role);
    case '/people':
    case '/team':
      return canViewTeam(role);
    case '/settings':
    case '/settings/account':
    case '/settings/notifications':
    case '/settings/privacy':
    case '/settings/branding':
      return canManageOrganizationSettings(role) || role === 'manager' || role === 'employee' || role === 'viewer';
    case '/settings/billing':
      return canManageBilling(role);
    case '/settings/integrations':
      // Integrations is not a primary destination; keep path reachable for redirects only for owners.
      return canManageOrganizationSettings(role);
    case '/notifications':
      return hasPermission(role, 'view_assigned_jobs');
    case '/projects':
    case '/forms':
    case '/templates':
    case '/reviews':
    case '/services':
    case '/bookings':
    case '/photos':
    case '/inventory':
    case '/routes':
    case '/workflows':
      return canSeeOrgWideData(role) || role === 'manager';
    case '/knowledge':
    case '/proposals':
    case '/automations':
    case '/clients':
    case '/workers':
    case '/activity':
    case '/expenses':
      return isManagerRole(role);
    case '/analytics':
      return canSeeOrgWideData(role);
    case '/contractor-pay':
      return isManagerRole(role);
    case '/settings/people':
    case '/settings/team':
      return canViewTeam(role);
    case '/portal/contractor':
    case '/portal/client':
      return false;
    default:
      if (path.startsWith('/jobs/')) return hasPermission(role, 'view_assigned_jobs');
      if (path.startsWith('/portal/contractor/jobs/')) return isContractorRole(role);
      if (path.startsWith('/settings/')) return canAccessSettingsPathByRole(role, path);
      if (isManagerOperationalModule(path)) return canSeeOrgWideData(role) || role === 'manager';
      return canSeeOrgWideData(role) || role === 'manager' || role === 'employee' || role === 'viewer';
  }
}

function canAccessSettingsPathByRole(role: UserRole, path: string): boolean {
  if (isClientRole(role) || isContractorRole(role)) {
    return isPortalPersonalSettingsPath(path);
  }
  if (path.startsWith('/settings/billing')) return canManageBilling(role);
  if (path.startsWith('/settings/ai-usage')) return canManageBilling(role);
  if (path.startsWith('/settings/referrals')) return canManageOrganizationSettings(role);
  if (path.startsWith('/settings/people') || path.startsWith('/settings/team')) return canViewTeam(role);
  if (path.startsWith('/settings/branding')) return canManageOrganizationSettings(role);
  // Integrations page is retired from Settings; owners may still hit redirects.
  if (path.startsWith('/settings/integrations')) return canManageOrganizationSettings(role);
  if (path === '/settings' || path.startsWith('/settings?')) {
    return canManageOrganizationSettings(role);
  }
  if (
    path.startsWith('/settings/account') ||
    path.startsWith('/settings/security') ||
    path.startsWith('/settings/notifications') ||
    path.startsWith('/settings/privacy')
  ) {
    return true;
  }
  if (path.startsWith('/settings/departments')) return canManageOrganizationSettings(role);
  if (path.startsWith('/settings/api')) return canManageOrganizationSettings(role);
  return false;
}

/** Minimum plan tier required for a nav route (null = included on Free). */
export function requiredPlanForNavHref(href: string): EverittosPlan | null {
  const path = navPath(href);
  const fromRouteTable = minimumPlanForPath(path);
  if (fromRouteTable) return fromRouteTable;

  switch (path) {
    case '/workflows':
      return 'growth';
    case '/automations':
      return 'business';
    case '/knowledge':
    case '/proposals':
    case '/bookings':
      return 'pro';
    default:
      return null;
  }
}

/** Plan feature gate beyond route minimums (e.g. Team needs teamManagement flag). */
function planFeatureBlocksNav(href: string, plan: EverittosPlan): EverittosPlan | null {
  const normalized = normalizePlan(plan);
  const path = navPath(href);
  const limits = limitsForPlan(normalized);

  if ((path === '/people' || path === '/team' || path === '/settings/people' || path === '/settings/team') && !hasTeamManagement(normalized)) {
    return 'business';
  }
  if (path === '/workflows' && !limits.workflowCustomization) {
    return 'growth';
  }
  if (path === '/automations' && !limits.aiAccess) {
    return 'business';
  }
  if (path === '/activity' && !limits.activityLog) {
    return 'business';
  }
  if (path === '/bookings' && !limits.bookings) {
    return 'pro';
  }
  if (path === '/portal/client' && !limits.clientPortal) {
    return 'growth';
  }
  if (path === '/portal/contractor' && !limits.contractorPortal) {
    return 'growth';
  }

  return null;
}

export function resolveNavItem(role: UserRole, plan: EverittosPlan, href: string): NavItemResolution {
  if (!canShowNavHref(role, href)) {
    return { visible: false, accessible: false };
  }

  const path = navPath(href);

  // Portal role holders always reach their own portal/settings; plan gates apply to org owners inviting portals.
  if (
    (isClientRole(role) && (path === CLIENT_PORTAL_HOME || path.startsWith(`${CLIENT_PORTAL_HOME}/`) || isPortalPersonalSettingsPath(path))) ||
    (isContractorRole(role) &&
      (path === CONTRACTOR_PORTAL_HOME ||
        path.startsWith(`${CONTRACTOR_PORTAL_HOME}/`) ||
        path.startsWith('/jobs/') ||
        isPortalPersonalSettingsPath(path)))
  ) {
    return { visible: true, accessible: true };
  }

  const normalized = normalizePlan(plan);
  const requiredFromRoute = requiredPlanForNavHref(href);
  const requiredFromFeature = planFeatureBlocksNav(href, normalized);

  let requiredPlan = requiredFromRoute;
  if (requiredFromFeature && (!requiredPlan || planRank(requiredFromFeature) > planRank(requiredPlan))) {
    requiredPlan = requiredFromFeature;
  }

  if (requiredPlan && !meetsMinimumPlan(normalized, requiredPlan)) {
    return { visible: true, accessible: false, requiredPlan };
  }

  return { visible: true, accessible: true };
}

/** Whether a user can use the page (role + plan). Used by middleware-aligned checks. */
export function canAccessNavHref(role: UserRole, href: string, plan: EverittosPlan): boolean {
  return resolveNavItem(role, plan, href).accessible;
}

/** Backward-compatible settings gate used by middleware. */
export function canAccessSettingsPath(role: UserRole, path: string, plan: EverittosPlan): boolean {
  if (!path.startsWith('/settings')) return false;
  return canAccessNavHref(role, path, plan);
}

export function billingUpgradeHref(requiredPlan: EverittosPlan, featureLabel?: string): string {
  const params = new URLSearchParams({ upgrade: requiredPlan, reason: 'plan' });
  if (featureLabel) {
    params.set('detail', `${planShortBadgeName(requiredPlan)} plan required for ${featureLabel}.`);
  }
  return `/settings/billing?${params.toString()}`;
}

/** Active state for sidebar / mobile nav (Settings does not match all /settings/*). */
export function isNavLinkActive(pathname: string, href: string): boolean {
  const path = pathname.split('?')[0];
  const target = navPath(href);

  if (target === '/settings') {
    return path === '/settings';
  }
  if (target === '/dashboard') {
    return path === '/dashboard';
  }
  if (target === '/people' || target === '/team') {
    return (
      path === '/people' ||
      path.startsWith('/people/') ||
      path === '/team' ||
      path.startsWith('/team/') ||
      path === '/workers' ||
      path.startsWith('/workers/')
    );
  }
  if (target === '/settings/people' || target === '/settings/team') {
    return (
      path === '/settings/people' ||
      path.startsWith('/settings/people/') ||
      path === '/settings/team' ||
      path.startsWith('/settings/team/')
    );
  }

  return path === target || path.startsWith(`${target}/`);
}

export function settingsLinksForRole(role: UserRole, plan: EverittosPlan): SettingsNavLink[] {
  void plan;

  if (isClientRole(role) || isContractorRole(role)) {
    return PORTAL_SETTINGS_LINKS;
  }

  if (role === 'manager' || role === 'employee' || role === 'viewer') {
    return SETTINGS_NAV_LINKS.filter((link) =>
      ['/settings/account', '/settings/notifications', '/settings/privacy'].includes(link.href)
    );
  }

  return SETTINGS_NAV_LINKS.filter((link) => {
    if (link.href === '/settings/billing') return canManageBilling(role);
    if (link.href === '/settings') return canManageOrganizationSettings(role);
    if (link.href === '/settings/branding') return canManageOrganizationSettings(role);
    if (link.href === '/terms') return true;
    if (link.href.startsWith('/settings/privacy')) return true;
    if (link.href === '/settings/account' || link.href === '/settings/notifications') return true;
    return false;
  });
}

/** Slim primary nav destinations by role. */
export function primaryNavHrefsForRole(role: UserRole): string[] {
  if (isClientRole(role)) {
    return ['/portal/client', '/portal/client?tab=jobs', '/portal/client/settings'];
  }
  if (isContractorRole(role)) {
    return [
      '/portal/contractor',
      '/portal/contractor#jobs',
      '/portal/contractor#schedule',
      '/portal/contractor#earnings',
      '/portal/contractor/settings'
    ];
  }
  if (role === 'manager') {
    return ['/dashboard', '/jobs', '/schedule', '/customers', '/people', '/expenses', '/reports', '/settings'];
  }
  if (canSeeOrgWideData(role)) {
    return ['/dashboard', '/jobs', '/schedule', '/customers', '/people', '/expenses', '/reports', '/settings'];
  }
  return ['/dashboard', '/jobs', '/schedule', '/settings'];
}

export function appNavItemsForRole(role: UserRole, plan: EverittosPlan) {
  const allowed = new Set(primaryNavHrefsForRole(role).map((href) => href.split('?')[0].split('#')[0]));
  return APP_NAV_LINKS.map((link) => ({
    ...link,
    resolution: resolveNavItem(role, plan, link.href)
  })).filter((link) => {
    if (!link.resolution.visible) return false;
    return allowed.has(navPath(link.href));
  }) as Array<(typeof APP_NAV_LINKS)[number] & { resolution: NavItemResolution; href: AppNavHref }>;
}
