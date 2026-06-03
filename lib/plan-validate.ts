import { limitsForPlan } from '@/lib/everittos-limits';
import type { EverittosPlan } from '@/lib/everittos-plans';
import { limitReached } from '@/lib/plan-limit-utils';

export type PlanResource =
  | 'jobs'
  | 'photos'
  | 'customers'
  | 'reports'
  | 'workers'
  | 'teamMembers'
  | 'locations';

export type PlanValidateInput = {
  plan: EverittosPlan;
  resource: PlanResource;
  currentCount: number;
};

export type PlanValidateResult = {
  allowed: boolean;
  message?: string;
};

export function validatePlanAction({ plan, resource, currentCount }: PlanValidateInput): PlanValidateResult {
  const limits = limitsForPlan(plan);

  if (resource === 'workers' && !limits.crewAssignment) {
    return { allowed: false, message: 'Crew workers require Business, Starter, Growth, or Enterprise.' };
  }

  if (resource === 'teamMembers' && !limits.teamManagement) {
    return { allowed: false, message: 'Team invitations require a plan with team management.' };
  }

  const capMap: Record<PlanResource, number> = {
    jobs: limits.jobs,
    photos: limits.photos,
    customers: limits.customers,
    reports: limits.reports,
    workers: limits.crewMembers,
    teamMembers: limits.teamMembers,
    locations: limits.locations
  };

  const cap = capMap[resource];
  if (limitReached(cap, currentCount)) {
    return { allowed: false, message: `Plan limit reached for ${resource}. Upgrade to continue.` };
  }

  return { allowed: true };
}
