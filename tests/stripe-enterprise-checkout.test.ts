import assert from 'node:assert/strict';
import test from 'node:test';
import { resolveStripePriceId } from '@/lib/billing-config';
import { billingPlanStripeDiagnostics } from '@/lib/billing-diagnostics';
import Stripe from 'stripe';
import { validateStripeSubscriptionPriceForPlan } from '@/lib/stripe-checkout-validation';

function makeStripeMock() {
  const amounts: Record<string, number> = {
    price_1U26yd2KsjgU9g9yjipBM4gy: 900,
    price_1TcwxB2KsjgU9g9y57f9veQh: 3900,
    price_1U27SR2KsjgU9g9ybeGRo9Iy: 7900,
    price_1U2Kge2KsjgU9g9ypMeHRfxb: 19900,
    price_1U2KlI2KsjgU9g9yeak0iPiT: 39900
  };

  return {
    prices: {
      retrieve: async (priceId: string) =>
        ({
          id: priceId,
          object: 'price',
          active: true,
          type: 'recurring',
          currency: 'usd',
          livemode: false,
          unit_amount: amounts[priceId] ?? 0,
          recurring: { interval: 'month', interval_count: 1 }
        }) as Stripe.Price
    }
  } as unknown as Stripe;
}

test('enterprise checkout resolves final canonical Stripe price', () => {
  assert.equal(resolveStripePriceId('enterprise'), 'price_1U2KlI2KsjgU9g9yeak0iPiT');
});

test('billingPlanStripeDiagnostics marks enterprise available when Stripe price validates', async () => {
  process.env.STRIPE_SECRET_KEY = 'sk_test_abc123';
  const rows = await billingPlanStripeDiagnostics(makeStripeMock());
  const enterprise = rows.find((row) => row.plan === 'enterprise');
  assert.ok(enterprise);
  assert.equal(enterprise?.checkoutAvailable, true);
  assert.equal(enterprise?.validationCode, 'ok');
});

test('successful enterprise checkout validation returns recurring monthly usd price', async () => {
  const stripe = makeStripeMock();
  const result = await validateStripeSubscriptionPriceForPlan(
    stripe,
    'price_1U2KlI2KsjgU9g9yeak0iPiT',
    'enterprise',
    { secretKey: 'sk_test_abc123' }
  );
  assert.equal(result.ok, true);
  if (result.ok) {
    assert.equal(result.price.unit_amount, 39900);
    assert.equal(result.price.recurring?.interval, 'month');
    assert.equal(result.price.currency, 'usd');
  }
});
