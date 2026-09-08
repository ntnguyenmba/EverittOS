import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';

const root = process.cwd();
const read = (path: string) => readFileSync(join(root, path), 'utf8');

test('unpaid jobs do not feature negative cash profit as the headline', () => {
  const card = read('components/job-profitability-card.tsx');
  assert.match(card, /hasCollectedPayment/);
  assert.match(card, /Cash profit shows after the customer pays/);
  assert.match(card, /editingAmount/);
  assert.doesNotMatch(card, /formatCurrency\(p\?\.collectedProfit \|\| 0\)[\s\S]{0,80}balanceDue/);
});

test('create job sends customer price and contractor pay in one submit', () => {
  const creator = read('components/job-creator.tsx');
  assert.match(creator, /optionalMoneyInput\(clientIncome\)/);
  assert.match(creator, /expected_contractor_cost: expectedContractorPay/);
  assert.match(creator, /unified-job-save/);
  assert.equal((creator.match(/type="submit"/g) || []).length, 1);
});

test('team pay shows expected profit until the customer pays', () => {
  const labor = read('components/job-labor-section.tsx');
  assert.match(labor, /collected > 0/);
  assert.match(labor, /Expected profit/);
  assert.doesNotMatch(labor, />Current profit</);
});

test('job detail uses the centralized sheet stack instead of mixed card gaps', () => {
  const page = read('app/jobs/[id]/page.tsx');
  assert.match(page, /eo-sheet-stack/);
  const primitives = read('app/design/primitives.css');
  assert.match(primitives, /\.eo-sheet-stack/);
  assert.match(primitives, /--eo-section-gap/);
});
