import type { PlanTierId } from '@/lib/plan-config';
import { normalizePlanId } from '@/lib/plan-config';
import { limitsForPlan } from '@/lib/everittos-limits';
import {
  BILLING_PLAN_ORDER,
  BILLING_PLANS,
  billingPlanDefinition,
  type PaidPlanKey
} from '@/lib/billing-config';

export type EverittosPlan = PlanTierId;

export type PlanDefinition = {
  id: EverittosPlan;
  name: string;
  priceLabel: string;
  headline: string;
  features: string[];
  limits: string[];
  buttonLabel: string;
  featured?: boolean;
};

export const EVERITTOS_PLANS: PlanDefinition[] = BILLING_PLANS.map((plan) => ({
  id: plan.id,
  name: plan.name,
  priceLabel: plan.priceLabel,
  headline: plan.headline,
  features: plan.features,
  limits: plan.limits,
  buttonLabel: plan.buttonLabel,
  featured: plan.featured
}));

export function normalizePlan(value: string | null | undefined): EverittosPlan {
  return normalizePlanId(value);
}

export function isPaidEverittosPlan(plan: EverittosPlan): boolean {
  return plan !== 'free';
}

export function isPaidCheckoutPlan(plan: string): plan is PaidPlanKey {
  return plan !== 'free' && BILLING_PLAN_ORDER.includes(plan as EverittosPlan) && plan !== 'free';
}

const TEAM_PLANS: EverittosPlan[] = ['business', 'starter', 'growth', 'enterprise'];

export function hasTeamManagement(plan: EverittosPlan): boolean {
  return TEAM_PLANS.includes(normalizePlan(plan));
}

export function photoUploadAllowed(plan: EverittosPlan): boolean {
  return limitsForPlan(plan).photoUpload;
}

export function planDisplayName(plan: EverittosPlan): string {
  return billingPlanDefinition(plan)?.name || 'Free';
}

export function planShortBadgeName(plan: EverittosPlan): string {
  const short: Record<EverittosPlan, string> = {
    free: 'Free',
    pro: 'Pro',
    business: 'Business',
    starter: 'Starter',
    growth: 'Growth',
    enterprise: 'Enterprise'
  };
  return short[normalizePlan(plan)] || 'Pro';
}

export function planFooterLabel(plan: EverittosPlan): string {
  const name = planShortBadgeName(plan);
  return name === 'Free' ? 'Free Plan' : `${name} Plan`;
}
