import assert from 'node:assert/strict';
import test from 'node:test';
import {
  BILLING_CHECKOUT_TARGETS,
  BILLING_UI_BUILD_ID,
  billingCheckoutTargetForPlan,
  resolveBillingPlanCardUi
} from '@/lib/billing-plan-card';

test('billing UI build id is set for deployment verification', () => {
  assert.equal(BILLING_UI_BUILD_ID, 'billing-v3-client-checkout');
});

test('frozen checkout targets include all paid tiers with URLs or price IDs', () => {
  assert.match(BILLING_CHECKOUT_TARGETS.pro.checkoutUrl || '', /buy\.stripe\.com/);
  assert.equal(BILLING_CHECKOUT_TARGETS.business.priceId, 'price_1TcwxB2KsjgU9g9y57f9veQh');
  assert.match(BILLING_CHECKOUT_TARGETS.starter.checkoutUrl || '', /buy\.stripe\.com/);
  assert.equal(BILLING_CHECKOUT_TARGETS.growth.priceId, 'price_1TbVfe2KsjgU9g9yMtCnJrBw');
  assert.match(BILLING_CHECKOUT_TARGETS.growth.checkoutUrl || '', /buy\.stripe\.com/);
  assert.equal(BILLING_CHECKOUT_TARGETS.enterprise.priceId, 'price_1TbViN2KsjgU9g9yUlok4S2W');
  assert.match(BILLING_CHECKOUT_TARGETS.enterprise.checkoutUrl || '', /buy\.stripe\.com/);
});

test('free users always get checkout buttons with Choose labels — never contact support', () => {
  for (const plan of ['pro', 'business', 'starter', 'growth', 'enterprise'] as const) {
    const ui = resolveBillingPlanCardUi({
      currentPlan: 'free',
      targetPlan: plan,
      hasActiveSubscription: true,
      portalAvailable: false
    });
    assert.equal(ui.kind, 'checkout', plan);
    if (ui.kind === 'checkout') {
      assert.equal(ui.label, billingCheckoutTargetForPlan(plan).buttonLabel, plan);
      assert.ok(ui.priceId || ui.checkoutUrl, plan);
    }
  }
});

test('free user business growth enterprise never render contact on purchase cards', () => {
  for (const plan of ['business', 'growth', 'enterprise'] as const) {
    const ui = resolveBillingPlanCardUi({ currentPlan: 'free', targetPlan: plan });
    assert.notEqual(ui.kind, 'downgrade_contact');
    assert.equal(ui.kind, 'checkout');
  }
});

test('paid subscribers without portal still get checkout not contact for upgrades', () => {
  const ui = resolveBillingPlanCardUi({
    currentPlan: 'pro',
    targetPlan: 'business',
    hasActiveSubscription: true,
    portalAvailable: false
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
