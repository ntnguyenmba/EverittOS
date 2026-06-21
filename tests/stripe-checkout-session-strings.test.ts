import assert from 'node:assert/strict';
import test from 'node:test';
import { appOrigin, appUrl, PRODUCTION_APP_ORIGIN } from '@/lib/app-url';
import { validateCheckoutSessionInputs } from '@/lib/stripe-checkout-validation';

const ORIGINAL_ENV = { ...process.env };

function restoreEnv() {
  for (const key of Object.keys(process.env)) {
    if (!(key in ORIGINAL_ENV)) delete process.env[key];
  }
  Object.assign(process.env, ORIGINAL_ENV);
}

test('appOrigin strips quoted NEXT_PUBLIC_APP_URL', () => {
  restoreEnv();
  process.env.NEXT_PUBLIC_APP_URL = '"https://app.everittventures.com"';
  assert.equal(appOrigin(), PRODUCTION_APP_ORIGIN);
  assert.equal(appUrl('/settings/billing'), `${PRODUCTION_APP_ORIGIN}/settings/billing`);
  restoreEnv();
});

test('appOrigin falls back to APP_URL when NEXT_PUBLIC_APP_URL is unset', () => {
  restoreEnv();
  delete process.env.NEXT_PUBLIC_APP_URL;
  delete process.env.NEXT_PUBLIC_SITE_URL;
  process.env.APP_URL = 'https://app.everittventures.com';
  assert.equal(appOrigin(), PRODUCTION_APP_ORIGIN);
  restoreEnv();
});

test('validateCheckoutSessionInputs rejects quoted price env', () => {
  const result = validateCheckoutSessionInputs({
    plan: 'enterprise',
    priceEnvKey: 'STRIPE_PRICE_ENTERPRISE',
    priceId: 'price_test_enterprise',
    rawPriceEnv: '"price_test_enterprise"',
    successUrl: `${PRODUCTION_APP_ORIGIN}/settings/billing?checkout=success`,
    cancelUrl: `${PRODUCTION_APP_ORIGIN}/settings/billing?checkout=cancelled`,
    appOrigin: PRODUCTION_APP_ORIGIN,
    rawAppUrlEnvs: {},
    isProduction: false
  });
  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(result.code, 'invalid_env_format');
    assert.match(result.message, /STRIPE_PRICE_ENTERPRISE/);
  }
});

test('validateCheckoutSessionInputs rejects buy.stripe.com payment link in price env', () => {
  const result = validateCheckoutSessionInputs({
    plan: 'enterprise',
    priceEnvKey: 'STRIPE_PRICE_ENTERPRISE',
    priceId: 'https://buy.stripe.com/test_abc',
    rawPriceEnv: 'https://buy.stripe.com/test_abc',
    successUrl: `${PRODUCTION_APP_ORIGIN}/settings/billing?checkout=success`,
    cancelUrl: `${PRODUCTION_APP_ORIGIN}/settings/billing?checkout=cancelled`,
    appOrigin: PRODUCTION_APP_ORIGIN,
    rawAppUrlEnvs: {},
    isProduction: false
  });
  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(result.code, 'invalid_price_id');
    assert.match(result.message, /buy\.stripe\.com/);
  }
});

test('validateCheckoutSessionInputs rejects non-https success_url', () => {
  const result = validateCheckoutSessionInputs({
    plan: 'pro',
    priceEnvKey: 'STRIPE_PRICE_PRO',
    priceId: 'price_test_pro',
    rawPriceEnv: 'price_test_pro',
    successUrl: 'http://app.everittventures.com/settings/billing',
    cancelUrl: `${PRODUCTION_APP_ORIGIN}/settings/billing?checkout=cancelled`,
    appOrigin: PRODUCTION_APP_ORIGIN,
    rawAppUrlEnvs: {},
    isProduction: false
  });
  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.code, 'invalid_success_url');
});

test('validateCheckoutSessionInputs accepts valid production checkout strings', () => {
  const result = validateCheckoutSessionInputs({
    plan: 'enterprise',
    priceEnvKey: 'STRIPE_PRICE_ENTERPRISE',
    priceId: 'price_test_enterprise',
    rawPriceEnv: 'price_test_enterprise',
    successUrl: `${PRODUCTION_APP_ORIGIN}/settings/billing?checkout=success&session_id={CHECKOUT_SESSION_ID}`,
    cancelUrl: `${PRODUCTION_APP_ORIGIN}/settings/billing?checkout=cancelled`,
    appOrigin: PRODUCTION_APP_ORIGIN,
    rawAppUrlEnvs: {
      NEXT_PUBLIC_APP_URL: PRODUCTION_APP_ORIGIN
    },
    isProduction: true
  });
  assert.equal(result.ok, true);
});
