import { normalizePlan, type EverittosPlan } from '@/lib/everittos-plans';

export type PlanFeature =
  | 'photoUpload'
  | 'teamManagement'
  | 'crewAssignment'
  | 'scheduling'
  | 'activityLog'
  | 'advancedReporting'
  | 'workflowCustomization'
  | 'multiLocation'
  | 'customBranding'
  | 'pdfReports'
  | 'clientPortal'
  | 'contractorPortal'
  | 'brandedReports'
  | 'beforeAfterPhotos'
  | 'aiAccess'
  | 'aiUnlimited'
  | 'apiAccess'
  | 'prioritySupport'
  | 'bookings';

const PLAN_ORDER: Record<EverittosPlan, number> = {
  free: 0,
  pro: 1,
  business: 2,
  starter: 3,
  growth: 4,
  enterprise: 5
};

/** Lowest plan that unlocks a feature. Every higher plan includes it. */
export const FEATURE_MIN_PLAN: Record<PlanFeature, EverittosPlan> = {
  photoUpload: 'free',
  scheduling: 'free',
  bookings: 'pro',
  beforeAfterPhotos: 'pro',
  pdfReports: 'pro',
  teamManagement: 'business',
  crewAssignment: 'business',
  activityLog: 'business',
  aiAccess: 'business',
  advancedReporting: 'business',
  multiLocation: 'starter',
  customBranding: 'starter',
  brandedReports: 'starter',
  workflowCustomization: 'growth',
  clientPortal: 'growth',
  contractorPortal: 'growth',
  apiAccess: 'growth',
  prioritySupport: 'growth',
  aiUnlimited: 'enterprise'
};

export function planRankValue(plan: EverittosPlan): number {
  return PLAN_ORDER[normalizePlan(plan)] ?? 0;
}

export function highestPlan(plans: Array<EverittosPlan | string | null | undefined>): EverittosPlan {
  let best: EverittosPlan = 'free';
  for (const value of plans) {
    const plan = normalizePlan(value);
    if (planRankValue(plan) > planRankValue(best)) best = plan;
  }
  return best;
}

export function planIncludesFeature(plan: EverittosPlan, feature: PlanFeature): boolean {
  return planRankValue(plan) >= planRankValue(FEATURE_MIN_PLAN[feature]);
}
