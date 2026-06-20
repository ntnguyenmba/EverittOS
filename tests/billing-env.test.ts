import assert from 'node:assert/strict';
import test from 'node:test';
import { sanitizeBillingEnvValue } from '@/lib/billing-env';

test('sanitizeBillingEnvValue trims whitespace and surrounding quotes', () => {
  assert.equal(sanitizeBillingEnvValue('  price_abc  '), 'price_abc');
  assert.equal(sanitizeBillingEnvValue('"price_abc"'), 'price_abc');
  assert.equal(sanitizeBillingEnvValue("'price_abc'"), 'price_abc');
  assert.equal(sanitizeBillingEnvValue('price_abc\n'), 'price_abc');
});
