import assert from 'node:assert/strict';
import test from 'node:test';
import {
  billingCheckoutAvailable,
  billingCheckoutMethod,
  BILLING_PLAN_ORDER,
  planFromBillingAmount,
  planFromKnownStripePriceId,
  resolveStripePriceId,
  STRIPE_PRICE_IDS
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

test('checkout uses canonical Stripe price IDs for every paid plan', () => {
  for (const plan of paidCheckoutPlans()) {
    assert.equal(billingCheckoutAvailable(plan), true, plan);
    assert.equal(billingCheckoutMethod(plan), 'session', plan);
    assert.equal(resolveStripePriceId(plan), STRIPE_PRICE_IDS[plan], plan);
  }
  assert.equal(stripeAnyCheckoutAvailable(), true);
});

test('enterprise checkout resolves final Stripe price ID', () => {
  assert.equal(resolveStripePriceId('enterprise'), 'price_1U2KlI2KsjgU9g9yeak0iPiT');
  assert.equal(billingCheckoutMethod('enterprise'), 'session');
  assert.equal(planFromKnownStripePriceId('price_1U2KlI2KsjgU9g9yeak0iPiT'), 'enterprise');
});

test('free user paid plan buttons use checkout when available', () => {
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

test('billing card can still represent an unavailable store response', () => {
  const ui = resolveBillingPlanCardUi({
    currentPlan: 'free',
    targetPlan: 'enterprise',
    checkoutAvailableByPlan: { enterprise: false }
  });
  assert.equal(ui.kind, 'unavailable');
});

test('stripe price and amount mapping resolves final plans', () => {
  assert.equal(planFromKnownStripePriceId('price_1TcwxB2KsjgU9g9y57f9veQh'), 'business');
  assert.equal(planFromKnownStripePriceId('price_1U2Kge2KsjgU9g9ypMeHRfxb'), 'growth');
  assert.equal(planFromBillingAmount(7900), 'starter');
  assert.equal(planFromBillingAmount(900), 'pro');
  assert.equal(planFromBillingAmount(39900), 'enterprise');
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

test('stripeCheckoutAvailableForPlan is true for every canonical paid plan', () => {
  for (const plan of paidCheckoutPlans()) {
    assert.equal(stripeCheckoutAvailableForPlan(plan), true, plan);
  }
});
