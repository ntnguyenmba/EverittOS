import { meetsMinimumPlan } from '@/lib/plan-access';
import { normalizePlan, type EverittosPlan } from '@/lib/everittos-plans';
import { isAdminRole, normalizeRole, type UserRole } from '@/lib/roles';

/** Pro and above can track expenses, job profit, and basic financial analytics. */
export function canAccessFinancialTracking(plan: EverittosPlan): boolean {
  return meetsMinimumPlan(normalizePlan(plan), 'pro');
}

/** Financials are private owner/admin data, still subject to the existing plan gate. */
export function canAccessFinancials(roleInput: UserRole | string | null | undefined, plan: EverittosPlan): boolean {
  return isAdminRole(normalizeRole(roleInput)) && canAccessFinancialTracking(plan);
}

export const FINANCIAL_TRACKING_MIN_PLAN: EverittosPlan = 'pro';
