/**
 * Central billing configuration for EverittOS.
 * All plan display, Stripe price IDs, payment-link fallbacks, and checkout availability
 * should read from this module — not scattered across components or routes.
 */
import type { PlanTierId } from '@/lib/plan-config';
import { getPlanConfig } from '@/lib/plan-config';
import type { EverittosPlan } from '@/lib/everittos-plans';

export type PaidPlanKey = Exclude<EverittosPlan, 'free'>;

export type BillingCheckoutMethod = 'session' | 'payment_link';

export type BillingPlanStripeConfig = {
  /** Default Stripe Price ID (overridden by STRIPE_PRICE_* env when set). */
  defaultPriceId: string | null;
  /** Stripe Product ID for webhook/metadata resolution. */
  productId: string | null;
  /** Temporary fallback when no price ID is configured. */
  paymentLink: string | null;
  /** Env var name for price ID override. */
  priceEnvKey: string;
};

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
  stripe: BillingPlanStripeConfig;
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

const STRIPE_DEFAULTS: Record<PaidPlanKey, BillingPlanStripeConfig> = {
  pro: {
    defaultPriceId: null,
    productId: null,
    paymentLink: 'https://buy.stripe.com/eVq7sEcXCbX08Kn8P993y0c',
    priceEnvKey: 'STRIPE_PRICE_PRO'
  },
  business: {
    defaultPriceId: 'price_1TcwxB2KsjgU9g9y57f9veQh',
    productId: 'prod_UcBJxRbYFgf2jo',
    paymentLink: null,
    priceEnvKey: 'STRIPE_PRICE_BUSINESS'
  },
  starter: {
    defaultPriceId: null,
    productId: null,
    paymentLink: 'https://buy.stripe.com/cNi4gs8Hm3qu8Kn7L593y08',
    priceEnvKey: 'STRIPE_PRICE_STARTER'
  },
  growth: {
    defaultPriceId: 'price_1TbVfe2KsjgU9g9yMtCnJrBw',
    productId: 'prod_Uah3w3NgG6zloO',
    paymentLink: 'https://buy.stripe.com/9B6aEQcXCbX06Cf7L593y09',
    priceEnvKey: 'STRIPE_PRICE_GROWTH'
  },
  enterprise: {
    defaultPriceId: 'price_1TbViN2KsjgU9g9yUlok4S2W',
    productId: 'prod_Uah64aXMtVGGqI',
    paymentLink: 'https://buy.stripe.com/3cI6oA5va6CG5yb5CX93y0a',
    priceEnvKey: 'STRIPE_PRICE_ENTERPRISE'
  }
};

/** Known Stripe price IDs → internal plan keys (env + defaults). */
export const KNOWN_STRIPE_PRICE_TO_PLAN: Record<string, EverittosPlan> = {
  price_1TcwxB2KsjgU9g9y57f9veQh: 'business',
  price_1TbVfe2KsjgU9g9yMtCnJrBw: 'growth',
  price_1TbViN2KsjgU9g9yUlok4S2W: 'enterprise'
};

/** Known Stripe product IDs → internal plan keys. */
export const KNOWN_STRIPE_PRODUCT_TO_PLAN: Record<string, EverittosPlan> = {
  prod_UcBJxRbYFgf2jo: 'business',
  prod_Uah3w3NgG6zloO: 'growth',
  prod_Uah64aXMtVGGqI: 'enterprise'
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
    buttonLabel: 'Current plan',
    stripe: {
      defaultPriceId: null,
      productId: null,
      paymentLink: null,
      priceEnvKey: ''
    }
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
    featured: true,
    stripe: STRIPE_DEFAULTS.pro
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
    buttonLabel: 'Choose Business',
    stripe: STRIPE_DEFAULTS.business
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
    buttonLabel: 'Choose Starter',
    stripe: STRIPE_DEFAULTS.starter
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
    buttonLabel: 'Choose Growth',
    stripe: STRIPE_DEFAULTS.growth
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
    buttonLabel: 'Choose Enterprise',
    stripe: STRIPE_DEFAULTS.enterprise
  }
];

export function billingPlanDefinition(plan: EverittosPlan): BillingPlanDefinition | undefined {
  return BILLING_PLANS.find((row) => row.id === plan);
}

export function resolveStripePriceId(plan: PaidPlanKey): string | null {
  const row = STRIPE_DEFAULTS[plan];
  const envValue = row ? (process.env[row.priceEnvKey] || '').trim() : '';
  if (envValue) return envValue;
  return row?.defaultPriceId || null;
}

export function paymentLinkForPlan(plan: PaidPlanKey): string | null {
  return STRIPE_DEFAULTS[plan]?.paymentLink || null;
}

export function stripeProductIdForPlan(plan: PaidPlanKey): string | null {
  return STRIPE_DEFAULTS[plan]?.productId || null;
}

export function isPaidBillingPlan(plan: string): plan is PaidPlanKey {
  return plan in BILLING_PLAN_AMOUNT_CENTS;
}

export function billingCheckoutMethod(plan: PaidPlanKey): BillingCheckoutMethod | null {
  if (resolveStripePriceId(plan)) return 'session';
  if (paymentLinkForPlan(plan)) return 'payment_link';
  return null;
}

export function billingPlanCheckoutTarget(plan: PaidPlanKey): {
  plan: PaidPlanKey;
  priceId: string | null;
  checkoutUrl: string | null;
  method: BillingCheckoutMethod | null;
  buttonLabel: string;
  available: boolean;
} {
  const definition = billingPlanDefinition(plan);
  const priceId = resolveStripePriceId(plan);
  const checkoutUrl = paymentLinkForPlan(plan);
  const method = billingCheckoutMethod(plan);

  return {
    plan,
    priceId,
    checkoutUrl,
    method,
    buttonLabel: definition?.buttonLabel || `Choose ${planDisplayName(plan)}`,
    available: method !== null
  };
}

function planDisplayName(plan: EverittosPlan): string {
  return billingPlanDefinition(plan)?.name || plan;
}

/**
 * Client-safe checkout resolution using baked-in defaults only.
 * Use this in browser components so availability does not depend on server env vars.
 */
export function clientBillingCheckoutTarget(plan: PaidPlanKey): {
  plan: PaidPlanKey;
  priceId: string | null;
  checkoutUrl: string | null;
  method: BillingCheckoutMethod | null;
  buttonLabel: string;
  available: boolean;
} {
  const definition = billingPlanDefinition(plan);
  const defaults = STRIPE_DEFAULTS[plan];
  const priceId = defaults.defaultPriceId;
  const checkoutUrl = defaults.paymentLink;
  const method: BillingCheckoutMethod | null = priceId ? 'session' : checkoutUrl ? 'payment_link' : null;

  return {
    plan,
    priceId,
    checkoutUrl,
    method,
    buttonLabel: definition?.buttonLabel || `Choose ${definition?.name || plan}`,
    available: method !== null
  };
}

export function clientBillingCheckoutAvailable(plan: PaidPlanKey): boolean {
  return clientBillingCheckoutTarget(plan).available;
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

/** Map a Stripe price ID to an internal plan key. */
export function planFromKnownStripePriceId(priceId: string | null | undefined): EverittosPlan | null {
  const id = (priceId || '').trim();
  if (!id) return null;

  for (const plan of PAID_BILLING_PLAN_ORDER) {
    if (resolveStripePriceId(plan) === id) return plan;
  }

  return KNOWN_STRIPE_PRICE_TO_PLAN[id] || null;
}

export function planFromKnownStripeProductId(productId: string | null | undefined): EverittosPlan | null {
  const id = (productId || '').trim();
  if (!id) return null;
  return KNOWN_STRIPE_PRODUCT_TO_PLAN[id] || null;
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
