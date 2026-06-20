import assert from 'node:assert/strict';
import test from 'node:test';
import {
  billingCheckoutAvailable,
  billingCheckoutMethod,
  BILLING_PLAN_ORDER,
  planFromBillingAmount,
  planFromKnownStripePriceId,
  resolveStripePriceId,
  STRIPE_PRICE_ENV_KEYS
} from '@/lib/billing-config';
import { resolveBillingPlanCardUi } from '@/lib/billing-plan-card';
import { isPlanUpgrade, isPlanDowngrade } from '@/lib/billing-plan-actions';
import { normalizePlanId } from '@/lib/plan-config';
import {
  isPaidCheckoutPlan,
  paidCheckoutPlans,
  stripeCheckoutAvailableForPlan,
  stripeAnyCheckoutAvailable
} from '@/lib/stripe-prices';

const ORIGINAL_ENV = { ...process.env };

function restoreEnv() {
  for (const key of Object.keys(process.env)) {
    if (!(key in ORIGINAL_ENV)) delete process.env[key];
  }
  Object.assign(process.env, ORIGINAL_ENV);
}

function setAllStripePriceEnv() {
  process.env.STRIPE_PRICE_PRO = 'price_test_pro';
  process.env.STRIPE_PRICE_BUSINESS = 'price_test_business';
  process.env.STRIPE_PRICE_STARTER = 'price_test_starter';
  process.env.STRIPE_PRICE_GROWTH = 'price_test_growth';
  process.env.STRIPE_PRICE_ENTERPRISE = 'price_test_enterprise';
}

test('plan ladder includes all six tiers', () => {
  assert.deepEqual(BILLING_PLAN_ORDER, ['free', 'pro', 'business', 'starter', 'growth', 'enterprise']);
});

test('legacy operations alias still maps to growth', () => {
  assert.equal(normalizePlanId('operations'), 'growth');
});

test('starter is a first-class plan tier', () => {
  assert.equal(normalizePlanId('starter'), 'starter');
});

test('paid checkout plans include all five paid tiers', () => {
  assert.deepEqual(paidCheckoutPlans(), ['pro', 'business', 'starter', 'growth', 'enterprise']);
  assert.equal(isPaidCheckoutPlan('starter'), true);
  assert.equal(isPaidCheckoutPlan('free'), false);
});

test('checkout requires env price IDs for every paid plan', () => {
  restoreEnv();
  for (const plan of paidCheckoutPlans()) {
    assert.equal(billingCheckoutAvailable(plan), false, plan);
    assert.equal(resolveStripePriceId(plan), null, plan);
  }

  setAllStripePriceEnv();
  for (const plan of paidCheckoutPlans()) {
    assert.equal(billingCheckoutAvailable(plan), true, plan);
    assert.equal(billingCheckoutMethod(plan), 'session', plan);
  }
  assert.equal(stripeAnyCheckoutAvailable(), true);
  restoreEnv();
});

test('enterprise checkout resolves from STRIPE_PRICE_ENTERPRISE env', () => {
  restoreEnv();
  process.env.STRIPE_PRICE_ENTERPRISE = 'price_1TbViN2KsjgU9g9yUlok4S2W';
  assert.equal(resolveStripePriceId('enterprise'), 'price_1TbViN2KsjgU9g9yUlok4S2W');
  assert.equal(billingCheckoutMethod('enterprise'), 'session');
  assert.equal(planFromKnownStripePriceId('price_1TbViN2KsjgU9g9yUlok4S2W'), 'enterprise');
  restoreEnv();
});

test('free user paid plan buttons use checkout when server reports availability', () => {
  const ui = resolveBillingPlanCardUi({
    currentPlan: 'free',
    targetPlan: 'enterprise',
    checkoutAvailableByPlan: { enterprise: true }
  });
  assert.equal(ui.kind, 'checkout');
  if (ui.kind === 'checkout') {
    assert.equal(ui.label, 'Choose Enterprise');
    assert.equal(ui.checkoutAvailable, true);
  }
});

test('free user sees unavailable when enterprise price env is missing', () => {
  const ui = resolveBillingPlanCardUi({
    currentPlan: 'free',
    targetPlan: 'enterprise',
    checkoutAvailableByPlan: { enterprise: false }
  });
  assert.equal(ui.kind, 'unavailable');
});

test('stripe price and amount mapping resolves known plans', () => {
  restoreEnv();
  process.env.STRIPE_PRICE_BUSINESS = 'price_1TcwxB2KsjgU9g9y57f9veQh';
  process.env.STRIPE_PRICE_GROWTH = 'price_1TbVfe2KsjgU9g9yMtCnJrBw';
  assert.equal(planFromKnownStripePriceId('price_1TcwxB2KsjgU9g9y57f9veQh'), 'business');
  assert.equal(planFromKnownStripePriceId('price_1TbVfe2KsjgU9g9yMtCnJrBw'), 'growth');
  assert.equal(planFromBillingAmount(14900), 'starter');
  assert.equal(planFromBillingAmount(900), 'pro');
  assert.equal(planFromBillingAmount(79900), 'enterprise');
  restoreEnv();
});

test('resolveBillingPlanCardUi routes active subscribers to billing portal', () => {
  const upgrade = resolveBillingPlanCardUi({
    currentPlan: 'pro',
    targetPlan: 'business',
    hasActiveSubscription: true,
    portalAvailable: true,
    checkoutAvailableByPlan: { business: true }
  });
  assert.equal(upgrade.kind, 'portal');

  const checkout = resolveBillingPlanCardUi({
    currentPlan: 'free',
    targetPlan: 'pro',
    checkoutAvailableByPlan: { pro: true }
  });
  assert.equal(checkout.kind, 'checkout');
});

test('plan upgrade and downgrade helpers compare plan rank with starter tier', () => {
  assert.equal(isPlanUpgrade('pro', 'business'), true);
  assert.equal(isPlanUpgrade('business', 'starter'), true);
  assert.equal(isPlanUpgrade('starter', 'growth'), true);
  assert.equal(isPlanUpgrade('growth', 'enterprise'), true);
  assert.equal(isPlanDowngrade('starter', 'business'), true);
  assert.equal(isPlanDowngrade('pro', 'free'), false);
});

test('stripeCheckoutAvailableForPlan reflects env configuration', () => {
  restoreEnv();
  process.env.STRIPE_PRICE_ENTERPRISE = 'price_test_enterprise';
  assert.equal(stripeCheckoutAvailableForPlan('enterprise'), true);
  delete process.env.STRIPE_PRICE_ENTERPRISE;
  assert.equal(stripeCheckoutAvailableForPlan('enterprise'), false);
  restoreEnv();
});

test('every paid plan has a documented env key', () => {
  for (const plan of paidCheckoutPlans()) {
    assert.match(STRIPE_PRICE_ENV_KEYS[plan], /^STRIPE_PRICE_/);
  }
});
