import assert from 'node:assert/strict';
import test from 'node:test';
import { planCardAction, isPlanUpgrade, isPlanDowngrade } from '@/lib/billing-plan-actions';
import { normalizePlanId } from '@/lib/plan-config';
import {
  isPaidCheckoutPlan,
  paidCheckoutPlans,
  stripeCheckoutAvailableForPlan,
  stripeCheckoutConfigured
} from '@/lib/stripe-prices';

test('legacy plan aliases normalize to supported tiers', () => {
  assert.equal(normalizePlanId('operations'), 'growth');
  assert.equal(normalizePlanId('starter'), 'pro');
});

test('paid checkout plans include all paid tiers', () => {
  assert.deepEqual(paidCheckoutPlans(), ['pro', 'business', 'growth', 'enterprise']);
  assert.equal(isPaidCheckoutPlan('pro'), true);
  assert.equal(isPaidCheckoutPlan('free'), false);
});

test('stripeCheckoutConfigured reflects STRIPE_PRICE_* env vars', () => {
  const original = {
    pro: process.env.STRIPE_PRICE_PRO,
    business: process.env.STRIPE_PRICE_BUSINESS,
    growth: process.env.STRIPE_PRICE_GROWTH,
    enterprise: process.env.STRIPE_PRICE_ENTERPRISE
  };

  process.env.STRIPE_PRICE_PRO = 'price_pro_test';
  process.env.STRIPE_PRICE_BUSINESS = 'price_business_test';
  process.env.STRIPE_PRICE_GROWTH = 'price_growth_test';
  process.env.STRIPE_PRICE_ENTERPRISE = 'price_enterprise_test';

  assert.equal(stripeCheckoutConfigured(), true);
  assert.equal(stripeCheckoutAvailableForPlan('enterprise'), true);

  delete process.env.STRIPE_PRICE_ENTERPRISE;
  assert.equal(stripeCheckoutAvailableForPlan('enterprise'), false);
  assert.equal(stripeCheckoutConfigured(), false);

  process.env.STRIPE_PRICE_PRO = original.pro;
  process.env.STRIPE_PRICE_BUSINESS = original.business;
  process.env.STRIPE_PRICE_GROWTH = original.growth;
  process.env.STRIPE_PRICE_ENTERPRISE = original.enterprise;
});

test('planCardAction routes active subscribers to billing portal for plan changes', () => {
  const upgrade = planCardAction('pro', 'business', {
    hasActiveSubscription: true,
    portalAvailable: true
  });
  assert.equal(upgrade.type, 'portal');
  if (upgrade.type === 'portal') {
    assert.match(upgrade.label, /Upgrade/i);
    assert.equal(upgrade.change, 'upgrade');
  }

  const checkout = planCardAction('free', 'pro', { hasActiveSubscription: false, portalAvailable: false });
  assert.equal(checkout.type, 'checkout');
});

test('plan upgrade and downgrade helpers compare plan rank', () => {
  assert.equal(isPlanUpgrade('pro', 'business'), true);
  assert.equal(isPlanDowngrade('business', 'pro'), true);
  assert.equal(isPlanDowngrade('pro', 'free'), false);
});
