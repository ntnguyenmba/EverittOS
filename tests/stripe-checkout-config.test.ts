import assert from 'node:assert/strict';
import test from 'node:test';
import {
  billingCheckoutAvailable,
  billingCheckoutMethod,
  BILLING_PLAN_ORDER,
  clientBillingCheckoutAvailable,
  clientBillingCheckoutTarget,
  paymentLinkForPlan,
  planFromBillingAmount,
  planFromKnownStripePriceId,
  resolveStripePriceId
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

test('client billing checkout is available without server env vars', () => {
  for (const plan of ['pro', 'business', 'starter', 'growth', 'enterprise'] as const) {
    assert.equal(clientBillingCheckoutAvailable(plan), true, plan);
  }
});

test('free user paid plan buttons never use contact billing support', () => {
  for (const plan of ['pro', 'business', 'starter', 'growth', 'enterprise'] as const) {
    const action = planCardAction('free', plan, { hasActiveSubscription: false, portalAvailable: false });
    assert.notEqual(action.type, 'contact', plan);
    assert.equal(action.type, 'checkout', plan);
  }
});

test('free user plan buttons use Choose labels from billing config', () => {
  const pro = planCardAction('free', 'pro');
  assert.equal(pro.type, 'checkout');
  if (pro.type === 'checkout') assert.equal(pro.label, 'Choose Pro');

  const starter = planCardAction('free', 'starter');
  if (starter.type === 'checkout') assert.equal(starter.label, 'Choose Starter');
});

test('client checkout targets include payment links for link-only plans', () => {
  const pro = clientBillingCheckoutTarget('pro');
  assert.equal(pro.method, 'payment_link');
  assert.match(pro.checkoutUrl || '', /^https:\/\/buy\.stripe\.com\//);

  const starter = clientBillingCheckoutTarget('starter');
  assert.equal(starter.method, 'payment_link');
  assert.match(starter.checkoutUrl || '', /^https:\/\/buy\.stripe\.com\//);
});

test('client checkout targets prefer session when default price ID exists', () => {
  const business = clientBillingCheckoutTarget('business');
  assert.equal(business.method, 'session');
  assert.equal(business.priceId, 'price_1TcwxB2KsjgU9g9y57f9veQh');

  const growth = clientBillingCheckoutTarget('growth');
  assert.equal(growth.method, 'session');
  assert.equal(growth.priceId, 'price_1TbVfe2KsjgU9g9yMtCnJrBw');
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

test('payment links are configured for public paid tiers', () => {
  assert.match(paymentLinkForPlan('pro') || '', /eVq7sEcXCbX08Kn8P993y0c/);
  assert.match(paymentLinkForPlan('starter') || '', /cNi4gs8Hm3qu8Kn7L593y08/);
  assert.match(paymentLinkForPlan('growth') || '', /9B6aEQcXCbX06Cf7L593y09/);
  assert.match(paymentLinkForPlan('enterprise') || '', /3cI6oA5va6CG5yb5CX93y0a/);
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
    assert.equal(checkout.label, 'Choose Pro');
    assert.equal(checkout.method, 'payment_link');
  }
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
