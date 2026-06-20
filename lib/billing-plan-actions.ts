import { billingCheckoutAvailable } from '@/lib/billing-config';
import { planRank } from '@/lib/plan-access';
import { planDisplayName, normalizePlan, type EverittosPlan } from '@/lib/everittos-plans';
import { isPaidCheckoutPlan } from '@/lib/stripe-prices';
import { supportMailtoHref } from '@/lib/support';

export type PlanChangeKind = 'subscribe' | 'upgrade' | 'downgrade' | 'switch';

export type PlanCardAction =
  | { type: 'current'; label: 'Current plan' }
  | { type: 'checkout'; label: string; plan: EverittosPlan; change: PlanChangeKind }
  | { type: 'portal'; label: string; change: 'upgrade' | 'downgrade' | 'switch' }
  | { type: 'unavailable'; label: string; reason: string }
  | { type: 'contact'; label: 'Contact billing support'; href: string; reason?: string };

function planChangeLabel(current: EverittosPlan, target: EverittosPlan): { label: string; change: PlanChangeKind } {
  if (current === 'free') {
    return { label: 'Choose plan', change: 'subscribe' };
  }
  if (isPlanUpgrade(current, target)) {
    return { label: 'Upgrade', change: 'upgrade' };
  }
  if (isPlanDowngrade(current, target)) {
    return { label: `Downgrade to ${planShortName(target)}`, change: 'downgrade' };
  }
  return { label: `Switch to ${planShortName(target)}`, change: 'switch' };
}

function planShortName(plan: EverittosPlan): string {
  return planDisplayName(plan);
}

export type PlanCardActionOptions = {
  /** User already has an active paid Stripe subscription on file. */
  hasActiveSubscription?: boolean;
  /** Stripe Customer Portal is available for plan changes / cancel. */
  portalAvailable?: boolean;
};

export function planCardAction(
  currentPlan: EverittosPlan,
  targetPlan: EverittosPlan,
  options: PlanCardActionOptions = {}
): PlanCardAction {
  const current = normalizePlan(currentPlan);
  const target = normalizePlan(targetPlan);
  const hasActiveSubscription = options.hasActiveSubscription === true;
  const portalAvailable = options.portalAvailable === true;

  if (target === 'free') {
    if (current === 'free') return { type: 'current', label: 'Current plan' };
    if (hasActiveSubscription && portalAvailable) {
      return {
        type: 'portal',
        label: 'Manage billing',
        change: 'downgrade'
      };
    }
    return {
      type: 'contact',
      label: 'Contact billing support',
      href: supportMailtoHref('EverittOS plan change'),
      reason: 'downgrade_to_free'
    };
  }

  if (current === target) {
    return { type: 'current', label: 'Current plan' };
  }

  if (!isPaidCheckoutPlan(target)) {
    return {
      type: 'unavailable',
      label: 'Billing setup missing for this plan',
      reason: 'invalid_plan'
    };
  }

  if (!billingCheckoutAvailable(target)) {
    return {
      type: 'unavailable',
      label: 'Billing setup missing for this plan',
      reason: 'checkout_unavailable'
    };
  }

  const { label, change } = planChangeLabel(current, target);

  if (hasActiveSubscription && current !== 'free') {
    if (portalAvailable) {
      const portalLabel =
        change === 'upgrade'
          ? 'Upgrade in billing portal'
          : change === 'downgrade'
            ? 'Downgrade in billing portal'
            : 'Change plan in billing portal';
      return {
        type: 'portal',
        label: portalLabel,
        change: change === 'upgrade' ? 'upgrade' : change === 'downgrade' ? 'downgrade' : 'switch'
      };
    }
    return {
      type: 'contact',
      label: 'Contact billing support',
      href: supportMailtoHref('EverittOS plan change'),
      reason: 'portal_unavailable'
    };
  }

  return { type: 'checkout', label, plan: target, change };
}

export function isPlanUpgrade(currentPlan: EverittosPlan, targetPlan: EverittosPlan): boolean {
  return planRank(targetPlan) > planRank(currentPlan);
}

export function isPlanDowngrade(currentPlan: EverittosPlan, targetPlan: EverittosPlan): boolean {
  return planRank(targetPlan) < planRank(currentPlan) && targetPlan !== 'free';
}

export function planChangeHint(action: PlanCardAction): string | null {
  if (action.type === 'portal') {
    if (action.change === 'upgrade') {
      return 'Upgrades take effect through Stripe after you confirm the new plan.';
    }
    if (action.change === 'downgrade') {
      return 'Downgrades and cancellations are managed in the Stripe billing portal.';
    }
    return 'Plan changes are managed in the Stripe billing portal.';
  }
  if (action.type === 'checkout' && action.change === 'subscribe') {
    return 'You will complete checkout in Stripe. Promo codes can be entered on the Stripe checkout page. Subscriptions renew monthly until canceled.';
  }
  if (action.type === 'checkout' && action.change === 'upgrade') {
    return 'Complete checkout in Stripe to activate your new plan.';
  }
  if (action.type === 'unavailable') {
    return 'This plan is not configured for checkout yet. Contact support if you need help.';
  }
  return null;
}
