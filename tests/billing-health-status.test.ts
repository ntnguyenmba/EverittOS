import assert from 'node:assert/strict';
import test from 'node:test';
import {
  billingHealthSummaryLevel,
  buildBillingHealthStatusCards,
  isInternalBillingIssueCode
} from '@/lib/billing-health-status';

const healthyInput = {
  profile: { plan: 'enterprise', stripeCustomerId: 'cus_123' },
  subscription: { stripeSubscriptionId: 'sub_123' },
  latestWebhookSync: { success: true },
  stripe: { configured: true, webhookConfigured: true, checkoutConfigured: true },
  issues: [] as string[]
};

test('buildBillingHealthStatusCards returns connected cards when billing is healthy', () => {
  const cards = buildBillingHealthStatusCards(healthyInput);
  assert.equal(cards.every((card) => card.level === 'connected'), true);
  assert.equal(billingHealthSummaryLevel(cards), 'connected');
});

test('buildBillingHealthStatusCards maps missing customer and subscription ids to needs attention', () => {
  const cards = buildBillingHealthStatusCards({
    ...healthyInput,
    profile: { plan: 'enterprise', stripeCustomerId: null },
    subscription: { stripeSubscriptionId: null },
    latestWebhookSync: null,
    stripe: { configured: true, webhookConfigured: true, checkoutConfigured: false },
    issues: ['missing_stripe_customer_id', 'missing_stripe_subscription_id', 'missing_stripe_price_id']
  });

  assert.deepEqual(
    cards.map((card) => [card.key, card.level]),
    [
      ['billingService', 'connected'],
      ['stripeAccount', 'needs_attention'],
      ['subscriptionInfo', 'needs_attention'],
      ['billingConfiguration', 'needs_attention'],
      ['subscriptionSync', 'needs_attention']
    ]
  );
});

test('buildBillingHealthStatusCards maps webhook sync failures to action required', () => {
  const cards = buildBillingHealthStatusCards({
    ...healthyInput,
    latestWebhookSync: { success: false },
    issues: ['webhook_sync_failed:profile_not_found']
  });

  const syncCard = cards.find((card) => card.key === 'subscriptionSync');
  assert.equal(syncCard?.level, 'action_required');
  assert.equal(billingHealthSummaryLevel(cards), 'action_required');
});

test('isInternalBillingIssueCode detects internal billing diagnostics', () => {
  assert.equal(isInternalBillingIssueCode('missing_stripe_customer_id'), true);
  assert.equal(isInternalBillingIssueCode('webhook_sync_failed:unknown'), true);
  assert.equal(isInternalBillingIssueCode('STRIPE_SECRET_KEY'), true);
  assert.equal(isInternalBillingIssueCode('Stripe account not connected yet'), false);
});
