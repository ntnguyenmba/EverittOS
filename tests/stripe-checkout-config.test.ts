import assert from 'node:assert/strict';
import test from 'node:test';
import {
  billingCheckoutAvailable,
  billingCheckoutMethod,
  BILLING_PLAN_ORDER,
  planFromBillingAmount,
  planFromKnownStripePriceId
} from '@/lib/billing-config';
import { planCardAction, isPlanUpgrade, isPlanDowngrade } from '@/lib/billing-plan-actions';
import { normalizePlanId } from '@/lib/plan-config';
import {
  isPaidCheckoutPlan,
  paidCheckoutPlans,
  stripeCheckoutAvailableForPlan,
  stripeAnyCheckoutAvailable
} from '@/lib/stripe-prices';

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

test('billing checkout is available via price ID or payment link defaults', () => {
  assert.equal(billingCheckoutAvailable('pro'), true);
  assert.equal(billingCheckoutAvailable('business'), true);
  assert.equal(billingCheckoutAvailable('starter'), true);
  assert.equal(billingCheckoutAvailable('growth'), true);
  assert.equal(billingCheckoutAvailable('enterprise'), true);
  assert.equal(stripeAnyCheckoutAvailable(), true);
});

test('stripe price and amount mapping resolves known plans', () => {
  assert.equal(planFromKnownStripePriceId('price_1TcwxB2KsjgU9g9y57f9veQh'), 'business');
  assert.equal(planFromKnownStripePriceId('price_1TbVfe2KsjgU9g9yMtCnJrBw'), 'growth');
  assert.equal(planFromBillingAmount(14900), 'starter');
  assert.equal(planFromBillingAmount(900), 'pro');
});

test('checkout method prefers session when price ID exists', () => {
  assert.equal(billingCheckoutMethod('business'), 'session');
  assert.equal(billingCheckoutMethod('pro'), 'payment_link');
});

test('planCardAction routes active subscribers to billing portal for plan changes', () => {
  const upgrade = planCardAction('pro', 'business', {
    hasActiveSubscription: true,
    portalAvailable: true
  });
  assert.equal(upgrade.type, 'portal');
  if (upgrade.type === 'portal') {
    assert.match(upgrade.label, /portal/i);
    assert.equal(upgrade.change, 'upgrade');
  }

  const checkout = planCardAction('free', 'pro', { hasActiveSubscription: false, portalAvailable: false });
  assert.equal(checkout.type, 'checkout');
  if (checkout.type === 'checkout') {
    assert.equal(checkout.label, 'Choose plan');
  }
});

test('planCardAction uses checkout when payment link fallback exists without env price', () => {
  const action = planCardAction('free', 'pro', { hasActiveSubscription: false, portalAvailable: false });
  assert.equal(action.type, 'checkout');
  assert.notEqual(action.type, 'contact');
});

test('plan upgrade and downgrade helpers compare plan rank with starter tier', () => {
  assert.equal(isPlanUpgrade('pro', 'business'), true);
  assert.equal(isPlanUpgrade('business', 'starter'), true);
  assert.equal(isPlanUpgrade('starter', 'growth'), true);
  assert.equal(isPlanDowngrade('starter', 'business'), true);
  assert.equal(isPlanDowngrade('pro', 'free'), false);
});

test('stripeCheckoutAvailableForPlan reflects centralized billing config', () => {
  assert.equal(stripeCheckoutAvailableForPlan('enterprise'), true);
  assert.equal(stripeCheckoutAvailableForPlan('starter'), true);
});
