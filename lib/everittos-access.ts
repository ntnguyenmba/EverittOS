import { normalizePlan, type EverittosPlan } from '@/lib/everittos-plans';
import { limitsForPlan } from '@/lib/everittos-limits';

export type BillingProfile = {
  plan?: string | null;
  subscription_status?: string | null;
};

export type BillingSubscription = {
  status?: string | null;
  plan?: string | null;
  current_period_end?: string | null;
};

const ACTIVE_STATUSES = new Set(['active', 'trialing', 'paid', 'free']);

export function normalizedPlan(profile?: BillingProfile | null): EverittosPlan {
  return normalizePlan(profile?.plan);
}

export function isPaidPlanActive(
  profile?: BillingProfile | null,
  subscription?: BillingSubscription | null
): boolean {
  const plan = normalizedPlan(profile);
  if (plan === 'free') return true;

  const subStatus = (subscription?.status || '').toLowerCase();
  if (ACTIVE_STATUSES.has(subStatus)) return true;

  const profileStatus = (profile?.subscription_status || '').toLowerCase();
  if (ACTIVE_STATUSES.has(profileStatus)) return true;
  if (profileStatus === `everittos_${plan}`) return true;

  if (subscription?.current_period_end) {
    return new Date(subscription.current_period_end).getTime() > Date.now();
  }

  return false;
}

export function canUploadPhotos(
  profile?: BillingProfile | null,
  subscription?: BillingSubscription | null
): boolean {
  const plan = normalizedPlan(profile);
  return limitsForPlan(plan).photos !== 0 && isPaidPlanActive(profile, subscription);
}

export function canAssignCrew(
  profile?: BillingProfile | null,
  subscription?: BillingSubscription | null
): boolean {
  const plan = normalizedPlan(profile);
  const limits = limitsForPlan(plan);
  return limits.crewAssignment && isPaidPlanActive(profile, subscription);
}
