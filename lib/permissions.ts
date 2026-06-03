import { limitsForPlan } from '@/lib/everittos-limits';
import type { EverittosPlan } from '@/lib/everittos-plans';
import {
  canManageBilling,
  canManageTeam,
  canViewInternalNotes,
  isClientRole,
  isContractorRole,
  isManagerRole,
  type UserRole
} from '@/lib/roles';

export function canAccessMainApp(role: UserRole): boolean {
  return !isClientRole(role);
}

export function canAccessClientPortal(role: UserRole, plan: EverittosPlan): boolean {
  return isClientRole(role) || limitsForPlan(plan).clientPortal;
}

export function canAccessContractorPortal(role: UserRole, plan: EverittosPlan): boolean {
  return isContractorRole(role) || (limitsForPlan(plan).contractorPortal && !isClientRole(role));
}

export function canCreateJobs(role: UserRole): boolean {
  return isManagerRole(role);
}

export function canEditCustomers(role: UserRole): boolean {
  return isManagerRole(role) || role === 'employee';
}

export function canInviteTeam(role: UserRole, plan: EverittosPlan): boolean {
  return canManageTeam(role) && limitsForPlan(plan).teamManagement;
}

export { canManageBilling, canManageTeam, canViewInternalNotes, isManagerRole, isContractorRole, isClientRole };
