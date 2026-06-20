import assert from 'node:assert/strict';
import test from 'node:test';
import { billingPlanDiagnostics } from '@/lib/billing-diagnostics';
import { resolveStripePriceId } from '@/lib/billing-config';

const ORIGINAL_ENV = { ...process.env };

function restoreEnv() {
  for (const key of Object.keys(process.env)) {
    if (!(key in ORIGINAL_ENV)) delete process.env[key];
  }
  Object.assign(process.env, ORIGINAL_ENV);
}

test('billing diagnostics reports enterprise checkout availability from env', () => {
  restoreEnv();
  process.env.STRIPE_PRICE_ENTERPRISE = 'price_1TbViN2KsjgU9g9yUlok4S2W';
  const rows = billingPlanDiagnostics();
  const enterprise = rows.find((row) => row.plan === 'enterprise');
  assert.ok(enterprise);
  assert.equal(enterprise?.checkoutAvailable, true);
  assert.equal(enterprise?.priceIdPreview, 'price_1TbV…4S2W');
  assert.equal(resolveStripePriceId('enterprise'), 'price_1TbViN2KsjgU9g9yUlok4S2W');
  restoreEnv();
});

test('billing diagnostics marks enterprise unavailable without env price', () => {
  restoreEnv();
  delete process.env.STRIPE_PRICE_ENTERPRISE;
  const enterprise = billingPlanDiagnostics().find((row) => row.plan === 'enterprise');
  assert.equal(enterprise?.checkoutAvailable, false);
  restoreEnv();
});
