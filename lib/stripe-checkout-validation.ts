import Stripe from 'stripe';

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

export async function validateStripeSubscriptionPrice(
  stripe: Stripe,
  priceId: string
): Promise<{ ok: true; price: Stripe.Price } | { ok: false; error: string }> {
  try {
    const price = await stripe.prices.retrieve(priceId, { expand: ['product'] });
    if (!price.active) {
      return { ok: false, error: `Stripe price ${priceId} is inactive.` };
    }
    if (price.type !== 'recurring') {
      return { ok: false, error: `Stripe price ${priceId} must be recurring for subscriptions.` };
    }
    return { ok: true, price };
  } catch (error) {
    const formatted = formatStripeError(error);
    return {
      ok: false,
      error: formatted.message
    };
  }
}
