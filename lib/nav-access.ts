import { canManageDepartments } from '@/lib/departments';
import { limitsForPlan } from '@/lib/everittos-limits';
import { hasTeamManagement, normalizePlan, planDisplayName, type EverittosPlan } from '@/lib/everittos-plans';
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
  { href: '/settings', label: 'Workspace' },
  { href: '/settings/team', label: 'Team' },
  { href: '/settings/branding', label: 'Branding' },
  { href: '/settings/integrations', label: 'Integrations' },
  { href: '/settings/account', label: 'Account' },
  { href: '/settings/billing', label: 'Plans & billing' },
  { href: '/settings/security', label: 'Security' },
  { href: '/settings/privacy', label: 'Privacy' },
  { href: '/settings/notifications', label: 'Notifications' },
  { href: '/settings/support', label: 'Support & Training' },
  { href: '/settings/api', label: 'API' },
  { href: '/settings/ai-memory', label: 'AI Memory' },
  { href: '/settings/departments', label: 'Departments' }
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
    case '/leads':
    case '/workers':
    case '/activity':
    case '/analytics':
    case '/expenses':
    case '/workflows':
      return canSeeOrgWideData(role);
    case '/team':
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
  if (path.startsWith('/settings/team')) return canViewTeam(role);
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
      return 'operations';
    case '/automations':
      return 'business';
    case '/knowledge':
    case '/proposals':
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

  if ((path === '/team' || path === '/settings/team') && !hasTeamManagement(normalized)) {
    return 'business';
  }
  if (path === '/workflows' && !limits.workflowCustomization) {
    return 'operations';
  }
  if (path === '/automations' && !limits.aiAccess) {
    return 'business';
  }
  if (path === '/activity' && !limits.activityLog) {
    return 'business';
  }
  if (path === '/portal/client' && !limits.clientPortal) {
    return 'operations';
  }
  if (path === '/portal/contractor' && !limits.contractorPortal) {
    return 'operations';
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

export function billingUpgradeHref(requiredPlan: EverittosPlan, featureLabel?: string): string {
  const params = new URLSearchParams({ upgrade: requiredPlan, reason: 'plan' });
  if (featureLabel) {
    params.set('detail', `${planDisplayName(requiredPlan)} plan required for ${featureLabel}.`);
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

  return path === target || path.startsWith(`${target}/`);
}

export function settingsLinksForRole(role: UserRole, plan: EverittosPlan): SettingsNavLink[] {
  const normalizedPlan = normalizePlan(plan);

  if (isClientRole(role)) {
    return SETTINGS_NAV_LINKS.filter((link) =>
      ['/settings/account', '/settings/security', '/settings/privacy', '/settings/notifications', '/settings/support'].includes(
        link.href
      )
    );
  }

  return SETTINGS_NAV_LINKS.filter((link) => {
    if (link.href === '/settings/billing' && !canManageBilling(role)) return false;
    if (link.href === '/settings' && !canManageOrganizationSettings(role)) return false;
    if (link.href === '/settings/team' && !canViewTeam(role)) return false;
    if (link.href === '/settings/branding' && !canManageOrganizationSettings(role)) return false;
    if (link.href === '/settings/integrations' && !canManageOrganizationSettings(role)) return false;
    if (link.href === '/settings/departments' && !canManageDepartments(role, normalizedPlan)) return false;
    if (link.href === '/settings/api' && !limitsForPlan(normalizedPlan).apiAccess) return false;
    if (link.href === '/settings/ai-memory' && !limitsForPlan(normalizedPlan).aiAccess) return false;
    return true;
  });
}

export function canAccessSettingsPath(role: UserRole, path: string, plan: EverittosPlan): boolean {
  const normalizedPlan = normalizePlan(plan);

  if (isClientRole(role)) {
    return (
      path.startsWith('/settings/account') ||
      path.startsWith('/settings/security') ||
      path.startsWith('/settings/privacy') ||
      path.startsWith('/settings/notifications') ||
      path.startsWith('/settings/support')
    );
  }

  if (path.startsWith('/settings/billing') && !canManageBilling(role)) return false;
  if (path.startsWith('/settings/team') && !canViewTeam(role)) return false;
  if (path.startsWith('/settings/branding') && !canManageOrganizationSettings(role)) return false;
  if ((path === '/settings' || path.startsWith('/settings?')) && !canManageOrganizationSettings(role)) {
    return false;
  }
  if (path.startsWith('/settings/departments') && !canManageDepartments(role, normalizedPlan)) return false;
  if (path.startsWith('/settings/integrations') && !canManageOrganizationSettings(role)) return false;
  if (path.startsWith('/settings/api') && !limitsForPlan(normalizedPlan).apiAccess) return false;
  if (path.startsWith('/settings/ai-memory') && !limitsForPlan(normalizedPlan).aiAccess) return false;

  return true;
}

export function portalHrefForRole(role: UserRole): string {
  return isClientRole(role) ? '/portal/client' : '/dashboard';
}

export function isAppNavHref(href: string): href is AppNavHref {
  return APP_NAV_LINKS.some((link) => link.href === href);
}
