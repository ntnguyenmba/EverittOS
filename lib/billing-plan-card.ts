/**
 * Frozen, client-safe Stripe checkout targets for billing UI.
 * Never reads process.env — safe for SSR, hydration, and browser bundles.
 */
import { supportMailtoHref } from '@/lib/support';
import type { EverittosPlan } from '@/lib/everittos-plans';

export type PaidPlanKey = Exclude<EverittosPlan, 'free'>;

export type BillingCheckoutMethod = 'session' | 'payment_link';

export type BillingCheckoutTarget = {
  plan: PaidPlanKey;
  priceId: string | null;
  checkoutUrl: string | null;
  method: BillingCheckoutMethod;
  buttonLabel: string;
  available: true;
};

/** Bump when billing purchase-button logic changes (visible on /settings/billing). */
export const BILLING_UI_BUILD_ID = 'billing-v3-client-checkout';

export const BILLING_CHECKOUT_TARGETS: Record<PaidPlanKey, BillingCheckoutTarget> = {
  pro: {
    plan: 'pro',
    priceId: null,
    checkoutUrl: 'https://buy.stripe.com/eVq7sEcXCbX08Kn8P993y0c',
    method: 'payment_link',
    buttonLabel: 'Choose Pro',
    available: true
  },
  business: {
    plan: 'business',
    priceId: 'price_1TcwxB2KsjgU9g9y57f9veQh',
    checkoutUrl: null,
    method: 'session',
    buttonLabel: 'Choose Business',
    available: true
  },
  starter: {
    plan: 'starter',
    priceId: null,
    checkoutUrl: 'https://buy.stripe.com/cNi4gs8Hm3qu8Kn7L593y08',
    method: 'payment_link',
    buttonLabel: 'Choose Starter',
    available: true
  },
  growth: {
    plan: 'growth',
    priceId: 'price_1TbVfe2KsjgU9g9yMtCnJrBw',
    checkoutUrl: 'https://buy.stripe.com/9B6aEQcXCbX06Cf7L593y09',
    method: 'session',
    buttonLabel: 'Choose Growth',
    available: true
  },
  enterprise: {
    plan: 'enterprise',
    priceId: 'price_1TbViN2KsjgU9g9yUlok4S2W',
    checkoutUrl: 'https://buy.stripe.com/3cI6oA5va6CG5yb5CX93y0a',
    method: 'session',
    buttonLabel: 'Choose Enterprise',
    available: true
  }
};

export function billingCheckoutTargetForPlan(plan: PaidPlanKey): BillingCheckoutTarget {
  return BILLING_CHECKOUT_TARGETS[plan];
}

export function billingCheckoutTargetAvailable(plan: string): plan is PaidPlanKey {
  return plan in BILLING_CHECKOUT_TARGETS;
}

export type BillingPlanCardUi =
  | { kind: 'current'; label: 'Current plan' }
  | {
      kind: 'checkout';
      label: string;
      plan: PaidPlanKey;
      priceId: string | null;
      checkoutUrl: string | null;
      method: BillingCheckoutMethod;
    }
  | { kind: 'portal'; label: string }
  | { kind: 'downgrade_contact'; label: string; href: string };

export function resolveBillingPlanCardUi(input: {
  currentPlan: EverittosPlan;
  targetPlan: EverittosPlan;
  hasActiveSubscription?: boolean;
  portalAvailable?: boolean;
}): BillingPlanCardUi {
  const current = input.currentPlan;
  const target = input.targetPlan;
  const isFreeUser = current === 'free';
  const hasActiveSubscription = !isFreeUser && input.hasActiveSubscription === true;
  const portalAvailable = input.portalAvailable === true;

  if (target === 'free') {
    if (current === 'free') return { kind: 'current', label: 'Current plan' };
    if (hasActiveSubscription && portalAvailable) {
      return { kind: 'portal', label: 'Manage billing' };
    }
    return {
      kind: 'downgrade_contact',
      label: 'Contact billing support',
      href: supportMailtoHref('EverittOS plan change')
    };
  }

  if (current === target) {
    return { kind: 'current', label: 'Current plan' };
  }

  if (!billingCheckoutTargetAvailable(target)) {
    throw new Error(`Missing billing checkout target for plan: ${target}`);
  }

  const checkout = billingCheckoutTargetForPlan(target);
  const label = isFreeUser ? checkout.buttonLabel : hasActiveSubscription ? 'Upgrade' : checkout.buttonLabel;

  if (hasActiveSubscription && portalAvailable) {
    return { kind: 'portal', label: `Change plan in billing portal` };
  }

  return {
    kind: 'checkout',
    label,
    plan: checkout.plan,
    priceId: checkout.priceId,
    checkoutUrl: checkout.checkoutUrl,
    method: checkout.method
  };
}

export function billingPlanCardHint(ui: BillingPlanCardUi): string | null {
  if (ui.kind === 'portal') {
    return 'Plan changes are managed in the Stripe billing portal.';
  }
  if (ui.kind === 'checkout') {
    return 'Promo codes can be entered securely inside Stripe Checkout. Subscriptions renew monthly until canceled.';
  }
  if (ui.kind === 'downgrade_contact') {
    return 'To move back to Free, contact support or cancel in the billing portal.';
  }
  return null;
}
