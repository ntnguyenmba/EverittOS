import type { EverittosPlan } from '@/lib/everittos-plans';
import type { PlanFeature } from '@/lib/plan-access';

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

export function highestPlan(plans: Array<EverittosPlan | string | null | undefined>): EverittosPlan {
  const ranks: Record<string, number> = {
    free: 0,
    pro: 1,
    business: 2,
    starter: 3,
    growth: 4,
    enterprise: 5
  };
  let best: EverittosPlan = 'free';
  let bestRank = 0;
  for (const value of plans) {
    const key = String(value || 'free').toLowerCase();
    const plan = (['free', 'pro', 'business', 'starter', 'growth', 'enterprise'].includes(key)
      ? key
      : 'free') as EverittosPlan;
    const rank = ranks[plan] ?? 0;
    if (rank > bestRank) {
      best = plan;
      bestRank = rank;
    }
  }
  return best;
}
