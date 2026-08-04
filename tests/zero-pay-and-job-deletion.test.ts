import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import {
  calculateExpectedJobFinance,
  optionalMoneyDollars,
  parseMoneyDollars
} from '../lib/money-decimal';
import {
  isCompletedJobStatus,
  previousIsoDate,
  resolveOccurrenceAnchorDate,
  selectRecurringJobsForPermanentDelete
} from '../lib/job-permanent-delete';
import { occurrenceFinanceColumns } from '../lib/seed-occurrence-finance';
import { calculateUninvoicedExpectedRevenue } from '../lib/dashboard-metrics';
import { isManagerRole, normalizeRole } from '../lib/roles';

const root = process.cwd();
const read = (path: string) => readFileSync(join(root, path), 'utf8');

test('optional money preserves intentional zero and treats blank as null', () => {
  assert.equal(optionalMoneyDollars(''), null);
  assert.equal(optionalMoneyDollars('   '), null);
  assert.equal(optionalMoneyDollars(null), null);
  assert.equal(optionalMoneyDollars(undefined), null);
  assert.equal(optionalMoneyDollars('0'), 0);
  assert.equal(optionalMoneyDollars(0), 0);
  assert.equal(optionalMoneyDollars('0.00'), 0);
  assert.equal(optionalMoneyDollars('125.50'), 125.5);
  assert.equal(optionalMoneyDollars('-5'), -5);
  assert.notEqual(optionalMoneyDollars(0), null);
  assert.equal(0 || null, null); // documents the anti-pattern we avoid
});

test('create and save jobs with zero client and/or contractor pay', () => {
  const bothZero = calculateExpectedJobFinance({
    clientPrice: 0,
    contractorPay: 0,
    additionalExpenses: 0
  });
  assert.equal(bothZero.expectedRevenue, 0);
  assert.equal(bothZero.expectedContractorCost, 0);
  assert.equal(bothZero.expectedAdditionalExpense, 0);
  assert.equal(bothZero.expectedProfit, 0);

  const clientOnly = calculateExpectedJobFinance({
    clientPrice: 200,
    contractorPay: 0,
    additionalExpenses: 0
  });
  assert.equal(clientOnly.expectedRevenue, 200);
  assert.equal(clientOnly.expectedContractorCost, 0);
  assert.equal(clientOnly.expectedProfit, 200);

  const contractorOnly = calculateExpectedJobFinance({
    clientPrice: 0,
    contractorPay: 75,
    additionalExpenses: 0
  });
  assert.equal(contractorOnly.expectedRevenue, 0);
  assert.equal(contractorOnly.expectedContractorCost, 75);
  assert.equal(contractorOnly.expectedProfit, -75);
});

test('job creator and APIs preserve numeric zero instead of coercing to null', () => {
  const creator = read('components/job-creator.tsx');
  assert.match(creator, /optionalMoneyInput/);
  assert.match(creator, /flat < 0/);
  assert.doesNotMatch(creator, /contractorFlatRate\) <= 0/);
  assert.doesNotMatch(creator, /expectedContractorPay \|\| null/);
  assert.doesNotMatch(creator, /default_price: clientIncome \?/);
  assert.doesNotMatch(creator, /revenue_amount: clientIncome \?/);

  const jobsApi = read('app/api/jobs/route.ts');
  assert.match(jobsApi, /body\.revenue_amount === null \|\| body\.revenue_amount === ''/);
  assert.match(jobsApi, /Financial amounts must be non-negative/);

  const recurringCreate = read('app/api/recurring-jobs/route.ts');
  assert.match(recurringCreate, /optionalMoneyDollars/);
  assert.doesNotMatch(recurringCreate, /default_price: finance\.expectedRevenue \|\| null/);
  assert.doesNotMatch(recurringCreate, /default_contractor_cost: finance\.expectedContractorCost \|\| null/);
  assert.doesNotMatch(recurringCreate, /default_additional_expense: finance\.expectedAdditionalExpense \|\| null/);

  const recurringPatch = read('app/api/recurring-jobs/[id]/route.ts');
  assert.match(recurringPatch, /optionalMoneyDollars\(body\.default_price\)/);
  assert.match(recurringPatch, /optionalMoneyDollars\(body\.expected_contractor_cost\)/);
  assert.match(recurringPatch, /optionalMoneyDollars\(body\.expected_additional_expense\)/);

  const profitability = read('app/api/jobs/[id]/profitability/route.ts');
  assert.match(profitability, /non-negative number/);
  assert.doesNotMatch(profitability, /must be a positive number/);
});

test('recurring series defaults and generated occurrences retain numeric zero', () => {
  const columns = occurrenceFinanceColumns({
    expectedRevenue: 0,
    expectedContractorCost: 0,
    expectedAdditionalExpense: 0,
    expectedExpenseDescription: null
  });
  assert.equal(columns.revenue_amount, 0);
  assert.equal(columns.expected_contractor_cost, 0);
  assert.equal(columns.expected_additional_expense, 0);

  const blank = occurrenceFinanceColumns({
    expectedRevenue: null,
    expectedContractorCost: null,
    expectedAdditionalExpense: null
  });
  assert.equal(blank.revenue_amount, null);
  assert.equal(blank.expected_contractor_cost, null);
  assert.equal(blank.expected_additional_expense, null);

  const generate = read('lib/generate-recurring-series.ts');
  assert.match(generate, /default_price \?\? null/);
  assert.match(generate, /default_contractor_cost \?\? null/);
  assert.match(generate, /default_additional_expense \?\? null/);
});

test('zero-pay jobs remain countable while contributing zero revenue', () => {
  const jobs = [
    { id: 'zero', revenue_amount: 0, status: 'scheduled', start_date: '2026-08-04' },
    { id: 'paid', revenue_amount: 150, status: 'scheduled', start_date: '2026-08-04' },
    { id: 'cancelled', revenue_amount: 90, status: 'cancelled', start_date: '2026-08-04' }
  ];
  const revenue = calculateUninvoicedExpectedRevenue(jobs, new Set(), '2026-08-01', '2026-08-31');
  assert.equal(revenue, 150);
  assert.equal(jobs.filter((job) => job.status !== 'cancelled').length, 2);
  assert.equal(parseMoneyDollars(0), 0);
});

test('permanent delete selects selected + future non-completed recurring visits', () => {
  const jobs = [
    { id: 'past-done', status: 'completed', occurrence_date: '2026-07-01' },
    { id: 'past-open', status: 'scheduled', occurrence_date: '2026-07-08' },
    { id: 'selected', status: 'scheduled', occurrence_date: '2026-07-15' },
    { id: 'future-open', status: 'new', occurrence_date: '2026-07-22' },
    { id: 'future-done', status: 'completed', occurrence_date: '2026-07-29' },
    { id: 'future-null-date', status: 'scheduled', occurrence_date: null, start_date: '2026-08-05' }
  ];
  const ids = selectRecurringJobsForPermanentDelete(jobs, 'selected', '2026-07-15');
  assert.deepEqual(ids.sort(), ['future-null-date', 'future-open', 'selected'].sort());
  assert.ok(!ids.includes('past-done'));
  assert.ok(!ids.includes('past-open'));
  assert.ok(!ids.includes('future-done'));
  assert.equal(previousIsoDate('2026-07-15'), '2026-07-14');
  assert.equal(resolveOccurrenceAnchorDate({ occurrence_date: null, start_date: '2026-08-05' }), '2026-08-05');
  assert.equal(isCompletedJobStatus('completed'), true);
  assert.equal(isCompletedJobStatus('scheduled'), false);
});

test('delete API uses manager gate, atomic RPC, and never silent-cancels', () => {
  const route = read('app/api/jobs/[id]/route.ts');
  assert.match(route, /requireManager:\s*true/);
  assert.match(route, /permanently_delete_job/);
  assert.match(route, /selectRecurringJobsForPermanentDelete/);
  assert.match(route, /next_generation_date:\s*null/);
  assert.match(route, /status:\s*'ended'/);
  assert.match(route, /record_shares/);
  assert.match(route, /deletedJobCount/);
  assert.doesNotMatch(route, /status:\s*'cancelled'/);
  assert.match(route, /409/);
});

test('job details exposes permanent delete only for managers', () => {
  const page = read('app/jobs/[id]/page.tsx');
  assert.match(page, /permanentlyDeleteJob/);
  assert.match(page, /deleteJobConfirmOneTime/);
  assert.match(page, /deleteJobConfirmRecurring/);
  assert.match(page, /canManage \? \(/);
  assert.match(page, /method: 'DELETE'/);
  assert.match(page, /router\.push\('\/jobs'\)/);
  assert.match(page, /router\.refresh\(/);
  assert.doesNotMatch(page, /isContractorRole\(userRole\)\s*\?\s*\([\s\S]*permanentlyDeleteJob/);

  assert.equal(isManagerRole(normalizeRole('owner')), true);
  assert.equal(isManagerRole(normalizeRole('admin')), true);
  assert.equal(isManagerRole(normalizeRole('manager')), true);
  assert.equal(isManagerRole(normalizeRole('contractor')), false);
  assert.equal(isManagerRole(normalizeRole('client')), false);
  assert.equal(isManagerRole(normalizeRole('employee')), false);
});

test('migration adds atomic permanent delete function', () => {
  const migration = read('supabase/migrations/202610010001_permanent_job_deletion.sql');
  assert.match(migration, /permanently_delete_job/);
  assert.match(migration, /security definer/i);
  assert.match(migration, /can_manage_org_work/);
  assert.match(migration, /next_generation_date = null/);
  assert.match(migration, /status = 'ended'/);
  assert.match(migration, /record_shares/);
  assert.match(migration, /deletedJobCount/);
  assert.doesNotMatch(migration, /status = 'cancelled'/);
});

test('profitability and labor UI keep zero values editable', () => {
  const profitability = read('components/job-profitability-card.tsx');
  assert.match(profitability, /manualRevenue == null \? '' : String\(next\.manualRevenue\)/);
  assert.doesNotMatch(profitability, /manualRevenue \? String/);

  const labor = read('components/job-labor-section.tsx');
  assert.match(labor, /parsedRate < 0/);
  assert.doesNotMatch(labor, /parsedRate <= 0/);
  assert.match(labor, /expected != null && Number\.isFinite\(expected\) \? String\(expected\)/);
});
