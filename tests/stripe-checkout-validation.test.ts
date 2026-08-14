import assert from 'node:assert/strict';
import test from 'node:test';
import Stripe from 'stripe';
import {
  formatStripeError,
  isStripeCheckoutSessionUrl,
  validateStripeSubscriptionPriceForPlan
} from '@/lib/stripe-checkout-validation';

function makeStripeMock(retrieveImpl: (priceId: string) => Promise<Stripe.Price> | Stripe.Price) {
  return {
    prices: {
      retrieve: async (priceId: string) => retrieveImpl(priceId)
    }
  } as unknown as Stripe;
}

function enterprisePrice(overrides: Partial<Stripe.Price> = {}): Stripe.Price {
  return {
    id: 'price_enterprise_test',
    object: 'price',
    active: true,
    type: 'recurring',
    currency: 'usd',
    livemode: false,
    unit_amount: 39900,
    recurring: { interval: 'month', interval_count: 1 } as Stripe.Price.Recurring,
    ...overrides
  } as Stripe.Price;
}

test('formatStripeError returns message for generic errors', () => {
  const formatted = formatStripeError(new Error('No such price: price_invalid'));
  assert.match(formatted.message, /No such price/);
});

test('validateStripeSubscriptionPriceForPlan accepts valid enterprise price', async () => {
  const stripe = makeStripeMock(() => enterprisePrice());
  const result = await validateStripeSubscriptionPriceForPlan(
    stripe,
    'price_enterprise_test',
    'enterprise',
    { secretKey: 'sk_test_abc123' }
  );
  assert.equal(result.ok, true);
  if (result.ok) {
    assert.equal(result.stripeMode, 'test');
  }
});

test('validateStripeSubscriptionPriceForPlan rejects missing enterprise env price', async () => {
  const stripe = makeStripeMock(async () => {
    throw new Stripe.errors.StripeInvalidRequestError({
      type: 'invalid_request_error',
      message: "No such price: 'price_missing'",
      code: 'resource_missing'
    });
  });

  const result = await validateStripeSubscriptionPriceForPlan(
    stripe,
    'price_missing',
    'enterprise',
    { secretKey: 'sk_live_abc123' }
  );
  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(result.code, 'live_test_mismatch');
  }
});

test('validateStripeSubscriptionPriceForPlan rejects inactive enterprise price', async () => {
  const stripe = makeStripeMock(() => enterprisePrice({ active: false }));
  const result = await validateStripeSubscriptionPriceForPlan(
    stripe,
    'price_enterprise_test',
    'enterprise',
    { secretKey: 'sk_test_abc123' }
  );
  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.code, 'price_inactive');
});

test('validateStripeSubscriptionPriceForPlan rejects non-recurring enterprise price', async () => {
  const stripe = makeStripeMock(() => enterprisePrice({ type: 'one_time' }));
  const result = await validateStripeSubscriptionPriceForPlan(
    stripe,
    'price_enterprise_test',
    'enterprise',
    { secretKey: 'sk_test_abc123' }
  );
  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.code, 'price_not_recurring');
});

test('validateStripeSubscriptionPriceForPlan rejects enterprise amount mismatch', async () => {
  const stripe = makeStripeMock(() => enterprisePrice({ unit_amount: 799 }));
  const result = await validateStripeSubscriptionPriceForPlan(
    stripe,
    'price_enterprise_test',
    'enterprise',
    { secretKey: 'sk_test_abc123' }
  );
  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(result.code, 'amount_mismatch');
    assert.match(result.message, /39900/);
  }
});

test('validateStripeSubscriptionPriceForPlan rejects live test key mismatch', async () => {
  const stripe = makeStripeMock(() => enterprisePrice({ livemode: true }));
  const result = await validateStripeSubscriptionPriceForPlan(
    stripe,
    'price_enterprise_test',
    'enterprise',
    { secretKey: 'sk_test_abc123' }
  );
  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.code, 'live_test_mismatch');
});

test('validateStripeSubscriptionPriceForPlan rejects wrong currency', async () => {
  const stripe = makeStripeMock(() => enterprisePrice({ currency: 'eur' }));
  const result = await validateStripeSubscriptionPriceForPlan(
    stripe,
    'price_enterprise_test',
    'enterprise',
    { secretKey: 'sk_test_abc123' }
  );
  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.code, 'wrong_currency');
});

test('validateStripeSubscriptionPriceForPlan rejects non-monthly interval', async () => {
  const stripe = makeStripeMock(() =>
    enterprisePrice({ recurring: { interval: 'year', interval_count: 1 } as Stripe.Price.Recurring })
  );
  const result = await validateStripeSubscriptionPriceForPlan(
    stripe,
    'price_enterprise_test',
    'enterprise',
    { secretKey: 'sk_test_abc123' }
  );
  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.code, 'wrong_interval');
});

test('isStripeCheckoutSessionUrl accepts checkout.stripe.com only', () => {
  assert.equal(
    isStripeCheckoutSessionUrl('https://checkout.stripe.com/c/pay/cs_test_abc123'),
    true
  );
  assert.equal(isStripeCheckoutSessionUrl('https://buy.stripe.com/test_abc123'), false);
  assert.equal(isStripeCheckoutSessionUrl(null), false);
});

test('successful enterprise checkout session URL must use checkout.stripe.com host', () => {
  const url = 'https://checkout.stripe.com/c/pay/cs_live_a1b2c3d4';
  assert.equal(isStripeCheckoutSessionUrl(url), true);
  assert.equal(new URL(url).hostname, 'checkout.stripe.com');
});
