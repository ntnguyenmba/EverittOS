import { limitsForPlan } from '@/lib/everittos-limits';
import { planDisplayName, type EverittosPlan } from '@/lib/everittos-plans';
import { isUnlimited, limitReached } from '@/lib/plan-limit-utils';

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

export function workerPlanFeatureMessage(plan: EverittosPlan): string {
  return `Team management requires Business plan or higher. Your workspace is on ${planDisplayName(plan)} plan.`;
}

export function workerPlanLimitMessage(plan: EverittosPlan, workerLimit: number): string {
  if (isUnlimited(workerLimit)) {
    return `Team member limit reached for ${planDisplayName(plan)} plan.`;
  }
  const suffix = workerLimit === 1 ? '' : 's';
  return `Team member limit reached for ${planDisplayName(plan)} plan. Your current limit is ${workerLimit} team member${suffix}.`;
}

export function validatePlanAction({ plan, resource, currentCount }: PlanValidateInput): PlanValidateResult {
  const limits = limitsForPlan(plan);

  if (resource === 'workers' && !limits.crewAssignment) {
    return { allowed: false, message: workerPlanFeatureMessage(plan) };
  }

  if (resource === 'photos' && !limits.photoUpload) {
    return { allowed: false, message: 'Photo uploads are not available on your plan.' };
  }

  if (resource === 'reports' && !limits.pdfReports) {
    return { allowed: false, message: 'Reports require Pro or higher.' };
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
    if (resource === 'workers') {
      return { allowed: false, message: workerPlanLimitMessage(plan, cap) };
    }
    return { allowed: false, message: `Plan limit reached for ${resource}. Upgrade to continue.` };
  }

  return { allowed: true };
}
