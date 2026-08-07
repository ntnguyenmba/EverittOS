import { localizedSubscriptionStatusMessage } from '@/lib/i18n/subscription-status-copy';
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
  statusInput: string | null | undefined,
  locale?: string | null
): SubscriptionAccess {
  const plan = normalizePlan(planInput);
  const status = normalizeStripeStatus(statusInput);

  if (plan === 'free') {
    return {
      ok: true,
      status: 'free',
      message: localizedSubscriptionStatusMessage('free', locale, 'short'),
      billingRequired: false
    };
  }

  switch (status) {
    case 'active':
    case 'trialing':
      return {
        ok: true,
        status,
        message: localizedSubscriptionStatusMessage(status, locale, 'short'),
        billingRequired: false
      };
    case 'canceled':
      return {
        ok: true,
        status,
        message: localizedSubscriptionStatusMessage(status, locale, 'short'),
        billingRequired: false
      };
    case 'past_due':
      return {
        ok: false,
        status,
        message: localizedSubscriptionStatusMessage(status, locale, 'short'),
        billingRequired: true
      };
    case 'unpaid':
      return {
        ok: false,
        status,
        message: localizedSubscriptionStatusMessage(status, locale, 'short'),
        billingRequired: true
      };
    case 'incomplete':
      return {
        ok: false,
        status,
        message: localizedSubscriptionStatusMessage(status, locale, 'short'),
        billingRequired: true
      };
    case 'incomplete_expired':
      return {
        ok: false,
        status,
        message: localizedSubscriptionStatusMessage(status, locale, 'short'),
        billingRequired: true
      };
    case 'paused':
      return {
        ok: false,
        status,
        message: localizedSubscriptionStatusMessage(status, locale, 'short'),
        billingRequired: true
      };
    case 'inactive':
      return {
        ok: false,
        status,
        message: localizedSubscriptionStatusMessage(status, locale, 'short'),
        billingRequired: true
      };
    default:
      return {
        ok: false,
        status: 'inactive',
        message: localizedSubscriptionStatusMessage('inactive', locale, 'short'),
        billingRequired: true
      };
  }
}

export function subscriptionBlocksPaidAccess(plan: EverittosPlan, status: string | null | undefined): boolean {
  if (plan === 'free') return false;
  const access = subscriptionAccess(plan, status);
  return !access.ok && access.billingRequired;
}
