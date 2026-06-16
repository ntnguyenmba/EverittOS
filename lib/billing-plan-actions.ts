import { planRank } from '@/lib/plan-access';
import { EVERITTOS_STRIPE_LINKS, normalizePlan, type EverittosPlan } from '@/lib/everittos-plans';
import { supportMailtoHref } from '@/lib/support';

export type PlanCardAction =
  | { type: 'current'; label: 'Current plan' }
  | { type: 'choose'; label: string; plan: EverittosPlan }
  | { type: 'contact'; label: 'Contact billing support'; href: string };

const CHOOSE_LABELS: Record<EverittosPlan, string> = {
  free: 'Free plan',
  pro: 'Choose Pro',
  business: 'Choose Business',
  growth: 'Choose Growth',
  enterprise: 'Choose Enterprise'
};

export function choosePlanButtonLabel(plan: EverittosPlan): string {
  return CHOOSE_LABELS[normalizePlan(plan)] || 'Choose plan';
}

export function planCardAction(currentPlan: EverittosPlan, targetPlan: EverittosPlan): PlanCardAction {
  const current = normalizePlan(currentPlan);
  const target = normalizePlan(targetPlan);

  if (target === 'free') {
    if (current === 'free') return { type: 'current', label: 'Current plan' };
    return {
      type: 'contact',
      label: 'Contact billing support',
      href: supportMailtoHref('EverittOS plan change')
    };
  }

  if (current === target) {
    return { type: 'current', label: 'Current plan' };
  }

  if (target === 'enterprise' && !EVERITTOS_STRIPE_LINKS.enterprise) {
    return {
      type: 'contact',
      label: 'Contact billing support',
      href: supportMailtoHref('EverittOS Enterprise plan')
    };
  }

  return { type: 'choose', label: choosePlanButtonLabel(target), plan: target };
}

export function isPlanUpgrade(currentPlan: EverittosPlan, targetPlan: EverittosPlan): boolean {
  return planRank(targetPlan) > planRank(currentPlan);
}

export function isPlanDowngrade(currentPlan: EverittosPlan, targetPlan: EverittosPlan): boolean {
  return planRank(targetPlan) < planRank(currentPlan) && targetPlan !== 'free';
}
