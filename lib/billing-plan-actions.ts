import { planRank } from '@/lib/plan-access';
import { planDisplayName, normalizePlan, type EverittosPlan } from '@/lib/everittos-plans';
import { isPaidCheckoutPlan, stripeCheckoutAvailableForPlan } from '@/lib/stripe-prices';
import { supportMailtoHref } from '@/lib/support';

export type PlanChangeKind = 'subscribe' | 'upgrade' | 'downgrade' | 'switch';

export type PlanCardAction =
  | { type: 'current'; label: 'Current plan' }
  | { type: 'checkout'; label: string; plan: EverittosPlan; change: PlanChangeKind }
  | { type: 'portal'; label: string; change: 'upgrade' | 'downgrade' | 'switch' }
  | { type: 'contact'; label: 'Contact billing support'; href: string; reason?: string };

function planChangeLabel(current: EverittosPlan, target: EverittosPlan): { label: string; change: PlanChangeKind } {
  if (current === 'free') {
    return { label: `Subscribe to ${planShortName(target)}`, change: 'subscribe' };
  }
  if (isPlanUpgrade(current, target)) {
    return { label: `Upgrade to ${planShortName(target)}`, change: 'upgrade' };
  }
  if (isPlanDowngrade(current, target)) {
    return { label: `Downgrade to ${planShortName(target)}`, change: 'downgrade' };
  }
  return { label: `Switch to ${planShortName(target)}`, change: 'switch' };
}

function planShortName(plan: EverittosPlan): string {
  const name = planDisplayName(plan);
  return name.replace(/^EverittOS\s+/i, '');
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
        label: 'Cancel or change plan in billing portal',
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

  if (!isPaidCheckoutPlan(target) || !stripeCheckoutAvailableForPlan(target)) {
    return {
      type: 'contact',
      label: 'Contact billing support',
      href: supportMailtoHref(`EverittOS ${planDisplayName(target)} plan`),
      reason: 'checkout_unavailable'
    };
  }

  const { label, change } = planChangeLabel(current, target);

  if (hasActiveSubscription && current !== 'free') {
    if (portalAvailable) {
      const portalLabel =
        change === 'upgrade'
          ? `Upgrade to ${planShortName(target)} in billing portal`
          : change === 'downgrade'
            ? `Downgrade to ${planShortName(target)} in billing portal`
            : `Switch to ${planShortName(target)} in billing portal`;
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
    return 'You will complete checkout in Stripe. Subscriptions renew monthly until canceled.';
  }
  if (action.type === 'checkout' && action.change === 'upgrade') {
    return 'Complete checkout to activate your new plan.';
  }
  return null;
}
