/**
 * Client-safe billing card actions for the billing UI.
 * Checkout availability is resolved server-side via /api/stripe/capabilities.
 */
import { billingPlanDefinition } from '@/lib/billing-config';
import type { EverittosPlan } from '@/lib/everittos-plans';
import { supportMailtoHref } from '@/lib/support';

export type PaidPlanKey = Exclude<EverittosPlan, 'free'>;

export type BillingCheckoutMethod = 'session';

export type BillingPlanCardUi =
  | { kind: 'current'; label: 'Current plan' }
  | {
      kind: 'checkout';
      label: string;
      plan: PaidPlanKey;
      checkoutAvailable: boolean;
    }
  | { kind: 'portal'; label: string }
  | { kind: 'downgrade_contact'; label: string; href: string }
  | { kind: 'unavailable'; label: string; reason: string };

/** Bump when billing purchase-button logic changes (visible on /settings/billing). */
export const BILLING_UI_BUILD_ID = 'billing-v9-activation-sync-fix';

export function billingCheckoutTargetAvailable(plan: string): plan is PaidPlanKey {
  return plan !== 'free' && Boolean(billingPlanDefinition(plan as EverittosPlan));
}

export function resolveBillingPlanCardUi(input: {
  currentPlan: EverittosPlan;
  targetPlan: EverittosPlan;
  hasActiveSubscription?: boolean;
  portalAvailable?: boolean;
  checkoutAvailableByPlan?: Partial<Record<PaidPlanKey, boolean>>;
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
    return {
      kind: 'unavailable',
      label: 'This plan is not available right now',
      reason: 'invalid_plan'
    };
  }

  const checkoutAvailable = input.checkoutAvailableByPlan?.[target] ?? false;
  const checkoutLabel = billingPlanDefinition(target)?.buttonLabel || `Choose ${target}`;
  const label = isFreeUser ? checkoutLabel : hasActiveSubscription ? 'Upgrade' : checkoutLabel;

  if (hasActiveSubscription && portalAvailable) {
    return { kind: 'portal', label: 'Change plan' };
  }

  if (!checkoutAvailable) {
    return {
      kind: 'unavailable',
      label: 'Purchasing is temporarily unavailable',
      reason: 'missing_stripe_price_id'
    };
  }

  return {
    kind: 'checkout',
    label,
    plan: target,
    checkoutAvailable
  };
}

export function billingPlanCardHint(ui: BillingPlanCardUi): string | null {
  if (ui.kind === 'portal') {
    return 'Review or change your subscription securely in the billing portal.';
  }
  if (ui.kind === 'checkout') {
    return 'Promo codes can be entered during checkout. Subscriptions renew monthly until canceled.';
  }
  if (ui.kind === 'downgrade_contact') {
    return 'Contact support or use the billing portal to move back to the Free plan.';
  }
  if (ui.kind === 'unavailable') {
    return 'This option is temporarily unavailable. Please try again later or contact support.';
  }
  return null;
}

/** @deprecated Use resolveBillingPlanCardUi with checkoutAvailableByPlan from /api/stripe/capabilities. */
export function billingCheckoutTargetForPlan(plan: PaidPlanKey) {
  const definition = billingPlanDefinition(plan);
  return {
    plan,
    priceId: null,
    checkoutUrl: null,
    method: 'session' as const,
    buttonLabel: definition?.buttonLabel || `Choose ${plan}`,
    available: true
  };
}

export const BILLING_CHECKOUT_TARGETS = {} as Record<PaidPlanKey, never>;
