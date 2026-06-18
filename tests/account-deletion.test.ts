import assert from 'node:assert/strict';
import test from 'node:test';
import { subscriptionBlocksAccountDeletion } from '@/lib/account-deletion-server';

test('subscriptionBlocksAccountDeletion allows free plans', () => {
  assert.equal(subscriptionBlocksAccountDeletion('free', 'free'), false);
  assert.equal(subscriptionBlocksAccountDeletion('pro', 'canceled'), false);
  assert.equal(subscriptionBlocksAccountDeletion('pro', 'cancelled'), false);
});

test('subscriptionBlocksAccountDeletion blocks active paid subscriptions', () => {
  assert.equal(subscriptionBlocksAccountDeletion('pro', 'active'), true);
  assert.equal(subscriptionBlocksAccountDeletion('business', 'trialing'), true);
  assert.equal(subscriptionBlocksAccountDeletion('growth', 'past_due'), true);
});
