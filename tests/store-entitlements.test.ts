import assert from 'node:assert/strict';
import test from 'node:test';
import {
  planFromAppleProductId,
  planFromGoogleProductId,
  getIosProMonthlyProductId,
  getIosBusinessMonthlyProductId,
  getAndroidProSubscriptionId,
  getAndroidBusinessSubscriptionId,
  isKnownStoreProduct
} from '@/lib/billing/product-catalog';
import {
  pickHigherPlan,
  statusGrantsAccess,
  normalizeStoreStatus
} from '@/lib/billing/subscription-status';

test('Apple product IDs map to EverittOS plans', () => {
  assert.equal(planFromAppleProductId(getIosProMonthlyProductId()), 'pro');
  assert.equal(planFromAppleProductId(getIosBusinessMonthlyProductId()), 'business');
  assert.equal(planFromAppleProductId('com.unknown.product'), null);
  assert.equal(isKnownStoreProduct('apple', getIosProMonthlyProductId()), true);
});

test('Google product IDs map to EverittOS plans', () => {
  assert.equal(planFromGoogleProductId(getAndroidProSubscriptionId()), 'pro');
  assert.equal(planFromGoogleProductId(getAndroidBusinessSubscriptionId()), 'business');
  assert.equal(planFromGoogleProductId('unknown_sku'), null);
});

test('statusGrantsAccess: active and grace retain access; pending and expired do not', () => {
  assert.equal(statusGrantsAccess('active', null), true);
  assert.equal(statusGrantsAccess('trialing', null), true);
  assert.equal(statusGrantsAccess('grace_period', null), true);
  assert.equal(statusGrantsAccess('pending', null), false);
  assert.equal(statusGrantsAccess('on_hold', null), false);
  assert.equal(statusGrantsAccess('paused', null), false);
  assert.equal(statusGrantsAccess('expired', null), false);
  assert.equal(statusGrantsAccess('revoked', null), false);
  assert.equal(statusGrantsAccess('refunded', null), false);
});

test('cancelled but unexpired subscription retains access', () => {
  const future = new Date(Date.now() + 86400000).toISOString();
  const past = new Date(Date.now() - 86400000).toISOString();
  assert.equal(statusGrantsAccess('cancelled', future), true);
  assert.equal(statusGrantsAccess('cancelled', past), false);
});

test('highest plan wins when multiple entitlements are valid', () => {
  assert.equal(pickHigherPlan('pro', 'business'), 'business');
  assert.equal(pickHigherPlan('business', 'pro'), 'business');
  assert.equal(pickHigherPlan('free', 'pro'), 'pro');
});

test('normalizeStoreStatus aliases platform values', () => {
  assert.equal(normalizeStoreStatus('canceled'), 'cancelled');
  assert.equal(normalizeStoreStatus('IN_GRACE_PERIOD'), 'grace_period');
  assert.equal(normalizeStoreStatus('past_due'), 'billing_retry');
});

test('client-supplied unknown product IDs are rejected by catalog', () => {
  assert.equal(planFromAppleProductId('attacker.forged.sku'), null);
  assert.equal(planFromGoogleProductId('attacker_forged'), null);
});
