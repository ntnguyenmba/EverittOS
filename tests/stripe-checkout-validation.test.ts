import assert from 'node:assert/strict';
import test from 'node:test';
import { formatStripeError } from '@/lib/stripe-checkout-validation';

test('formatStripeError returns message for generic errors', () => {
  const formatted = formatStripeError(new Error('No such price: price_invalid'));
  assert.match(formatted.message, /No such price/);
});
