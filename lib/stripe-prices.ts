import type { EverittosPlan } from '@/lib/everittos-plans';

/** Monthly list prices in cents (display + preview; Stripe price objects are authoritative at checkout). */
export const PLAN_AMOUNT_CENTS: Record<Exclude<EverittosPlan, 'free'>, number> = {
  pro: 900,
  business: 3900,
  operations: 14900,
  growth: 39900,
  enterprise: 79900
};

const PRICE_ENV_KEYS: Record<Exclude<EverittosPlan, 'free'>, string> = {
  pro: 'STRIPE_PRICE_PRO',
  business: 'STRIPE_PRICE_BUSINESS',
  operations: 'STRIPE_PRICE_OPERATIONS',
  growth: 'STRIPE_PRICE_GROWTH',
  enterprise: 'STRIPE_PRICE_ENTERPRISE'
};

export function isPaidCheckoutPlan(plan: string): plan is Exclude<EverittosPlan, 'free'> {
  return plan in PLAN_AMOUNT_CENTS;
}

export function stripePriceIdForPlan(plan: Exclude<EverittosPlan, 'free'>): string | null {
  const key = PRICE_ENV_KEYS[plan];
  const value = (process.env[key] || '').trim();
  return value || null;
}

export function stripeCheckoutConfigured(): boolean {
  return Object.keys(PLAN_AMOUNT_CENTS).every((tier) =>
    Boolean(stripePriceIdForPlan(tier as Exclude<EverittosPlan, 'free'>))
  );
}

export function formatMoneyFromCents(cents: number, currency = 'usd'): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency.toUpperCase(),
    minimumFractionDigits: 0,
    maximumFractionDigits: 2
  }).format(cents / 100);
}
