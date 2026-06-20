export type StripeSubscriptionStatus =
  | 'active'
  | 'trialing'
  | 'past_due'
  | 'canceled'
  | 'unpaid'
  | 'incomplete'
  | 'incomplete_expired'
  | 'paused'
  | 'inactive';

export function normalizeStripeStatus(value: string | null | undefined): StripeSubscriptionStatus | 'free' {
  const status = (value || 'free').toLowerCase();

  if (status.startsWith('everittos_')) return 'active';
  if (status === 'cancelled') return 'canceled';

  const known: StripeSubscriptionStatus[] = [
    'active',
    'trialing',
    'past_due',
    'canceled',
    'unpaid',
    'incomplete',
    'incomplete_expired',
    'paused',
    'inactive'
  ];

  if (known.includes(status as StripeSubscriptionStatus)) {
    return status as StripeSubscriptionStatus;
  }

  return status === 'free' ? 'free' : 'inactive';
}

export function subscriptionStatusMessage(status: string | null | undefined): string {
  const normalized = normalizeStripeStatus(status);

  switch (normalized) {
    case 'free':
      return 'You are on the free plan. Upgrade when you need higher limits.';
    case 'active':
      return 'Your subscription is active.';
    case 'trialing':
      return 'Your trial is active. Billing starts when the trial ends.';
    case 'past_due':
      return 'Payment failed. Update billing details to keep access.';
    case 'canceled':
      return 'Your subscription is canceled. Access continues until the current period ends.';
    case 'unpaid':
      return 'Your subscription is unpaid. Update payment to restore access.';
    case 'incomplete':
      return 'Checkout is incomplete. Finish payment to activate your plan.';
    case 'incomplete_expired':
      return 'Checkout expired. Start a new subscription to continue.';
    case 'paused':
      return 'Your subscription is paused. Resume when you are ready.';
    case 'inactive':
      return 'Subscription status is unrecognized. Update billing or contact support to restore access.';
    default:
      return 'Subscription status is unrecognized. Update billing or contact support.';
  }
}

export function canCancelSubscription(status: string | null | undefined): boolean {
  const normalized = normalizeStripeStatus(status);
  return normalized === 'active' || normalized === 'trialing' || normalized === 'past_due' || normalized === 'paused';
}

export function canResumeSubscription(status: string | null | undefined): boolean {
  const normalized = normalizeStripeStatus(status);
  return normalized === 'canceled' || normalized === 'paused';
}
