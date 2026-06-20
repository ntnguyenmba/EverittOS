import assert from 'node:assert/strict';
import test from 'node:test';
import { checkoutOwnerDiagnostic, checkoutPublicErrorMessage } from '@/lib/checkout-errors';

test('checkoutPublicErrorMessage uses plan-specific friendly copy', () => {
  assert.match(checkoutPublicErrorMessage('enterprise'), /Enterprise checkout is not configured correctly/);
  assert.match(checkoutPublicErrorMessage('pro'), /Pro checkout is not configured correctly/);
});

test('checkoutOwnerDiagnostic explains missing env var', () => {
  const message = checkoutOwnerDiagnostic({
    plan: 'enterprise',
    code: 'checkout_not_configured',
    priceEnvKey: 'STRIPE_PRICE_ENTERPRISE'
  });
  assert.match(message, /STRIPE_PRICE_ENTERPRISE/);
});

test('checkoutOwnerDiagnostic explains live test mismatch', () => {
  const message = checkoutOwnerDiagnostic({
    plan: 'enterprise',
    code: 'live_test_mismatch',
    priceEnvKey: 'STRIPE_PRICE_ENTERPRISE',
    priceIdPreview: 'price_1TbV…4S2W'
  });
  assert.match(message, /live\/test mismatch/i);
});
