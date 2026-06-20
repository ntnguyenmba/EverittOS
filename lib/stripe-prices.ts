import {
  BILLING_PLAN_AMOUNT_CENTS,
  billingCheckoutAvailable,
  anyBillingCheckoutAvailable,
  allSessionCheckoutConfigured,
  planFromKnownStripePriceId,
  resolveStripePriceId,
  type PaidPlanKey
} from '@/lib/billing-config';
import type { EverittosPlan } from '@/lib/everittos-plans';

/** Monthly list prices in cents (display + preview; Stripe price objects are authoritative at checkout). */
export const PLAN_AMOUNT_CENTS: Record<PaidPlanKey, number> = BILLING_PLAN_AMOUNT_CENTS;

export { type PaidPlanKey };

export function isPaidCheckoutPlan(plan: string): plan is PaidPlanKey {
  return plan in PLAN_AMOUNT_CENTS;
}

export function stripePriceIdForPlan(plan: PaidPlanKey): string | null {
  return resolveStripePriceId(plan);
}

/** Map a Stripe price ID back to an EverittOS plan (server-side env + known defaults). */
export function planFromStripePriceId(priceId: string | null | undefined): EverittosPlan | null {
  return planFromKnownStripePriceId(priceId) || null;
}

export function stripeCheckoutConfigured(): boolean {
  return allSessionCheckoutConfigured();
}

export function stripeCheckoutAvailableForPlan(plan: PaidPlanKey): boolean {
  return billingCheckoutAvailable(plan);
}

export function stripeAnyCheckoutAvailable(): boolean {
  return anyBillingCheckoutAvailable();
}

export function paidCheckoutPlans(): PaidPlanKey[] {
  return Object.keys(PLAN_AMOUNT_CENTS) as PaidPlanKey[];
}

export function formatMoneyFromCents(cents: number, currency = 'usd'): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency.toUpperCase(),
    minimumFractionDigits: 0,
    maximumFractionDigits: 2
  }).format(cents / 100);
}
