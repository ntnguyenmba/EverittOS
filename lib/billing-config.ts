/**
 * Central billing configuration for EverittOS.
 * Canonical Stripe product and price IDs are stored here so checkout does not
 * depend on stale deployment environment variables.
 */
import type { PlanTierId } from '@/lib/plan-config';
import { getPlanConfig } from '@/lib/plan-config';
import type { EverittosPlan } from '@/lib/everittos-plans';

export type PaidPlanKey = Exclude<EverittosPlan, 'free'>;

type ExternalReRootPlan = 'report' | 'monthly' | 'yearly';

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

export const STRIPE_PRICE_IDS: Record<PaidPlanKey, string> = {
  pro: 'price_1U26yd2KsjgU9g9yjipBM4gy',
  business: 'price_1TcwxB2KsjgU9g9y57f9veQh',
  starter: 'price_1U27SR2KsjgU9g9ybeGRo9Iy',
  growth: 'price_1U2Kge2KsjgU9g9ypMeHRfxb',
  enterprise: 'price_1U2KlI2KsjgU9g9yeak0iPiT'
};

export const STRIPE_PRODUCT_IDS: Record<PaidPlanKey, string> = {
  pro: 'prod_UcTW6bzlGX2eEu',
  business: 'prod_UcBJxRbYFgf2jo',
  starter: 'prod_Uah29K2LrfDj5h',
  growth: 'prod_Uah3w3NgG6zloO',
  enterprise: 'prod_Uah64aXMtVGGqI'
};

const REROOT_STRIPE_PRICE_ENV_KEYS: Record<ExternalReRootPlan, string> = {
  report: 'REROOT_STRIPE_PRICE_REPORT',
  monthly: 'REROOT_STRIPE_PRICE_MONTHLY',
  yearly: 'REROOT_STRIPE_PRICE_YEARLY'
};

const REROOT_STRIPE_PRODUCT_ENV_KEYS: Record<ExternalReRootPlan, string> = {
  report: 'REROOT_STRIPE_PRODUCT_REPORT',
  monthly: 'REROOT_STRIPE_PRODUCT_MONTHLY',
  yearly: 'REROOT_STRIPE_PRODUCT_YEARLY'
};

export const BILLING_PLAN_AMOUNT_CENTS: Record<PaidPlanKey, number> = {
  pro: 900,
  business: 3900,
  starter: 7900,
  growth: 19900,
  enterprise: 39900
};

export const BILLING_PLANS: BillingPlanDefinition[] = [
  {
    id: 'free',
    name: 'Free',
    priceLabel: '$0/month',
    priceCents: 0,
    headline: 'Core job and customer tools for getting started.',
    features: [
      'Account and login',
      'Dashboard',
      'Customer management',
      'Basic job tracking',
      'Schedule and notifications',
      'Basic photo uploads'
    ],
    limits: ['3 active jobs', '10 customers', '20 photos', '1 user', '1 location'],
    buttonLabel: 'Current plan'
  },
  {
    id: 'pro',
    name: 'Pro',
    priceLabel: '$9/month',
    priceCents: 900,
    headline: 'Bookings, before-and-after photos, and professional job management.',
    features: [
      'Everything in Free',
      'Bookings and appointments',
      'Before-and-after photos',
      'PDF reports',
      'Expanded job and customer limits'
    ],
    limits: ['25 active jobs', '100 customers', '100 photos', '3 users', '25 reports', '1 location'],
    buttonLabel: 'Choose Pro',
    featured: true
  },
  {
    id: 'business',
    name: 'Business',
    priceLabel: '$39/month',
    priceCents: 3900,
    headline: 'Team management, crew assignment, reporting, and Everitt AI.',
    features: [
      'Everything in Pro',
      'Team and crew management',
      'Job assignments',
      'Activity log',
      'Everitt AI writing and analysis',
      'Advanced reporting'
    ],
    limits: ['150 active jobs', '1,000 customers', 'Unlimited photos', '15 team members', '100 crew members', '150 reports', '1 location'],
    buttonLabel: 'Choose Business'
  },
  {
    id: 'starter',
    name: 'Starter',
    priceLabel: '$79/month',
    priceCents: 7900,
    headline: 'Higher limits, multi-location support, and branded reporting for growing teams.',
    features: [
      'Everything in Business',
      'Multi-location management',
      'Custom branding',
      'Branded reports',
      'Higher team and usage limits'
    ],
    limits: ['500 active jobs', '5,000 customers', 'Unlimited photos', '50 team members', '200 crew members', '500 reports', '5 locations'],
    buttonLabel: 'Choose Starter'
  },
  {
    id: 'growth',
    name: 'Growth',
    priceLabel: '$199/month',
    priceCents: 19900,
    headline: 'Workflows, portals, API access, and priority support for larger operations.',
    features: [
      'Everything in Starter',
      'Custom workflows',
      'Client and contractor portals',
      'API access',
      'Priority support'
    ],
    limits: ['2,500 active jobs', '25,000 customers', 'Unlimited photos', '250 team members', 'Unlimited crew members', '2,500 reports', '25 locations'],
    buttonLabel: 'Choose Growth'
  },
  {
    id: 'enterprise',
    name: 'Enterprise',
    priceLabel: '$399/month',
    priceCents: 39900,
    headline: 'Unlimited scale, unlimited Everitt AI, enterprise permissions, and dedicated support.',
    features: [
      'Everything in Growth',
      'Unlimited Everitt AI',
      'Enterprise permissions',
      'Dedicated support',
      'Unlimited operational limits'
    ],
    limits: ['Unlimited jobs', 'Unlimited customers', 'Unlimited photos', 'Unlimited team members', 'Unlimited crew members', 'Unlimited reports', 'Unlimited locations'],
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

export function resolveStripePriceId(plan: PaidPlanKey): string {
  return STRIPE_PRICE_IDS[plan];
}

export function stripeProductIdForPlan(plan: PaidPlanKey): string {
  return STRIPE_PRODUCT_IDS[plan];
}

function resolveExternalReRootPriceId(plan: ExternalReRootPlan): string | null {
  return (process.env[REROOT_STRIPE_PRICE_ENV_KEYS[plan]] || '').trim() || null;
}

function resolveExternalReRootProductId(plan: ExternalReRootPlan): string | null {
  return (process.env[REROOT_STRIPE_PRODUCT_ENV_KEYS[plan]] || '').trim() || null;
}

function asExternalPlan(plan: ExternalReRootPlan): EverittosPlan {
  return plan as unknown as EverittosPlan;
}

export function isPaidBillingPlan(plan: string): plan is PaidPlanKey {
  return plan in BILLING_PLAN_AMOUNT_CENTS;
}

export function billingCheckoutMethod(plan: PaidPlanKey): BillingCheckoutMethod {
  return resolveStripePriceId(plan) ? 'session' : 'session';
}

export function billingPlanCheckoutTarget(plan: PaidPlanKey): {
  plan: PaidPlanKey;
  priceId: string;
  method: BillingCheckoutMethod;
  buttonLabel: string;
  available: boolean;
} {
  const definition = billingPlanDefinition(plan);
  const priceId = resolveStripePriceId(plan);

  return {
    plan,
    priceId,
    method: 'session',
    buttonLabel: definition?.buttonLabel || `Choose ${definition?.name || plan}`,
    available: true
  };
}

export function billingCheckoutAvailable(_plan: PaidPlanKey): boolean {
  return true;
}

export function anyBillingCheckoutAvailable(): boolean {
  return true;
}

export function allSessionCheckoutConfigured(): boolean {
  return true;
}

export function planFromKnownStripePriceId(priceId: string | null | undefined): EverittosPlan | null {
  const id = (priceId || '').trim();
  if (!id) return null;

  for (const plan of PAID_BILLING_PLAN_ORDER) {
    if (STRIPE_PRICE_IDS[plan] === id) return plan;
  }

  for (const plan of Object.keys(REROOT_STRIPE_PRICE_ENV_KEYS) as ExternalReRootPlan[]) {
    if (resolveExternalReRootPriceId(plan) === id) return asExternalPlan(plan);
  }

  return null;
}

export function planFromKnownStripeProductId(productId: string | null | undefined): EverittosPlan | null {
  const id = (productId || '').trim();
  if (!id) return null;

  for (const plan of PAID_BILLING_PLAN_ORDER) {
    if (STRIPE_PRODUCT_IDS[plan] === id) return plan;
  }

  for (const plan of Object.keys(REROOT_STRIPE_PRODUCT_ENV_KEYS) as ExternalReRootPlan[]) {
    if (resolveExternalReRootProductId(plan) === id) return asExternalPlan(plan);
  }

  return null;
}

export function planFromBillingAmount(amount: number | null | undefined): EverittosPlan | null {
  const cents = amount || 0;
  if (cents === 900 || cents === 9) return 'pro';
  if (cents === 3900 || cents === 39) return 'business';
  if (cents === 7900 || cents === 79) return 'starter';
  if (cents === 19900 || cents === 199) return 'growth';
  if (cents === 39900 || cents === 399) return 'enterprise';
  return null;
}

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
