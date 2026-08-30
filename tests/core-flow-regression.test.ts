import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';

const root = process.cwd();
const read = (path: string) => readFileSync(join(root, path), 'utf8');

test('login resets the inactivity clock before redirecting', () => {
  const source = read('app/login/page.tsx');
  assert.match(source, /const LAST_ACTIVITY_STORAGE_KEY = 'everittos_last_activity_client'/);
  assert.match(source, /window\.localStorage\.setItem\(LAST_ACTIVITY_STORAGE_KEY, String\(Date\.now\(\)\)\)/);
  assert.match(source, /resetActivityClock\(\);\s*window\.location\.assign\(redirectTo\)/);
});

test('job creation persists timezone and expected finance fields in the primary create request', () => {
  const source = read('components/job-creator.tsx');
  assert.match(source, /timezone: timeZone \|\| null/);
  assert.match(source, /revenue_amount: optionalMoneyInput\(clientIncome\)/);
  assert.match(source, /expected_contractor_cost: expectedContractorPay/);
  assert.match(source, /expected_additional_expense: optionalMoneyInput\(additionalExpenses\)/);
});

test('job profitability follow-up never attempts to write unsupported revenue_notes to jobs', () => {
  const source = read('app/api/jobs/[id]/profitability/route.ts');
  assert.match(source, /revenue_notes\?: string \| null/);
  assert.doesNotMatch(source, /patch\.revenue_notes\s*=/);
  assert.match(source, /Object\.keys\(patch\)\.length > 0/);
});

test('recurring jobs accept timezone and create scheduled occurrences', () => {
  const creator = read('components/job-creator.tsx');
  const route = read('app/api/recurring-jobs/route.ts');
  assert.match(creator, /fetch\('\/api\/recurring-jobs'/);
  assert.match(creator, /timezone: timeZone \|\| null/);
  assert.match(route, /isValidTimeZone\(body\.timezone\)/);
  assert.match(route, /generateOccurrences/);
});

test('quotes retain save, share, print and quote-to-job conversion paths', () => {
  const source = read('app/quotes/page.tsx');
  assert.match(source, /fetch\('\/api\/quotes'/);
  assert.match(source, /navigator\.share/);
  assert.match(source, /\/quotes\/\$\{q\.id\}\/print/);
  assert.match(source, /\/api\/quotes\/\$\{q\.id\}\/convert/);
});

test('invoice and receipt flows use the shared outbound send system', () => {
  const invoices = read('app/invoices/page.tsx');
  const receipts = read('app/receipts/page.tsx');
  const hub = read('components/outbound/outbound-hub.tsx');
  assert.match(invoices, /docType="invoice"/);
  assert.match(receipts, /docType="receipt"/);
  assert.match(hub, /sendNow\(\)/);
  assert.match(hub, /\/api\/outbound\/\$\{id\}\/send/);
});

test('payment receipt flow remains linked to invoice and payment identifiers', () => {
  const receipts = read('app/receipts/page.tsx');
  assert.match(receipts, /searchParams\.get\('invoiceId'\)/);
  assert.match(receipts, /searchParams\.get\('paymentId'\)/);
  assert.match(receipts, /initialInvoiceId=\{invoiceId\}/);
  assert.match(receipts, /initialPaymentId=\{paymentId\}/);
});

test('session guard keeps idle logout active across signed-in views', () => {
  const source = read('components/session-guard.tsx');
  assert.match(source, /sessionIdleTimeoutMs\(\)/);
  assert.match(source, /signOutToLogin\('idle'/);
  assert.match(source, /visibilitychange/);
  assert.match(source, /pageshow/);
});
