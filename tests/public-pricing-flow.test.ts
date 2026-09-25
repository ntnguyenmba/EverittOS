import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const middleware = readFileSync('middleware.ts', 'utf8');
const home = readFileSync('app/page.tsx', 'utf8');
const billingGrid = readFileSync('components/billing-plans-grid.tsx', 'utf8');

test('logged-out visitors can open the public landing page', () => {
  assert.match(middleware, /if \(pathname === '\/'\)[\s\S]*return supabaseResponse;/);
  assert.doesNotMatch(middleware, /pathname === '\/'[\s\S]{0,1200}new URL\('\/login'/);
});

const pricingPage = readFileSync('app/pricing/page.tsx', 'utf8');
const pricingPanel = readFileSync('components/pricing-checkout-panel.tsx', 'utf8');

test('public pricing lists every paid plan from the shared billing config', () => {
  // The marketing landing moved off the app; / only redirects to sign-in.
  assert.match(home, /redirect\('\/login'\)/);
  assert.match(pricingPage, /<PricingCheckoutPanel/);
  assert.match(pricingPanel, /BILLING_PLANS\.filter\(\(tier\) => tier\.id !== 'free'\)/);
  assert.match(billingGrid, /publicMode \?\s*BILLING_PLANS/);
});

test('public plan actions go through signup before checkout', () => {
  assert.match(pricingPanel, /\/signup\?plan=\$\{tierId\}/);
  assert.match(pricingPanel, /authenticated \? \(\s*<PlanCheckoutButton/);
  assert.match(billingGrid, /href=\{\x60\/signup\?plan=\$\{tier\.id\}\x60\}/);
  assert.match(billingGrid, /publicMode \|\| !billingVisibility\.allowCheckout/);
  // Every checkout button in the grid is behind a !publicMode guard.
  const checkoutButtons = billingGrid.match(/[^{]*\? <PlanCheckoutButton/g) || [];
  assert.ok(checkoutButtons.length > 0);
  for (const guard of checkoutButtons) assert.match(guard, /!publicMode &&/);
});
