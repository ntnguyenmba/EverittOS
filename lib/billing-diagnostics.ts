import Stripe from 'stripe';
import {
  BILLING_PLAN_AMOUNT_CENTS,
  PAID_BILLING_PLAN_ORDER,
  resolveStripePriceId,
  stripePriceEnvKey,
  stripeProductEnvKey,
  stripeProductIdForPlan,
  type PaidPlanKey
} from '@/lib/billing-config';
import { stripeKeyMode, stripeKeyModeLabel } from '@/lib/stripe-mode';
import { getStripeSecretKey } from '@/lib/stripe-server';
import {
  validateStripeSubscriptionPriceForPlan,
  type StripePriceValidationCode
} from '@/lib/stripe-checkout-validation';
import { maskStripeId } from '@/lib/billing-env';

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
  validationCode?: StripePriceValidationCode | 'missing_env';
  validationMessage?: string | null;
  stripeValidated?: boolean;
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

export async function billingPlanStripeDiagnostics(stripe: Stripe | null): Promise<BillingPlanDiagnostic[]> {
  const secretKey = getStripeSecretKey();
  const baseRows = billingPlanDiagnostics();

  if (!stripe) {
    return baseRows.map((row) => ({
      ...row,
      checkoutAvailable: false,
      stripeValidated: false,
      validationCode: row.priceIdConfigured ? undefined : 'missing_env',
      validationMessage: row.priceIdConfigured ? 'Stripe client unavailable' : `Set ${row.priceEnvKey} in server env.`
    }));
  }

  const validated: BillingPlanDiagnostic[] = [];
  for (const row of baseRows) {
    const priceId = resolveStripePriceId(row.plan);
    if (!priceId) {
      validated.push({
        ...row,
        checkoutAvailable: false,
        stripeValidated: true,
        validationCode: 'missing_env',
        validationMessage: `Missing ${row.priceEnvKey}.`
      });
      continue;
    }

    const result = await validateStripeSubscriptionPriceForPlan(stripe, priceId, row.plan, {
      secretKey
    });

    if (result.ok) {
      validated.push({
        ...row,
        checkoutAvailable: true,
        stripeValidated: true,
        validationCode: 'ok',
        validationMessage: null
      });
      continue;
    }

    validated.push({
      ...row,
      checkoutAvailable: false,
      stripeValidated: true,
      validationCode: result.code,
      validationMessage: result.message
    });
  }

  return validated;
}

export function stripeEnvironmentDiagnostics() {
  const secretKey = getStripeSecretKey();
  const mode = stripeKeyMode(secretKey);
  return {
    stripeSecretKeyConfigured: Boolean(secretKey),
    stripePublishableKeyConfigured: Boolean(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY?.trim()),
    stripeWebhookSecretConfigured: Boolean(process.env.STRIPE_WEBHOOK_SECRET?.trim()),
    stripeKeyMode: mode,
    stripeKeyModeLabel: stripeKeyModeLabel(mode),
    stripeSecretKeyPreview: secretKey ? `${secretKey.slice(0, 7)}…${secretKey.slice(-4)}` : null
  };
}
