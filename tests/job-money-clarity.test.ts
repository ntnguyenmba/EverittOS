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

test('job money and create views use centralized sheet spacing tokens', () => {
  const primitives = read('app/design/primitives.css');
  assert.match(primitives, /\.eo-sheet-stack/);
  assert.match(primitives, /--eo-section-gap/);
  assert.match(primitives, /\.job-detail-shell/);
  const creator = read('components/job-creator.tsx');
  assert.match(creator, /--eo-section-gap/);
});
