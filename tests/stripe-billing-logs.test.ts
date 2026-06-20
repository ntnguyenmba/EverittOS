import assert from 'node:assert/strict';
import test from 'node:test';
import type { StripeBillingLogTag } from '@/lib/stripe-billing-logs';

/** Compile-time guard: every checkout log tag must stay in StripeBillingLogTag. */
const checkoutLogTags: StripeBillingLogTag[] = [
  'checkout:not_configured',
  'checkout:unauthenticated',
  'checkout:forbidden',
  'checkout:invalid_plan',
  'checkout:missing_email',
  'checkout:already_subscribed',
  'checkout:payment_link_redirect',
  'checkout:payment_link_fallback',
  'checkout:session_created',
  'checkout:session_create_failed'
];

test('checkout route log tags are valid StripeBillingLogTag values', () => {
  assert.ok(checkoutLogTags.includes('checkout:payment_link_redirect'));
  assert.equal(checkoutLogTags.length, 10);
});
