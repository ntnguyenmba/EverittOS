import { meetsMinimumPlan } from '@/lib/plan-access';
import { normalizePlan, type EverittosPlan } from '@/lib/everittos-plans';

/** Pro and above can track expenses, job profit, and basic financial analytics. */
export function canAccessFinancialTracking(plan: EverittosPlan): boolean {
  return meetsMinimumPlan(normalizePlan(plan), 'pro');
}

export const FINANCIAL_TRACKING_MIN_PLAN: EverittosPlan = 'pro';
