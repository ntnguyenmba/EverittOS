import { getPlanConfig, type PlanTierId, type PlanTierRow } from '@/lib/plan-config';
import { limitsForPlan, type PlanLimits } from '@/lib/everittos-limits';
import type { EverittosPlan } from '@/lib/everittos-plans';
import { canAccessFeature, requirePlan, type PlanFeature, type RequirePlanResult } from '@/lib/plan-access';
import { validatePlanAction, type PlanResource, type PlanValidateResult } from '@/lib/plan-validate';

export type PlanLimitResource = PlanResource;

export { getPlanConfig, canAccessFeature, requirePlan, limitsForPlan };
export type { PlanFeature, PlanLimits, PlanTierRow, RequirePlanResult, PlanValidateResult };

export function getPlanLimit(plan: EverittosPlan, resource: PlanLimitResource): number {
  const limits = limitsForPlan(plan);
  const map: Record<PlanLimitResource, number> = {
    jobs: limits.jobs,
    photos: limits.photos,
    customers: limits.customers,
    reports: limits.reports,
    workers: limits.crewMembers,
    teamMembers: limits.teamMembers,
    locations: limits.locations
  };
  return map[resource];
}

export function checkUsageLimit(
  plan: EverittosPlan,
  resource: PlanLimitResource,
  currentCount: number
): PlanValidateResult {
  return validatePlanAction({ plan, resource, currentCount });
}

export function planTierId(plan: EverittosPlan): PlanTierId {
  return plan as PlanTierId;
}
