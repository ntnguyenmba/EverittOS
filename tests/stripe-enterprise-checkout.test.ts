import assert from 'node:assert/strict';
import test from 'node:test';
import { resolveStripePriceId } from '@/lib/billing-config';
import { billingPlanStripeDiagnostics } from '@/lib/billing-diagnostics';
import Stripe from 'stripe';
import { validateStripeSubscriptionPriceForPlan } from '@/lib/stripe-checkout-validation';

const ORIGINAL_ENV = { ...process.env };

function restoreEnv() {
  for (const key of Object.keys(process.env)) {
    if (!(key in ORIGINAL_ENV)) delete process.env[key];
  }
  Object.assign(process.env, ORIGINAL_ENV);
}

function makeStripeMock() {
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
          unit_amount:
            priceId === 'price_test_pro'
              ? 900
              : priceId === 'price_test_business'
                ? 3900
                : priceId === 'price_test_starter'
                  ? 14900
                  : priceId === 'price_test_growth'
                    ? 39900
                    : 79900,
          recurring: { interval: 'month', interval_count: 1 }
        }) as Stripe.Price
    }
  } as unknown as Stripe;
}

test('enterprise checkout resolves quoted STRIPE_PRICE_ENTERPRISE env value', () => {
  restoreEnv();
  process.env.STRIPE_PRICE_ENTERPRISE = '"price_1TbViN2KsjgU9g9yUlok4S2W"';
  assert.equal(resolveStripePriceId('enterprise'), 'price_1TbViN2KsjgU9g9yUlok4S2W');
  restoreEnv();
});

test('billingPlanStripeDiagnostics marks enterprise available when Stripe price validates', async () => {
  restoreEnv();
  process.env.STRIPE_SECRET_KEY = 'sk_test_abc123';
  process.env.STRIPE_PRICE_ENTERPRISE = 'price_test_enterprise';
  const rows = await billingPlanStripeDiagnostics(makeStripeMock());
  const enterprise = rows.find((row) => row.plan === 'enterprise');
  assert.ok(enterprise);
  assert.equal(enterprise?.checkoutAvailable, true);
  assert.equal(enterprise?.validationCode, 'ok');
  restoreEnv();
});

test('billingPlanStripeDiagnostics marks enterprise unavailable when env missing', async () => {
  restoreEnv();
  delete process.env.STRIPE_PRICE_ENTERPRISE;
  const rows = await billingPlanStripeDiagnostics(makeStripeMock());
  const enterprise = rows.find((row) => row.plan === 'enterprise');
  assert.equal(enterprise?.checkoutAvailable, false);
  assert.equal(enterprise?.validationCode, 'missing_env');
  restoreEnv();
});

test('successful enterprise checkout validation returns recurring monthly usd price', async () => {
  const stripe = makeStripeMock();
  const result = await validateStripeSubscriptionPriceForPlan(
    stripe,
    'price_test_enterprise',
    'enterprise',
    { secretKey: 'sk_test_abc123' }
  );
  assert.equal(result.ok, true);
  if (result.ok) {
    assert.equal(result.price.unit_amount, 79900);
    assert.equal(result.price.recurring?.interval, 'month');
    assert.equal(result.price.currency, 'usd');
  }
});
