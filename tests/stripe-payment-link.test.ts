import assert from 'node:assert/strict';
import test from 'node:test';
import { EVERITTOS_STRIPE_LINKS } from '@/lib/everittos-plans';
import {
  buildStripePaymentLinkUrl,
  resolveStripePaymentLink,
  stripePaymentLinkPlans,
  stripePaymentLinksConfigured
} from '@/lib/stripe-payment-link';

test('stripe payment links use canonical EverittOS plan URLs', () => {
  assert.equal(resolveStripePaymentLink('pro'), EVERITTOS_STRIPE_LINKS.pro);
  assert.equal(resolveStripePaymentLink('operations'), EVERITTOS_STRIPE_LINKS.operations);
});

test('buildStripePaymentLinkUrl adds email and client reference', () => {
  const url = new URL(
    buildStripePaymentLinkUrl('business', {
      email: 'owner@example.com',
      clientReferenceId: 'business'
    })
  );
  assert.equal(url.origin + url.pathname, EVERITTOS_STRIPE_LINKS.business);
  assert.equal(url.searchParams.get('prefilled_email'), 'owner@example.com');
  assert.equal(url.searchParams.get('client_reference_id'), 'business');
});

test('buildStripePaymentLinkUrl defaults client_reference_id to plan', () => {
  const url = new URL(buildStripePaymentLinkUrl('enterprise'));
  assert.equal(url.searchParams.get('client_reference_id'), 'enterprise');
});

test('stripePaymentLinksConfigured is true for all paid plans', () => {
  assert.equal(stripePaymentLinksConfigured(), true);
  assert.equal(stripePaymentLinkPlans().length, 5);
});
