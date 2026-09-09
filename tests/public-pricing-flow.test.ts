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

test('public pricing reuses the six-plan billing grid', () => {
  assert.match(home, /<BillingPlansGrid currentPlan="free" publicMode \/>/);
  assert.doesNotMatch(home, /className="marketing-price-grid"/);
  assert.match(billingGrid, /publicMode \?\s*BILLING_PLANS/);
});

test('public plan actions go through signup before checkout', () => {
  assert.match(billingGrid, /href=\{\x60\/signup\?plan=\$\{tier\.id\}\x60\}/);
  assert.match(billingGrid, /publicMode \|\| !billingVisibility\.allowCheckout/);
  assert.doesNotMatch(billingGrid, /publicMode[\s\S]{0,300}<PlanCheckoutButton/);
});
