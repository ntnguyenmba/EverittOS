/**
 * Normalized subscription status model shared by Apple, Google, and Stripe adapters.
 */

export type SubscriptionStatus =
  | 'active'
  | 'trialing'
  | 'pending'
  | 'grace_period'
  | 'billing_retry'
  | 'on_hold'
  | 'paused'
  | 'cancelled'
  | 'expired'
  | 'revoked'
  | 'refunded';

export type EntitlementSource = 'stripe' | 'apple' | 'google' | 'manual' | 'free';

/** Whether a normalized status currently grants paid feature access. */
export function statusGrantsAccess(
  status: SubscriptionStatus,
  expiresAt: string | null | undefined
): boolean {
  const now = Date.now();
  const expiresMs = expiresAt ? Date.parse(expiresAt) : NaN;
  const unexpired = !Number.isFinite(expiresMs) || expiresMs > now;

  switch (status) {
    case 'active':
    case 'trialing':
    case 'grace_period':
      return true;
    case 'billing_retry':
      // Retain access while the store reports a retrying billing period.
      return unexpired;
    case 'cancelled':
      // Cancelled subscriptions retain access until expiration.
      return unexpired;
    case 'pending':
    case 'on_hold':
    case 'paused':
    case 'expired':
    case 'revoked':
    case 'refunded':
      return false;
    default:
      return false;
  }
}

const PLAN_RANK: Record<string, number> = {
  free: 0,
  pro: 1,
  business: 2,
  starter: 3,
  growth: 4,
  enterprise: 5
};

export function planRank(plan: string): number {
  return PLAN_RANK[plan] ?? 0;
}

export function pickHigherPlan<T extends string>(a: T, b: T): T {
  return planRank(a) >= planRank(b) ? a : b;
}

export function normalizeStoreStatus(value: string | null | undefined): SubscriptionStatus {
  const raw = String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, '_');

  const aliases: Record<string, SubscriptionStatus> = {
    active: 'active',
    trialing: 'trialing',
    trial: 'trialing',
    pending: 'pending',
    grace_period: 'grace_period',
    in_grace_period: 'grace_period',
    billing_retry: 'billing_retry',
    in_billing_retry: 'billing_retry',
    on_hold: 'on_hold',
    account_hold: 'on_hold',
    paused: 'paused',
    cancelled: 'cancelled',
    canceled: 'cancelled',
    expired: 'expired',
    revoked: 'revoked',
    refunded: 'refunded',
    past_due: 'billing_retry',
    unpaid: 'on_hold',
    incomplete: 'pending'
  };

  return aliases[raw] || 'expired';
}
