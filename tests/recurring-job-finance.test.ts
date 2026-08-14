import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import {
  calculateActualJobFinance,
  calculateExpectedJobFinance,
  centsToDollars,
  dollarsToCents,
  multiplyMoneyDollars,
  parseMoneyDollars,
  subtractMoneyDollars
} from '../lib/money-decimal';
import {
  calculateScheduledExpectedFinance,
  generateOccurrenceDates,
  generateOccurrences,
  RECURRING_GENERATION_WINDOW_DAYS,
  summarizeRecurrence
} from '../lib/recurring-jobs';

const root = process.cwd();
const read = (path: string) => readFileSync(join(root, path), 'utf8');

test('one-time job financial calculations use cents-safe math', () => {
  const finance = calculateExpectedJobFinance({
    clientPrice: '240.00',
    contractorPay: '180.00',
    additionalExpenses: '10.00'
  });
  assert.equal(finance.expectedRevenue, 240);
  assert.equal(finance.expectedContractorCost, 180);
  assert.equal(finance.expectedAdditionalExpense, 10);
  assert.equal(finance.expectedExpenseTotal, 190);
  assert.equal(finance.expectedProfit, 50);

  // Avoid floating residue: 0.1 + 0.2 style issues
  assert.equal(subtractMoneyDollars(0.3, 0.1), 0.2);
  assert.equal(multiplyMoneyDollars('60.00', '3'), 180);
  assert.equal(dollarsToCents('240.105'), 24011);
  assert.equal(centsToDollars(24011), 240.11);
  assert.equal(parseMoneyDollars(''), 0);
});

test('actual profit uses only collected and actual costs', () => {
  const actual = calculateActualJobFinance({
    collectedRevenue: 240,
    actualContractorPayments: 180,
    actualRecordedExpenses: 10
  });
  assert.equal(actual.actualProfit, 50);
  const unpaid = calculateActualJobFinance({
    collectedRevenue: 0,
    actualContractorPayments: 0,
    actualRecordedExpenses: 0
  });
  assert.equal(unpaid.actualProfit, 0);
});

test('weekly every-two-weeks every-four-weeks monthly and custom recurrence', () => {
  assert.equal(RECURRING_GENERATION_WINDOW_DAYS, 365);

  const weekly = generateOccurrenceDates({ frequency: 'weekly', startDate: '2026-08-06', weekday: 4 });
  assert.ok(weekly.length >= 12);
  assert.equal(weekly[0], '2026-08-06');

  const biweekly = generateOccurrenceDates({ frequency: 'biweekly', startDate: '2026-08-06', weekday: 4 });
  assert.equal(biweekly[1], '2026-08-20');

  const four = generateOccurrenceDates({ frequency: 'every_four_weeks', startDate: '2026-08-06', weekday: 4 });
  assert.equal(four[1], '2026-09-03');

  const monthly = generateOccurrenceDates({ frequency: 'monthly', startDate: '2026-08-06' });
  assert.equal(monthly[1], '2026-09-06');

  const custom = generateOccurrences(
    {
      frequency: 'custom',
      interval: 3,
      intervalUnit: 'weeks',
      weekday: 2,
      startDate: '2026-08-04',
      preferredStartTime: '14:30',
      timezone: 'America/Chicago'
    },
    { skipOverdueToday: false }
  );
  assert.equal(custom[0].scheduledStart, '2026-08-04T14:30:00');
  assert.equal(custom[1].occurrenceDate, '2026-08-25');
});

test('property timezone wall-clock and rolling window without unlimited generation', () => {
  const dates = generateOccurrenceDates({
    frequency: 'weekly',
    startDate: '2026-08-06',
    weekday: 4
  });
  const start = new Date(`${dates[0]}T00:00:00Z`).getTime();
  const end = new Date(`${dates[dates.length - 1]}T00:00:00Z`).getTime();
  const days = (end - start) / (1000 * 60 * 60 * 24);
  assert.ok(days <= RECURRING_GENERATION_WINDOW_DAYS);
  // Weekly over a 365-day window produces about 53 visits, never unlimited.
  assert.ok(dates.length > 40 && dates.length < 60);
});

test('example forecast for four every-two-weeks occurrences', () => {
  const per = calculateExpectedJobFinance({
    clientPrice: 240,
    contractorPay: 180,
    additionalExpenses: 10
  });
  const rows = [1, 2, 3, 4].map((n) => ({
    price: per.expectedRevenue,
    expected_contractor_cost: per.expectedContractorCost,
    expected_additional_expense: per.expectedAdditionalExpense,
    status: 'scheduled',
    occurrence_date: `2026-08-${String(6 + (n - 1) * 14).padStart(2, '0')}`
  }));
  const forecast = calculateScheduledExpectedFinance(rows, '2026-08-01');
  assert.equal(forecast.scheduledRevenue, 960);
  assert.equal(forecast.expectedContractorExpense, 720);
  assert.equal(forecast.expectedAdditionalExpenses, 40);
  assert.equal(forecast.expectedProfit, 200);
  assert.equal(forecast.occurrenceCount, 4);
});

test('skipped cancelled and completed excluded from scheduled forecasts', () => {
  const forecast = calculateScheduledExpectedFinance(
    [
      { price: 240, expected_contractor_cost: 180, expected_additional_expense: 10, status: 'scheduled', occurrence_date: '2026-08-10' },
      { price: 240, expected_contractor_cost: 180, expected_additional_expense: 10, status: 'cancelled', is_skipped: true, occurrence_date: '2026-08-12' },
      { price: 240, expected_contractor_cost: 180, expected_additional_expense: 10, status: 'cancelled', occurrence_date: '2026-08-14' },
      { price: 240, expected_contractor_cost: 180, expected_additional_expense: 10, status: 'completed', occurrence_date: '2026-08-16' },
      { price: 280, expected_contractor_cost: 200, expected_additional_expense: 10, status: 'scheduled', occurrence_date: '2026-08-20' }
    ],
    '2026-08-05'
  );
  assert.equal(forecast.scheduledRevenue, 520);
  assert.equal(forecast.expectedContractorExpense, 380);
  assert.equal(forecast.expectedProfit, 120);
});

test('editing one occurrence finance does not rewrite series defaults in API', () => {
  const seriesActions = read('app/api/jobs/[id]/series-actions/route.ts');
  assert.match(seriesActions, /seriesUntouched/);
  assert.match(seriesActions, /expected_contractor_cost/);
  assert.match(seriesActions, /expected_additional_expense/);
  const seriesRoute = read('app/api/recurring-jobs/[id]/route.ts');
  assert.match(seriesRoute, /edit_future/);
  assert.match(seriesRoute, /edit_series/);
  assert.match(seriesRoute, /isCompletedLikeStatus/);
  assert.match(seriesRoute, /assign_contractor/);
  assert.match(seriesRoute, /this_and_future/);
  assert.match(seriesRoute, /entire_series/);
});

test('contractor assignment saved on create for series and occurrences', () => {
  const create = read('app/api/recurring-jobs/route.ts');
  assert.match(create, /preferred_contractor_id/);
  assert.match(create, /saveJobAssignment/);
  assert.match(create, /expected_contractor_cost/);
  assert.match(create, /default_additional_expense/);
  assert.match(create, /seedOccurrenceLabor/);
  const jobsCreate = read('app/api/jobs/route.ts');
  assert.match(jobsCreate, /job_assignments/);
  assert.match(jobsCreate, /Keep jobs\.assigned_to and job_assignments in sync/);
  const assignments = read('components/job-assignments.tsx');
  assert.match(assignments, /assignments\.length === 0/);
  assert.match(assignments, /This visit only/);
});

test('client price contractor pay and expenses copied onto occurrences', () => {
  const generate = read('lib/generate-recurring-series.ts');
  assert.match(generate, /expected_contractor_cost/);
  assert.match(generate, /expected_additional_expense/);
  assert.match(generate, /occurrence_local_time/);
  assert.match(generate, /seedOccurrenceLabor/);
  const migration = read('supabase/migrations/202609280001_recurring_job_financial_defaults.sql');
  assert.match(migration, /default_contractor_cost/);
  assert.match(migration, /expected_contractor_cost/);
  assert.match(migration, /jobs_recurring_series_occurrence_uidx/);
  assert.match(migration, /occurrence_local_time/);
});

test('job creator exposes Repeats Every two weeks and expected profit review', () => {
  const source = read('components/job-creator.tsx');
  assert.match(source, /recurrenceCopy\.scheduleType/);
  assert.match(source, /everyTwoWeeks|every_three_weeks/);
  assert.match(source, /Expected profit/);
  assert.match(source, /Additional expected expenses/);
  assert.match(source, /calculateExpectedJobFinance/);
  assert.match(source, /expected_contractor_cost/);
  assert.match(source, /Review before saving/);
});

test('recurrence summary matches plain language example style', () => {
  const summary = summarizeRecurrence({
    frequency: 'biweekly',
    weekday: 4,
    startDate: '2026-08-06',
    preferredStartTime: '10:00'
  });
  assert.match(summary, /Every two weeks on Thursday at 10:00 AM starting August 6, 2026/);
  assert.doesNotMatch(summary, /starting \./);
});

test('dashboard metrics keep expected and actual finance separate', () => {
  const metrics = read('lib/dashboard-metrics.ts');
  assert.match(metrics, /scheduledExpectedContractorExpense/);
  assert.match(metrics, /scheduledExpectedAdditionalExpenses/);
  assert.match(metrics, /scheduledExpectedProfit/);
  assert.match(metrics, /calculateScheduledExpectedFinance/);
  assert.match(metrics, /paidToYou/);
  // Outstanding remains invoice/billable based, not unlimited future occurrences.
  assert.match(metrics, /stillOwed/);
});

test('recurring series is not counted as a job; occurrences are', () => {
  const metrics = read('lib/dashboard-metrics.ts');
  assert.match(metrics, /recurringOccurrenceCount/);
  assert.match(metrics, /oneTimeJobCount/);
  assert.doesNotMatch(metrics, /count.*recurring_job_series.*as.*job/i);
});
