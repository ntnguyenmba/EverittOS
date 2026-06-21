import Stripe from 'stripe';
import { BILLING_PLAN_AMOUNT_CENTS, type PaidPlanKey } from '@/lib/billing-config';
import { maskStripeId } from '@/lib/billing-env';
import { PRODUCTION_APP_ORIGIN } from '@/lib/app-url';
import { stripeKeyMode, type StripeKeyMode } from '@/lib/stripe-mode';

export type CheckoutSessionStringValidationCode =
  | 'invalid_price_id'
  | 'invalid_success_url'
  | 'invalid_cancel_url'
  | 'invalid_app_origin'
  | 'invalid_env_format';

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

export function parseHttpsUrl(url: string | null | undefined): URL | null {
  if (!url) return null;
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'https:') return null;
    return parsed;
  } catch {
    return null;
  }
}

export function safeCheckoutUrlHostname(url: string | null | undefined): string | null {
  return parseHttpsUrl(url)?.hostname ?? null;
}

function rawEnvHasFormattingIssues(raw: string | undefined | null): boolean {
  if (!raw) return false;
  if (raw !== raw.trim()) return true;
  if (/[\r\n]/.test(raw)) return true;
  if (
    (raw.startsWith('"') && raw.endsWith('"')) ||
    (raw.startsWith("'") && raw.endsWith("'"))
  ) {
    return true;
  }
  return false;
}

function looksLikeStripePaymentLink(value: string): boolean {
  return /buy\.stripe\.com/i.test(value) || /^https?:\/\//i.test(value);
}

export function isProductionDeployment(): boolean {
  return process.env.VERCEL_ENV === 'production' || process.env.NODE_ENV === 'production';
}

export function validateCheckoutSessionInputs(input: {
  plan: PaidPlanKey;
  priceEnvKey: string;
  priceId: string;
  rawPriceEnv: string | undefined;
  successUrl: string;
  cancelUrl: string;
  appOrigin: string;
  rawAppUrlEnvs: {
    NEXT_PUBLIC_APP_URL?: string;
    APP_URL?: string;
    NEXT_PUBLIC_SITE_URL?: string;
  };
  isProduction?: boolean;
}):
  | { ok: true }
  | { ok: false; code: CheckoutSessionStringValidationCode; message: string } {
  if (rawEnvHasFormattingIssues(input.rawPriceEnv)) {
    return {
      ok: false,
      code: 'invalid_env_format',
      message: `${input.priceEnvKey} contains surrounding quotes, whitespace, or newline characters. Set it to a bare price_… ID with no quotes.`
    };
  }

  for (const [key, raw] of Object.entries(input.rawAppUrlEnvs)) {
    if (rawEnvHasFormattingIssues(raw)) {
      return {
        ok: false,
        code: 'invalid_env_format',
        message: `${key} contains surrounding quotes, whitespace, or newline characters. Use ${PRODUCTION_APP_ORIGIN} with no quotes.`
      };
    }
  }

  if (!input.priceId || !/^price_/.test(input.priceId)) {
    const rawHint = input.rawPriceEnv || input.priceId || '';
    const message = looksLikeStripePaymentLink(rawHint)
      ? `${input.priceEnvKey} looks like a Stripe payment link or URL; set it to the Price ID (price_…), not buy.stripe.com.`
      : `${input.priceEnvKey} must start with price_ (got ${maskStripeId(input.priceId) || 'empty'}).`;
    return { ok: false, code: 'invalid_price_id', message };
  }

  if (!parseHttpsUrl(input.successUrl)) {
    return {
      ok: false,
      code: 'invalid_success_url',
      message: `success_url is not a valid https URL: ${input.successUrl}`
    };
  }

  if (!parseHttpsUrl(input.cancelUrl)) {
    return {
      ok: false,
      code: 'invalid_cancel_url',
      message: `cancel_url is not a valid https URL: ${input.cancelUrl}`
    };
  }

  if (!parseHttpsUrl(input.appOrigin)) {
    return {
      ok: false,
      code: 'invalid_app_origin',
      message: `App URL origin is not a valid https URL: ${input.appOrigin}. Set NEXT_PUBLIC_APP_URL=${PRODUCTION_APP_ORIGIN}`
    };
  }

  const isProduction = input.isProduction ?? isProductionDeployment();
  if (isProduction && input.appOrigin !== PRODUCTION_APP_ORIGIN) {
    return {
      ok: false,
      code: 'invalid_app_origin',
      message: `In production, app URL must be ${PRODUCTION_APP_ORIGIN} (got ${input.appOrigin}). Fix NEXT_PUBLIC_APP_URL / APP_URL.`
    };
  }

  return { ok: true };
}

export function isStripeCheckoutSessionUrl(url: string | null | undefined): boolean {
  const parsed = parseHttpsUrl(url || '');
  if (!parsed) return false;
  return parsed.hostname === 'checkout.stripe.com';
}
