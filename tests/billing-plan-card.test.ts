import assert from 'node:assert/strict';
import test from 'node:test';
import { BILLING_UI_BUILD_ID, billingCheckoutTargetAvailable, resolveBillingPlanCardUi } from '@/lib/billing-plan-card';

test('billing UI build id is set for deployment verification', () => {
  assert.equal(BILLING_UI_BUILD_ID, 'billing-v4-env-checkout');
});

test('paid tiers are recognized for billing cards', () => {
  for (const plan of ['pro', 'business', 'starter', 'growth', 'enterprise'] as const) {
    assert.equal(billingCheckoutTargetAvailable(plan), true, plan);
  }
});

test('free users get checkout buttons when server reports availability', () => {
  for (const plan of ['pro', 'business', 'starter', 'growth', 'enterprise'] as const) {
    const ui = resolveBillingPlanCardUi({
      currentPlan: 'free',
      targetPlan: plan,
      checkoutAvailableByPlan: { [plan]: true }
    });
    assert.equal(ui.kind, 'checkout', plan);
  }
});

test('free user business growth enterprise never render contact on purchase cards', () => {
  for (const plan of ['business', 'growth', 'enterprise'] as const) {
    const ui = resolveBillingPlanCardUi({
      currentPlan: 'free',
      targetPlan: plan,
      checkoutAvailableByPlan: { [plan]: true }
    });
    assert.notEqual(ui.kind, 'downgrade_contact');
    assert.equal(ui.kind, 'checkout');
  }
});

test('paid subscribers without portal still get checkout not contact for upgrades', () => {
  const ui = resolveBillingPlanCardUi({
    currentPlan: 'pro',
    targetPlan: 'business',
    hasActiveSubscription: true,
    portalAvailable: false,
    checkoutAvailableByPlan: { business: true }
  });
  assert.equal(ui.kind, 'checkout');
});

test('only free downgrade card uses contact support', () => {
  const ui = resolveBillingPlanCardUi({
    currentPlan: 'pro',
    targetPlan: 'free',
    hasActiveSubscription: true,
    portalAvailable: false
  });
  assert.equal(ui.kind, 'downgrade_contact');
});
