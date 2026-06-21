'use client';

/**
 * Internal billing diagnostics were previously rendered on the customer billing page.
 * Keep this component as a no-op so existing imports stay safe, but customers do not see Stripe sync details,
 * webhook details, runtime diagnostics, price IDs, or internal billing errors.
 */
export function BillingHealthCheck() {
  return null;
}
