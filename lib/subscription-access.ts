import { normalizeStripeStatus, type StripeSubscriptionStatus } from '@/lib/stripe-subscription';
import { normalizePlan, type EverittosPlan } from '@/lib/everittos-plans';

export type SubscriptionAccess = {
  ok: boolean;
  status: StripeSubscriptionStatus | 'free';
  message: string;
  billingRequired: boolean;
};

/** Whether paid-plan features should be available based on subscription status. */
export function subscriptionAccess(
  planInput: string | null | undefined,
  statusInput: string | null | undefined
): SubscriptionAccess {
  const plan = normalizePlan(planInput);
  const status = normalizeStripeStatus(statusInput);

  if (plan === 'free') {
    return {
      ok: true,
      status: 'free',
      message: 'Free plan. Upgrade when you need higher limits.',
      billingRequired: false
    };
  }

  switch (status) {
    case 'active':
    case 'trialing':
      return { ok: true, status, message: 'Subscription active.', billingRequired: false };
    case 'canceled':
      return {
        ok: true,
        status,
        message: 'Subscription canceled. Access continues until the billing period ends.',
        billingRequired: false
      };
    case 'past_due':
      return {
        ok: false,
        status,
        message: 'Payment failed. Update billing details to keep full access.',
        billingRequired: true
      };
    case 'unpaid':
      return {
        ok: false,
        status,
        message: 'Subscription is unpaid. Update payment to restore access.',
        billingRequired: true
      };
    case 'incomplete':
      return {
        ok: false,
        status,
        message: 'Checkout is incomplete. Finish payment to activate your plan.',
        billingRequired: true
      };
    case 'incomplete_expired':
      return {
        ok: false,
        status,
        message: 'Checkout expired. Start a new subscription from billing settings.',
        billingRequired: true
      };
    case 'paused':
      return {
        ok: false,
        status,
        message: 'Subscription is paused. Resume from billing settings.',
        billingRequired: true
      };
    case 'inactive':
      return {
        ok: false,
        status,
        message: 'Subscription status is unrecognized. Update billing to restore paid access.',
        billingRequired: true
      };
    default:
      return {
        ok: false,
        status: 'inactive',
        message: 'Subscription status is unrecognized. Update billing to restore paid access.',
        billingRequired: true
      };
  }
}

export function subscriptionBlocksPaidAccess(plan: EverittosPlan, status: string | null | undefined): boolean {
  if (plan === 'free') return false;
  const access = subscriptionAccess(plan, status);
  return !access.ok && access.billingRequired;
}
