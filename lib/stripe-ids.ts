const STRIPE_CUSTOMER_PREFIX = 'cus_';
const STRIPE_SUBSCRIPTION_PREFIX = 'sub_';
const STRIPE_SESSION_PREFIX = 'cs_';

const PLACEHOLDER_PATTERN = /ADD_YOUR|YOUR_STRIPE|placeholder|example/i;

function normalizeId(value: string | null | undefined): string {
  return (value || '').trim();
}

export function isValidStripeCustomerId(value: string | null | undefined): value is string {
  const id = normalizeId(value);
  if (!id.startsWith(STRIPE_CUSTOMER_PREFIX)) return false;
  if (PLACEHOLDER_PATTERN.test(id)) return false;
  return id.length > STRIPE_CUSTOMER_PREFIX.length;
}

export function isValidStripeSubscriptionId(value: string | null | undefined): value is string {
  const id = normalizeId(value);
  if (!id.startsWith(STRIPE_SUBSCRIPTION_PREFIX)) return false;
  if (PLACEHOLDER_PATTERN.test(id)) return false;
  return id.length > STRIPE_SUBSCRIPTION_PREFIX.length;
}

export function isValidStripeCheckoutSessionId(value: string | null | undefined): value is string {
  const id = normalizeId(value);
  if (!id.startsWith(STRIPE_SESSION_PREFIX)) return false;
  if (PLACEHOLDER_PATTERN.test(id)) return false;
  return id.length > STRIPE_SESSION_PREFIX.length;
}

/** Prefer a real Stripe customer id from the incoming sync, then keep an existing valid id. */
export function coalesceStripeCustomerId(
  next: string | null | undefined,
  existing: string | null | undefined
): string | null {
  if (isValidStripeCustomerId(next)) return normalizeId(next);
  if (isValidStripeCustomerId(existing)) return normalizeId(existing);
  return null;
}
