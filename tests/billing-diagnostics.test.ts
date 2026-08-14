import assert from 'node:assert/strict';
import test from 'node:test';
import { billingPlanDiagnostics } from '@/lib/billing-diagnostics';
import { resolveStripePriceId, STRIPE_PRICE_IDS } from '@/lib/billing-config';
import { maskStripeId, sanitizeBillingEnvValue } from '@/lib/billing-env';

const ORIGINAL_ENV = { ...process.env };

function restoreEnv() {
  for (const key of Object.keys(process.env)) {
    if (!(key in ORIGINAL_ENV)) delete process.env[key];
  }
  Object.assign(process.env, ORIGINAL_ENV);
}

test('billing diagnostics reports enterprise checkout availability from canonical price ids', () => {
  restoreEnv();
  delete process.env.STRIPE_PRICE_ENTERPRISE;
  const rows = billingPlanDiagnostics();
  const enterprise = rows.find((row) => row.plan === 'enterprise');
  assert.ok(enterprise);
  assert.equal(enterprise?.checkoutAvailable, true);
  assert.equal(enterprise?.priceIdPreview, maskStripeId(STRIPE_PRICE_IDS.enterprise));
  assert.equal(resolveStripePriceId('enterprise'), STRIPE_PRICE_IDS.enterprise);
  restoreEnv();
});

test('billing diagnostics strips quoted enterprise env values', () => {
  restoreEnv();
  process.env.STRIPE_PRICE_ENTERPRISE = '"price_1TbViN2KsjgU9g9yUlok4S2W"';
  assert.equal(sanitizeBillingEnvValue(process.env.STRIPE_PRICE_ENTERPRISE), 'price_1TbViN2KsjgU9g9yUlok4S2W');
  restoreEnv();
});

test('billing diagnostics keeps enterprise available without env price', () => {
  restoreEnv();
  delete process.env.STRIPE_PRICE_ENTERPRISE;
  const enterprise = billingPlanDiagnostics().find((row) => row.plan === 'enterprise');
  assert.equal(enterprise?.checkoutAvailable, true);
  restoreEnv();
});
