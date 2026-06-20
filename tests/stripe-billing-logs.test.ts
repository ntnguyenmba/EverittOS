import assert from 'node:assert/strict';
import test from 'node:test';
import type { StripeBillingLogTag } from '@/lib/stripe-billing-logs';

/** Compile-time guard: every checkout log tag must stay in StripeBillingLogTag. */
const checkoutLogTags: StripeBillingLogTag[] = [
  'checkout:not_configured',
  'checkout:request_received',
  'checkout:price_resolution',
  'checkout:price_invalid',
  'checkout:session_create_attempt',
  'checkout:unauthenticated',
  'checkout:forbidden',
  'checkout:invalid_plan',
  'checkout:missing_email',
  'checkout:already_subscribed',
  'checkout:session_created',
  'checkout:session_metadata',
  'checkout:session_create_failed'
];

test('checkout route log tags are valid StripeBillingLogTag values', () => {
  assert.ok(checkoutLogTags.includes('checkout:price_resolution'));
  assert.equal(checkoutLogTags.length, 13);
});
