import { canManageDepartments } from '@/lib/departments';
import { limitsForPlan } from '@/lib/everittos-limits';
import { hasTeamManagement, normalizePlan, type EverittosPlan } from '@/lib/everittos-plans';
import { SETTINGS_NAV_KEYS, type SettingsNavKey } from '@/lib/nav-links';
import { canSeeOrgWideData, hasPermission } from '@/lib/permissions';
import {
  canManageBilling,
  canManageOrganizationSettings,
  canViewTeam,
  isClientRole,
  type UserRole
} from '@/lib/roles';

export type SettingsNavLink = {
  href: string;
  key: SettingsNavKey;
};

export const SETTINGS_NAV_LINKS: SettingsNavLink[] = [...SETTINGS_NAV_KEYS];

/** Whether a main app nav href is allowed for this role and plan. */
export function canAccessNavHref(role: UserRole, href: string, plan: EverittosPlan): boolean {
  if (isClientRole(role)) {
    return href === '/portal/client';
  }

  const path = href.split('?')[0];

  switch (path) {
    case '/dashboard':
      return true;
    case '/jobs':
    case '/notifications':
      return hasPermission(role, 'view_assigned_jobs');
    case '/schedule':
      return hasPermission(role, 'view_schedules');
    case '/customers':
    case '/workers':
    case '/activity':
    case '/analytics':
      return canSeeOrgWideData(role);
    case '/team':
    case '/settings/team':
      return canViewTeam(role) && hasTeamManagement(plan);
    case '/workflows':
      return canSeeOrgWideData(role) && limitsForPlan(plan).workflowCustomization;
    case '/settings/billing':
      return canManageBilling(role);
    case '/settings':
      return canManageOrganizationSettings(role);
    case '/portal/contractor':
      return role === 'contractor' && limitsForPlan(plan).contractorPortal;
    case '/portal/client':
      return isClientRole(role) && limitsForPlan(plan).clientPortal;
    default:
      if (path.startsWith('/jobs/')) return hasPermission(role, 'view_assigned_jobs');
      if (path.startsWith('/settings/')) return canAccessSettingsPath(role, path, plan);
      return true;
  }
}

export function settingsLinksForRole(role: UserRole, plan: EverittosPlan): SettingsNavLink[] {
  const normalizedPlan = normalizePlan(plan);

  if (isClientRole(role)) {
    return SETTINGS_NAV_LINKS.filter((link) =>
      ['/settings/account', '/settings/security'].includes(link.href)
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
    return true;
  });
}

export function canAccessSettingsPath(role: UserRole, path: string, plan: EverittosPlan): boolean {
  const normalizedPlan = normalizePlan(plan);

  if (isClientRole(role)) {
    return path.startsWith('/settings/account') || path.startsWith('/settings/security');
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

  return true;
}

export function portalHrefForRole(role: UserRole): string {
  return isClientRole(role) ? '/portal/client' : '/dashboard';
}
