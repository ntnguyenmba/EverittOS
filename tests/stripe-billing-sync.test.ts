import assert from 'node:assert/strict';
import test from 'node:test';
import {
  coalesceStripeCustomerId,
  isValidStripeCheckoutSessionId,
  isValidStripeCustomerId,
  isValidStripeSubscriptionId
} from '@/lib/stripe-ids';
import {
  everittosStatusForSubscription,
  pickBestStripeSubscription,
  subscriptionGrantsPaidAccess
} from '@/lib/stripe-billing-sync';

test('isValidStripeCustomerId rejects placeholders and requires cus_ prefix', () => {
  assert.equal(isValidStripeCustomerId('cus_abc123'), true);
  assert.equal(isValidStripeCustomerId('ADD_YOUR_STRIPE_CUSTOMER_ID'), false);
  assert.equal(isValidStripeCustomerId('placeholder'), false);
  assert.equal(isValidStripeCustomerId(null), false);
});

test('coalesceStripeCustomerId keeps existing valid id when incoming value is invalid', () => {
  assert.equal(
    coalesceStripeCustomerId('ADD_YOUR_STRIPE_CUSTOMER_ID', 'cus_existing123'),
    'cus_existing123'
  );
  assert.equal(coalesceStripeCustomerId('cus_new456', 'cus_existing123'), 'cus_new456');
  assert.equal(coalesceStripeCustomerId(null, null), null);
});

test('isValidStripeSubscriptionId validates subscription ids', () => {
  assert.equal(isValidStripeSubscriptionId('sub_abc123'), true);
  assert.equal(isValidStripeSubscriptionId('ADD_YOUR_STRIPE_SUBSCRIPTION_ID'), false);
});

test('isValidStripeCheckoutSessionId validates checkout session ids', () => {
  assert.equal(isValidStripeCheckoutSessionId('cs_test_abc'), true);
  assert.equal(isValidStripeCheckoutSessionId('YOUR_STRIPE_SESSION'), false);
});

test('everittosStatusForSubscription maps active paid plans', () => {
  assert.equal(everittosStatusForSubscription('enterprise', 'active'), 'everittos_enterprise');
  assert.equal(everittosStatusForSubscription('enterprise', 'active', true), 'canceled');
});

test('subscriptionGrantsPaidAccess includes active and trialing subscriptions', () => {
  assert.equal(
    subscriptionGrantsPaidAccess({
      status: 'active',
      current_period_end: Math.floor(Date.now() / 1000) + 3600
    } as import('stripe').Stripe.Subscription),
    true
  );
  assert.equal(
    subscriptionGrantsPaidAccess({
      status: 'trialing',
      current_period_end: Math.floor(Date.now() / 1000) + 3600
    } as import('stripe').Stripe.Subscription),
    true
  );
});

test('pickBestStripeSubscription prefers active paid plans', () => {
  const activeEnterprise = {
    id: 'sub_active',
    status: 'active',
    created: 200,
    current_period_end: Math.floor(Date.now() / 1000) + 3600,
    items: { data: [{ price: { id: 'price_1TbViN2KsjgU9g9yUlok4S2W', product: 'prod_Uah64aXMtVGGqI' } }] },
    metadata: { plan: 'enterprise' }
  } as unknown as import('stripe').Stripe.Subscription;

  const canceledPro = {
    id: 'sub_old',
    status: 'canceled',
    created: 100,
    current_period_end: Math.floor(Date.now() / 1000) - 3600,
    items: { data: [{ price: { id: 'price_pro', unit_amount: 900 } }] },
    metadata: { plan: 'pro' }
  } as unknown as import('stripe').Stripe.Subscription;

  const picked = pickBestStripeSubscription([canceledPro, activeEnterprise]);
  assert.equal(picked?.id, 'sub_active');
});
