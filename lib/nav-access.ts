import { canManageDepartments } from '@/lib/departments';
import { limitsForPlan } from '@/lib/everittos-limits';
import { hasTeamManagement, normalizePlan, planShortBadgeName, type EverittosPlan } from '@/lib/everittos-plans';
import { meetsMinimumPlan, minimumPlanForPath, planRank } from '@/lib/plan-access';
import { canSeeOrgWideData, hasPermission } from '@/lib/permissions';
import type { AppNavHref } from '@/lib/nav-links';
import { APP_NAV_LINKS } from '@/lib/nav-links';
import {
  canManageBilling,
  canManageOrganizationSettings,
  canViewTeam,
  isClientRole,
  type UserRole
} from '@/lib/roles';

export type SettingsNavLink = {
  href: string;
  label: string;
};

export const SETTINGS_NAV_LINKS: SettingsNavLink[] = [
  { href: '/settings', label: 'General' },
  { href: '/settings/account', label: 'Account' },
  { href: '/settings/people', label: 'Team' },
  { href: '/settings/integrations', label: 'Integrations' },
  { href: '/settings/billing', label: 'Billing' }
];

export type NavItemResolution = {
  visible: boolean;
  accessible: boolean;
  requiredPlan?: EverittosPlan;
};

function navPath(href: string): string {
  return href.split('?')[0];
}

/** Role-only gate: should this item appear in navigation at all? */
export function canShowNavHref(role: UserRole, href: string): boolean {
  if (isClientRole(role)) {
    return href === '/portal/client';
  }

  const path = navPath(href);

  switch (path) {
    case '/dashboard':
      return true;
    case '/jobs':
    case '/notifications':
      return hasPermission(role, 'view_assigned_jobs');
    case '/schedule':
      return hasPermission(role, 'view_schedules');
    case '/customers':
    case '/projects':
    case '/knowledge':
    case '/proposals':
    case '/automations':
    case '/clients':
    case '/forms':
    case '/templates':
    case '/reviews':
    case '/services':
    case '/bookings':
    case '/leads':
    case '/workers':
    case '/activity':
    case '/analytics':
    case '/expenses':
    case '/inventory':
    case '/routes':
    case '/workflows':
      return canSeeOrgWideData(role);
    case '/people':
    case '/team':
    case '/settings/people':
    case '/settings/team':
      return canViewTeam(role);
    case '/settings/billing':
      return canManageBilling(role);
    case '/settings':
      return canManageOrganizationSettings(role);
    case '/portal/contractor':
      return role === 'contractor';
    case '/portal/client':
      return isClientRole(role);
    default:
      if (path.startsWith('/jobs/')) return hasPermission(role, 'view_assigned_jobs');
      if (path.startsWith('/settings/')) return canAccessSettingsPathByRole(role, path);
      return true;
  }
}

function canAccessSettingsPathByRole(role: UserRole, path: string): boolean {
  if (isClientRole(role)) {
    return (
      path.startsWith('/settings/account') ||
      path.startsWith('/settings/security') ||
      path.startsWith('/settings/privacy') ||
      path.startsWith('/settings/notifications') ||
      path.startsWith('/settings/support')
    );
  }
  if (path.startsWith('/settings/billing')) return canManageBilling(role);
  if (path.startsWith('/settings/ai-usage')) return canManageBilling(role);
  if (path.startsWith('/settings/referrals')) return canManageOrganizationSettings(role);
  if (path.startsWith('/settings/people') || path.startsWith('/settings/team')) return canViewTeam(role);
  if (path.startsWith('/settings/branding') || path.startsWith('/settings/integrations')) {
    return canManageOrganizationSettings(role);
  }
  if (path === '/settings' || path.startsWith('/settings?')) {
    return canManageOrganizationSettings(role);
  }
  if (path.startsWith('/settings/account') || path.startsWith('/settings/security')) return true;
  if (path.startsWith('/settings/departments')) return canManageOrganizationSettings(role);
  if (path.startsWith('/settings/api')) return canManageOrganizationSettings(role);
  return true;
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

/** Plan feature gate beyond route minimums (e.g. People needs teamManagement flag). */
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
  const normalizedPlan = normalizePlan(plan);

  if (isClientRole(role)) {
    return SETTINGS_NAV_LINKS.filter((link) => link.href === '/settings/account');
  }

  return SETTINGS_NAV_LINKS.filter((link) => {
    if (link.href === '/settings/billing' && !canManageBilling(role)) return false;
    if (link.href === '/settings' && !canManageOrganizationSettings(role)) return false;
    if ((link.href === '/settings/people' || link.href === '/settings/team') && !canViewTeam(role)) return false;
    if (link.href === '/settings/integrations' && !canManageOrganizationSettings(role)) return false;
    if (link.href === '/settings/departments' && !canManageDepartments(role, normalizedPlan)) return false;
    if (link.href === '/settings/api' && !limitsForPlan(normalizedPlan).apiAccess) return false;
    if (link.href === '/settings/ai-memory' && !limitsForPlan(normalizedPlan).aiAccess) return false;
    return true;
  });
}

export function appNavItemsForRole(role: UserRole, plan: EverittosPlan) {
  return APP_NAV_LINKS.map((link) => ({
    ...link,
    resolution: resolveNavItem(role, plan, link.href)
  })).filter((link) => link.resolution.visible) as Array<
    (typeof APP_NAV_LINKS)[number] & { resolution: NavItemResolution; href: AppNavHref }
  >;
}
