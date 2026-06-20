import assert from 'node:assert/strict';
import test from 'node:test';
import { normalizeStripeStatus } from '@/lib/stripe-subscription';
import { subscriptionAccess } from '@/lib/subscription-access';

test('normalizeStripeStatus maps everittos_* aliases to active', () => {
  assert.equal(normalizeStripeStatus('everittos_pro'), 'active');
  assert.equal(normalizeStripeStatus('everittos_enterprise'), 'active');
});

test('normalizeStripeStatus treats unknown statuses as inactive', () => {
  assert.equal(normalizeStripeStatus('mystery_status'), 'inactive');
  assert.equal(normalizeStripeStatus(''), 'free');
});

test('subscriptionAccess blocks paid features for unknown subscription statuses', () => {
  const access = subscriptionAccess('pro', 'mystery_status');
  assert.equal(access.ok, false);
  assert.equal(access.billingRequired, true);
  assert.equal(access.status, 'inactive');
});

test('subscriptionAccess allows active paid subscriptions', () => {
  const access = subscriptionAccess('business', 'everittos_business');
  assert.equal(access.ok, true);
  assert.equal(access.billingRequired, false);
});

test('subscriptionAccess keeps free plan accessible', () => {
  const access = subscriptionAccess('free', 'free');
  assert.equal(access.ok, true);
  assert.equal(access.billingRequired, false);
});
