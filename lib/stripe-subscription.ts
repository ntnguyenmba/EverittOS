import { localizedSubscriptionStatusMessage } from '@/lib/i18n/subscription-status-copy';

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

export function subscriptionStatusMessage(status: string | null | undefined, locale?: string | null): string {
  const normalized = normalizeStripeStatus(status);
  return localizedSubscriptionStatusMessage(normalized, locale, 'full');
}

export function canCancelSubscription(status: string | null | undefined): boolean {
  const normalized = normalizeStripeStatus(status);
  return normalized === 'active' || normalized === 'trialing' || normalized === 'past_due' || normalized === 'paused';
}

export function canResumeSubscription(status: string | null | undefined): boolean {
  const normalized = normalizeStripeStatus(status);
  return normalized === 'canceled' || normalized === 'paused';
}
