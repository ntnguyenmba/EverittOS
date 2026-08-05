import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';
import { effectiveContractorCost } from '@/lib/finance/contractor-cost';
import { calculateExpectedJobFinance, multiplyMoneyDollars } from '@/lib/money-decimal';
import { getDashboardFinanceCopy } from '@/lib/i18n/dashboard-finance-copy';

describe('Team pay and contractor cost unification', () => {
  it('flat and hourly contractor pay use money helpers', () => {
    assert.equal(multiplyMoneyDollars('50', '4'), 200);
    const flat = calculateExpectedJobFinance({
      clientPrice: '400',
      contractorPay: '200',
      additionalExpenses: '0'
    });
    assert.equal(flat.expectedContractorCost, 200);
    assert.equal(flat.expectedProfit, 200);

    const hourlyPay = multiplyMoneyDollars('25.00', '8');
    const hourly = calculateExpectedJobFinance({
      clientPrice: '400',
      contractorPay: hourlyPay,
      additionalExpenses: '25'
    });
    assert.equal(hourly.expectedContractorCost, 200);
    assert.equal(hourly.expectedProfit, 175);
  });

  it('counts $200 contractor pay once, not $400', () => {
    assert.equal(effectiveContractorCost(200, 0), 200);
    assert.equal(effectiveContractorCost(200, 200), 200);
    assert.equal(effectiveContractorCost(200, 150), 150);
    assert.equal(effectiveContractorCost(0, 200), 200);
    assert.equal(effectiveContractorCost(null, null), 0);
  });

  it('job creator removes duplicate contractor name and auto labor create', () => {
    const source = readFileSync('components/job-creator.tsx', 'utf8');
    assert.doesNotMatch(source, /contractorName/);
    assert.doesNotMatch(source, /Contractor or cleaner name/);
    assert.doesNotMatch(source, /Add the contractor or cleaner name/);
    assert.match(source, /paymentMethod/);
    assert.match(source, />Flat rate</);
    assert.match(source, />Hourly</);
    assert.match(source, /What the contractor earns/);
    assert.match(source, /Calculated contractor pay/);
    assert.match(source, /Contractor pay notes \(optional\)/);
    assert.match(source, /Unassigned contractor/);
    assert.doesNotMatch(source, /\/api\/jobs\/\$\{jobId\}\/labor/);
    assert.match(source, /expected_contractor_cost: expectedContractorPay/);
  });

  it('dashboard excludes expected contractor cost when labor already exists', () => {
    const source = readFileSync('lib/dashboard-metrics.ts', 'utf8');
    assert.match(source, /jobIdsWithLabor/);
    assert.match(source, /hasLabor/);
    assert.match(source, /expected_contractor_cost: hasLabor/);
  });

  it('profitability uses effective contractor cost helper', () => {
    const source = readFileSync('lib/finance-server.ts', 'utf8');
    assert.match(source, /effectiveContractorCost/);
    assert.match(source, /expected_contractor_cost/);
    assert.match(source, /recordedLaborCost/);
  });

  it('Team Pay page gates access and prefills from job', () => {
    const source = readFileSync('app/contractor-pay/page.tsx', 'utf8');
    assert.match(source, /canAccessFinancials/);
    assert.match(source, /privacyNotice/);
    assert.match(source, /jobId/);
    assert.match(source, /initializeFromJob/);
    assert.match(source, /reviewPayment/);
    assert.doesNotMatch(source, /isContractorRole\(resolvedRole\)\s*\?\s*true/);
  });

  it('localizes Team Pay wording in English, Spanish, and Vietnamese', () => {
    for (const locale of ['en', 'es', 'vi'] as const) {
      const copy = getDashboardFinanceCopy(locale).contractorPayPage;
      assert.ok(copy.title);
      assert.ok(copy.subtitle);
      assert.ok(copy.privacyNotice);
      assert.ok(copy.reviewPayment);
      assert.ok(copy.flatRate);
      assert.ok(copy.hourly);
      if (locale !== 'en') {
        assert.notEqual(copy.title, getDashboardFinanceCopy('en').contractorPayPage.title);
        assert.notEqual(copy.privacyNotice, getDashboardFinanceCopy('en').contractorPayPage.privacyNotice);
      }
    }
    assert.equal(getDashboardFinanceCopy('en').contractorPayPage.title, 'Team Pay');
  });

  it('recurring generation still applies expected contractor cost once', () => {
    const generate = readFileSync('lib/generate-recurring-series.ts', 'utf8');
    assert.match(generate, /expected_contractor_cost/);
    assert.match(generate, /seedOccurrenceLabor/);
    const seed = readFileSync('lib/seed-occurrence-finance.ts', 'utf8');
    assert.match(seed, /if \(\(count \|\| 0\) > 0\) return/);
    assert.match(seed, /expectedContractorCost/);
  });
});
