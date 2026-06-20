/**
 * Central billing configuration for EverittOS.
 * Stripe price and product IDs must be supplied via environment variables.
 */
import type { PlanTierId } from '@/lib/plan-config';
import { getPlanConfig } from '@/lib/plan-config';
import type { EverittosPlan } from '@/lib/everittos-plans';
import { sanitizeBillingEnvValue } from '@/lib/billing-env';

export type PaidPlanKey = Exclude<EverittosPlan, 'free'>;

export type BillingCheckoutMethod = 'session';

export type BillingPlanDefinition = {
  id: EverittosPlan;
  name: string;
  priceLabel: string;
  priceCents: number;
  headline: string;
  features: string[];
  limits: string[];
  buttonLabel: string;
  featured?: boolean;
};

/** Ordered plan ladder shown on billing/pricing pages (includes Free). */
export const BILLING_PLAN_ORDER: EverittosPlan[] = [
  'free',
  'pro',
  'business',
  'starter',
  'growth',
  'enterprise'
];

export const PAID_BILLING_PLAN_ORDER: PaidPlanKey[] = BILLING_PLAN_ORDER.filter(
  (id): id is PaidPlanKey => id !== 'free'
);

export const STRIPE_PRICE_ENV_KEYS: Record<PaidPlanKey, string> = {
  pro: 'STRIPE_PRICE_PRO',
  business: 'STRIPE_PRICE_BUSINESS',
  starter: 'STRIPE_PRICE_STARTER',
  growth: 'STRIPE_PRICE_GROWTH',
  enterprise: 'STRIPE_PRICE_ENTERPRISE'
};

export const STRIPE_PRODUCT_ENV_KEYS: Record<PaidPlanKey, string> = {
  pro: 'STRIPE_PRODUCT_PRO',
  business: 'STRIPE_PRODUCT_BUSINESS',
  starter: 'STRIPE_PRODUCT_STARTER',
  growth: 'STRIPE_PRODUCT_GROWTH',
  enterprise: 'STRIPE_PRODUCT_ENTERPRISE'
};

/** Monthly list prices in cents for display and amount-based webhook fallback. */
export const BILLING_PLAN_AMOUNT_CENTS: Record<PaidPlanKey, number> = {
  pro: 900,
  business: 3900,
  starter: 14900,
  growth: 39900,
  enterprise: 79900
};

export const BILLING_PLANS: BillingPlanDefinition[] = [
  {
    id: 'free',
    name: 'Free',
    priceLabel: '$0/month',
    priceCents: 0,
    headline: 'Track jobs and customers without spreadsheets.',
    features: [
      'Account and login',
      'Dashboard',
      'Customer management',
      'Basic job tracking',
      'Schedule and notifications',
      'Ask Everitt search (limited)',
      'Basic photo uploads'
    ],
    limits: ['3 active jobs', '10 customers', '20 photos', '1 user'],
    buttonLabel: 'Current plan'
  },
  {
    id: 'pro',
    name: 'Pro',
    priceLabel: '$9/month',
    priceCents: 900,
    headline: 'Before/after photos, reports, bookings, and professional job records.',
    features: [
      'Everything in Free',
      'Bookings & appointments',
      'Before and after photos',
      'Standard reports',
      'Expanded jobs and customers',
      'Ask Everitt search on every plan'
    ],
    limits: ['25 active jobs', '100 customers', '100 photos', '3 users'],
    buttonLabel: 'Choose Pro',
    featured: true
  },
  {
    id: 'business',
    name: 'Business',
    priceLabel: '$39/month',
    priceCents: 3900,
    headline: 'Team management, crew assignment, activity log, and Everitt AI.',
    features: [
      'Everything in Pro',
      'Team & crew management',
      'Job assignments',
      'Activity log',
      'Everitt AI writing & analysis',
      'Advanced reporting'
    ],
    limits: ['150 active jobs', '1,000 customers', '15 users'],
    buttonLabel: 'Choose Business'
  },
  {
    id: 'starter',
    name: 'Starter',
    priceLabel: '$149/month',
    priceCents: 14900,
    headline: 'Scale tier with higher limits for growing teams that need more capacity.',
    features: [
      'Everything in Business',
      'Higher job and customer limits',
      'More team members',
      'Everitt AI included',
      'Branded reports',
      'Multi-location basics'
    ],
    limits: ['500 active jobs', '5,000 customers', '50 users'],
    buttonLabel: 'Choose Starter'
  },
  {
    id: 'growth',
    name: 'Growth',
    priceLabel: '$399/month',
    priceCents: 39900,
    headline: 'Workflows, portals, API access, and priority support for larger teams.',
    features: [
      'Everything in Starter',
      'Workflows',
      'Client & contractor portals',
      'Departments',
      'API access',
      'Priority support'
    ],
    limits: ['2,500 active jobs', '25,000 customers', '250 users'],
    buttonLabel: 'Choose Growth'
  },
  {
    id: 'enterprise',
    name: 'Enterprise',
    priceLabel: '$799/month',
    priceCents: 79900,
    headline: 'Unlimited scale, unlimited Everitt AI, and dedicated support.',
    features: [
      'Everything in Growth',
      'Unlimited Everitt AI',
      'Enterprise permissions',
      'Dedicated support',
      'Custom reporting',
      'Unlimited jobs, customers, and users'
    ],
    limits: ['Unlimited jobs', 'Unlimited customers', 'Unlimited users'],
    buttonLabel: 'Choose Enterprise'
  }
];

export function stripePriceEnvKey(plan: PaidPlanKey): string {
  return STRIPE_PRICE_ENV_KEYS[plan];
}

export function stripeProductEnvKey(plan: PaidPlanKey): string {
  return STRIPE_PRODUCT_ENV_KEYS[plan];
}

export function billingPlanDefinition(plan: EverittosPlan): BillingPlanDefinition | undefined {
  return BILLING_PLANS.find((row) => row.id === plan);
}

export function resolveStripePriceId(plan: PaidPlanKey): string | null {
  const envKey = STRIPE_PRICE_ENV_KEYS[plan];
  const envValue = sanitizeBillingEnvValue(process.env[envKey]);
  return envValue || null;
}

export function stripeProductIdForPlan(plan: PaidPlanKey): string | null {
  const envKey = STRIPE_PRODUCT_ENV_KEYS[plan];
  const envValue = sanitizeBillingEnvValue(process.env[envKey]);
  return envValue || null;
}

export function isPaidBillingPlan(plan: string): plan is PaidPlanKey {
  return plan in BILLING_PLAN_AMOUNT_CENTS;
}

export function billingCheckoutMethod(plan: PaidPlanKey): BillingCheckoutMethod | null {
  if (resolveStripePriceId(plan)) return 'session';
  return null;
}

export function billingPlanCheckoutTarget(plan: PaidPlanKey): {
  plan: PaidPlanKey;
  priceId: string | null;
  method: BillingCheckoutMethod | null;
  buttonLabel: string;
  available: boolean;
} {
  const definition = billingPlanDefinition(plan);
  const priceId = resolveStripePriceId(plan);
  const method = billingCheckoutMethod(plan);

  return {
    plan,
    priceId,
    method,
    buttonLabel: definition?.buttonLabel || `Choose ${definition?.name || plan}`,
    available: method !== null
  };
}

export function billingCheckoutAvailable(plan: PaidPlanKey): boolean {
  return billingCheckoutMethod(plan) !== null;
}

export function anyBillingCheckoutAvailable(): boolean {
  return PAID_BILLING_PLAN_ORDER.some((plan) => billingCheckoutAvailable(plan));
}

export function allSessionCheckoutConfigured(): boolean {
  return PAID_BILLING_PLAN_ORDER.every((plan) => Boolean(resolveStripePriceId(plan)));
}

/** Map a Stripe price ID to an internal plan key using configured env price IDs. */
export function planFromKnownStripePriceId(priceId: string | null | undefined): EverittosPlan | null {
  const id = (priceId || '').trim();
  if (!id) return null;

  for (const plan of PAID_BILLING_PLAN_ORDER) {
    if (resolveStripePriceId(plan) === id) return plan;
  }

  return null;
}

export function planFromKnownStripeProductId(productId: string | null | undefined): EverittosPlan | null {
  const id = (productId || '').trim();
  if (!id) return null;

  for (const plan of PAID_BILLING_PLAN_ORDER) {
    if (stripeProductIdForPlan(plan) === id) return plan;
  }

  return null;
}

export function planFromBillingAmount(amount: number | null | undefined): EverittosPlan | null {
  const cents = amount || 0;
  if (cents === 900 || cents === 9) return 'pro';
  if (cents === 3900 || cents === 39) return 'business';
  if (cents === 14900 || cents === 149) return 'starter';
  if (cents === 39900 || cents === 399) return 'growth';
  if (cents === 79900 || cents === 799) return 'enterprise';
  return null;
}

/** Lowest paid tier that includes Everitt AI (from plan-config feature flags). */
export function minimumAiUpgradePlan(): EverittosPlan {
  for (const plan of PAID_BILLING_PLAN_ORDER) {
    if (getPlanConfig(plan as PlanTierId).aiAccess) return plan;
  }
  return 'business';
}

export function plansWithEverittAi(): EverittosPlan[] {
  return BILLING_PLAN_ORDER.filter((plan) => plan !== 'free' && getPlanConfig(plan as PlanTierId).aiAccess);
}

export function billingPlanRank(plan: EverittosPlan): number {
  const index = BILLING_PLAN_ORDER.indexOf(plan);
  return index >= 0 ? index : 0;
}
