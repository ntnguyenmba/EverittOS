import { meetsMinimumPlan } from '@/lib/plan-access';
import { normalizePlan, type EverittosPlan } from '@/lib/everittos-plans';
import { isManagerRole, normalizeRole, type UserRole } from '@/lib/roles';

/** Pro and above can track expenses, job profit, and basic financial analytics. */
export function canAccessFinancialTracking(plan: EverittosPlan): boolean {
  return meetsMinimumPlan(normalizePlan(plan), 'pro');
}

/**
 * Business expenses and related financial tracking for owners, admins, and managers.
 * Contractors and customers never receive this access.
 */
export function canAccessFinancials(roleInput: UserRole | string | null | undefined, plan: EverittosPlan): boolean {
  return isManagerRole(normalizeRole(roleInput)) && canAccessFinancialTracking(plan);
}

export const FINANCIAL_TRACKING_MIN_PLAN: EverittosPlan = 'pro';
