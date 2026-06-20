import {
  BILLING_PLAN_AMOUNT_CENTS,
  PAID_BILLING_PLAN_ORDER,
  resolveStripePriceId,
  stripePriceEnvKey,
  stripeProductEnvKey,
  stripeProductIdForPlan,
  type PaidPlanKey
} from '@/lib/billing-config';

export function maskStripeId(id: string | null | undefined): string | null {
  const value = (id || '').trim();
  if (!value) return null;
  if (value.length <= 12) return value;
  return `${value.slice(0, 10)}…${value.slice(-4)}`;
}

export type BillingPlanDiagnostic = {
  plan: PaidPlanKey;
  displayPriceCents: number;
  priceEnvKey: string;
  productEnvKey: string;
  priceIdConfigured: boolean;
  priceIdPreview: string | null;
  productIdConfigured: boolean;
  productIdPreview: string | null;
  checkoutAvailable: boolean;
};

export function billingPlanDiagnostics(): BillingPlanDiagnostic[] {
  return PAID_BILLING_PLAN_ORDER.map((plan) => {
    const priceId = resolveStripePriceId(plan);
    const productId = stripeProductIdForPlan(plan);
    return {
      plan,
      displayPriceCents: BILLING_PLAN_AMOUNT_CENTS[plan],
      priceEnvKey: stripePriceEnvKey(plan),
      productEnvKey: stripeProductEnvKey(plan),
      priceIdConfigured: Boolean(priceId),
      priceIdPreview: maskStripeId(priceId),
      productIdConfigured: Boolean(productId),
      productIdPreview: maskStripeId(productId),
      checkoutAvailable: Boolean(priceId)
    };
  });
}

export function stripeEnvironmentDiagnostics() {
  return {
    stripeSecretKeyConfigured: Boolean(process.env.STRIPE_SECRET_KEY?.trim()),
    stripePublishableKeyConfigured: Boolean(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY?.trim()),
    stripeWebhookSecretConfigured: Boolean(process.env.STRIPE_WEBHOOK_SECRET?.trim())
  };
}
