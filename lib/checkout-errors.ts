import { billingPlanDefinition, type PaidPlanKey } from '@/lib/billing-config';
import type {
  CheckoutSessionStringValidationCode,
  StripePriceValidationCode
} from '@/lib/stripe-checkout-validation';

export function checkoutPublicErrorMessage(plan: PaidPlanKey): string {
  const planName = billingPlanDefinition(plan)?.name || plan;
  return `${planName} checkout is not configured correctly. Billing support has been notified.`;
}

export function checkoutOwnerDiagnostic(input: {
  plan: PaidPlanKey;
  code:
    | StripePriceValidationCode
    | CheckoutSessionStringValidationCode
    | 'checkout_not_configured'
    | 'stripe_not_configured'
    | 'stripe_checkout_failed'
    | 'missing_checkout_url';
  priceEnvKey?: string;
  priceIdPreview?: string | null;
  detail?: string | null;
  stripeCode?: string | null;
}): string {
  const { plan, code, priceEnvKey, priceIdPreview, detail, stripeCode } = input;
  const envKey = priceEnvKey || `STRIPE_PRICE_${plan.toUpperCase()}`;
  const preview = priceIdPreview ? ` (${priceIdPreview})` : '';

  switch (code) {
    case 'invalid_env_format':
    case 'invalid_price_id':
    case 'invalid_success_url':
    case 'invalid_cancel_url':
    case 'invalid_app_origin':
      return detail || `Checkout configuration error for ${plan}.`;
    case 'checkout_not_configured':
      return `Missing env var ${envKey} for ${plan} checkout.`;
    case 'stripe_not_configured':
      return 'STRIPE_SECRET_KEY is not configured.';
    case 'price_not_found':
      return `Invalid or missing Stripe price ID in ${envKey}${preview}. Check live/test mode matches STRIPE_SECRET_KEY.`;
    case 'live_test_mismatch':
      return `Stripe live/test mismatch for ${envKey}${preview}. Use live price IDs with sk_live_ keys and test price IDs with sk_test_ keys.`;
    case 'price_inactive':
      return `Stripe price in ${envKey}${preview} is inactive. Activate it in the Stripe Dashboard.`;
    case 'price_not_recurring':
      return `Stripe price in ${envKey}${preview} must be a recurring monthly subscription price.`;
    case 'wrong_currency':
      return `Stripe price in ${envKey}${preview} must use USD currency.`;
    case 'wrong_interval':
      return `Stripe price in ${envKey}${preview} must bill monthly (interval=month).`;
    case 'amount_mismatch':
      return detail || `Stripe price amount in ${envKey}${preview} does not match the expected ${plan} monthly price.`;
    case 'stripe_api_error':
      return detail
        ? `Stripe API error for ${envKey}${preview}: ${detail}${stripeCode ? ` (${stripeCode})` : ''}`
        : `Stripe API error for ${envKey}${preview}${stripeCode ? ` (${stripeCode})` : ''}.`;
    case 'stripe_checkout_failed':
      return detail
        ? `Stripe checkout session failed for ${plan}: ${detail}${stripeCode ? ` (${stripeCode})` : ''}`
        : `Stripe checkout session failed for ${plan}${stripeCode ? ` (${stripeCode})` : ''}.`;
    case 'missing_checkout_url':
      return detail || `Stripe checkout session for ${plan} did not return a checkout.stripe.com URL.`;
    default:
      return detail || `Checkout configuration error for ${plan}.`;
  }
}
