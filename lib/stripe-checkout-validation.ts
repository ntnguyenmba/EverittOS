import Stripe from 'stripe';
import { BILLING_PLAN_AMOUNT_CENTS, type PaidPlanKey } from '@/lib/billing-config';
import { maskStripeId } from '@/lib/billing-env';
import { stripeKeyMode, type StripeKeyMode } from '@/lib/stripe-mode';

export type StripePriceValidationCode =
  | 'ok'
  | 'price_not_found'
  | 'price_inactive'
  | 'price_not_recurring'
  | 'wrong_currency'
  | 'wrong_interval'
  | 'amount_mismatch'
  | 'live_test_mismatch'
  | 'stripe_api_error';

export function formatStripeError(error: unknown): {
  message: string;
  code: string | null;
  type: string | null;
  statusCode: number | null;
} {
  if (error instanceof Stripe.errors.StripeError) {
    return {
      message: error.message,
      code: error.code || null,
      type: error.type || null,
      statusCode: error.statusCode || null
    };
  }

  if (error instanceof Error) {
    return {
      message: error.message,
      code: null,
      type: null,
      statusCode: null
    };
  }

  return {
    message: 'Unknown Stripe error',
    code: null,
    type: null,
    statusCode: null
  };
}

function isResourceMissingError(error: unknown): boolean {
  if (!(error instanceof Stripe.errors.StripeError)) return false;
  if (error.code === 'resource_missing') return true;
  return /no such price/i.test(error.message);
}

function priceModeMismatch(keyMode: StripeKeyMode, priceLivemode: boolean): boolean {
  if (keyMode === 'live') return !priceLivemode;
  if (keyMode === 'test') return priceLivemode;
  return false;
}

export async function validateStripeSubscriptionPrice(
  stripe: Stripe,
  priceId: string
): Promise<{ ok: true; price: Stripe.Price } | { ok: false; error: string; code: StripePriceValidationCode }> {
  const result = await validateStripeSubscriptionPriceForPlan(stripe, priceId, null);
  if (result.ok) {
    return { ok: true, price: result.price };
  }
  return { ok: false, error: result.message, code: result.code };
}

export async function validateStripeSubscriptionPriceForPlan(
  stripe: Stripe,
  priceId: string,
  plan: PaidPlanKey | null,
  options?: { secretKey?: string | null }
): Promise<
  | {
      ok: true;
      price: Stripe.Price;
      stripeMode: StripeKeyMode;
      pricePreview: string;
    }
  | {
      ok: false;
      code: StripePriceValidationCode;
      message: string;
      stripeCode?: string | null;
      pricePreview: string;
    }
> {
  const pricePreview = maskStripeId(priceId) || priceId;
  const keyMode = stripeKeyMode(options?.secretKey || process.env.STRIPE_SECRET_KEY);

  try {
    const price = await stripe.prices.retrieve(priceId, { expand: ['product'] });

    if (keyMode !== 'unknown' && priceModeMismatch(keyMode, price.livemode)) {
      return {
        ok: false,
        code: 'live_test_mismatch',
        message: `Stripe price ${pricePreview} is ${price.livemode ? 'live' : 'test'} mode but STRIPE_SECRET_KEY is ${keyMode} mode.`,
        pricePreview
      };
    }

    if (!price.active) {
      return {
        ok: false,
        code: 'price_inactive',
        message: `Stripe price ${pricePreview} is inactive.`,
        pricePreview
      };
    }

    if (price.type !== 'recurring') {
      return {
        ok: false,
        code: 'price_not_recurring',
        message: `Stripe price ${pricePreview} must be recurring for subscriptions.`,
        pricePreview
      };
    }

    if ((price.currency || '').toLowerCase() !== 'usd') {
      return {
        ok: false,
        code: 'wrong_currency',
        message: `Stripe price ${pricePreview} must use USD currency (found ${price.currency}).`,
        pricePreview
      };
    }

    if (price.recurring?.interval !== 'month') {
      return {
        ok: false,
        code: 'wrong_interval',
        message: `Stripe price ${pricePreview} must bill monthly (found interval=${price.recurring?.interval || 'none'}).`,
        pricePreview
      };
    }

    if (plan) {
      const expectedAmount = BILLING_PLAN_AMOUNT_CENTS[plan];
      const actualAmount = price.unit_amount;
      if (actualAmount !== expectedAmount) {
        return {
          ok: false,
          code: 'amount_mismatch',
          message: `Stripe price ${pricePreview} amount is ${actualAmount ?? 'unknown'} cents; expected ${expectedAmount} cents for ${plan}.`,
          pricePreview
        };
      }
    }

    return {
      ok: true,
      price,
      stripeMode: keyMode,
      pricePreview
    };
  } catch (error) {
    const formatted = formatStripeError(error);
    if (isResourceMissingError(error)) {
      const mismatchHint =
        keyMode !== 'unknown'
          ? ` Check that ${pricePreview} exists in ${keyMode} mode and matches STRIPE_SECRET_KEY.`
          : '';
      return {
        ok: false,
        code: keyMode === 'unknown' ? 'price_not_found' : 'live_test_mismatch',
        message: `${formatted.message}.${mismatchHint}`.trim(),
        stripeCode: formatted.code,
        pricePreview
      };
    }

    return {
      ok: false,
      code: 'stripe_api_error',
      message: formatted.message,
      stripeCode: formatted.code,
      pricePreview
    };
  }
}

export function isStripeCheckoutSessionUrl(url: string | null | undefined): boolean {
  if (!url) return false;
  try {
    const parsed = new URL(url);
    return parsed.hostname === 'checkout.stripe.com';
  } catch {
    return false;
  }
}
