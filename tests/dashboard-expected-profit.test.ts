import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  buildPrimaryDashboardMetrics,
  calculateCashAfterPaidCosts,
  calculateContractorAccruedCost,
  calculateContractorCashPaid,
  calculateEstimatedProfit,
  calculateExpectedRevenue,
  calculateUninvoicedExpectedRevenue,
  countCompletedJobsMissingCompletedAt,
  type JobExpectedRevenueRow,
  type LaborCostRow
} from '@/lib/dashboard-metrics';
import {
  getCompletedJobReportingDate,
  isActiveCustomerRecord,
  isCompletedJobMissingCompletedAt
} from '@/lib/job-operational-date';

describe('Dashboard expected revenue and profit', () => {
  it('includes uninvoiced expected revenue in expected profit', () => {
    const uninvoiced = 3400;
    const contractorCost = 3040;
    const expectedRevenue = calculateExpectedRevenue(0, uninvoiced);
    const profit = calculateEstimatedProfit({
      expectedRevenue,
      contractorPay: contractorCost,
      otherExpenses: 0
    });

    assert.equal(expectedRevenue, 3400);
    assert.equal(profit, 360);
  });

  it('does not double count invoiced jobs in expected revenue', () => {
    const jobs: JobExpectedRevenueRow[] = [
      {
        id: 'job-invoiced',
        revenue_amount: 2000,
        status: 'completed',
        completed_at: '2026-07-10',
        start_date: '2026-07-09'
      },
      {
        id: 'job-open',
        revenue_amount: 1400,
        status: 'completed',
        completed_at: '2026-07-12',
        start_date: '2026-07-11'
      }
    ];
    const invoicedJobIds = new Set(['job-invoiced']);
    const uninvoiced = calculateUninvoicedExpectedRevenue(
      jobs,
      invoicedJobIds,
      '2026-07-01',
      '2026-08-01'
    );
    const expectedRevenue = calculateExpectedRevenue(2000, uninvoiced);

    assert.equal(uninvoiced, 1400);
    assert.equal(expectedRevenue, 3400);
    assert.equal(
      calculateEstimatedProfit({
        expectedRevenue,
        contractorPay: 1000,
        otherExpenses: 0
      }),
      2400
    );
  });

  it('flags completed jobs missing completed_at and still reports a date', () => {
    const job = {
      id: 'job-legacy',
      status: 'completed',
      completed_at: null,
      start_date: '2026-07-08',
      scheduled_start: '2026-07-07'
    };

    assert.equal(isCompletedJobMissingCompletedAt(job), true);
    assert.equal(getCompletedJobReportingDate(job), '2026-07-08');

    const missing = countCompletedJobsMissingCompletedAt(
      [job, { id: 'job-ok', status: 'completed', completed_at: '2026-07-09' }],
      '2026-07-01',
      '2026-08-01',
      'month'
    );
    assert.equal(missing.count, 1);
    assert.deepEqual(missing.ids, ['job-legacy']);
  });

  it('separates contractor cost incurred from contractor cash paid', () => {
    const labor: LaborCostRow[] = [
      { total_cost: 2000, created_at: '2026-07-05', payment_status: 'unpaid', paid_at: null },
      { total_cost: 1040, created_at: '2026-07-06', payment_status: 'paid', paid_at: '2026-07-08' }
    ];

    assert.equal(calculateContractorAccruedCost(labor, '2026-07-01', '2026-08-01'), 3040);
    assert.equal(calculateContractorCashPaid(labor, '2026-07-01', '2026-08-01', 'month'), 1040);

    const cash = calculateCashAfterPaidCosts({
      cashCollected: 2450,
      contractorCashPaid: 1040,
      otherCashExpenses: 0
    });
    assert.equal(cash, 1410);

    const profit = calculateEstimatedProfit({
      expectedRevenue: 3400,
      contractorPay: 3040,
      otherExpenses: 0
    });
    assert.equal(profit, 360);
  });

  it('treats blank customer pipeline_stage as active unless archived/past/inactive/cancelled', () => {
    assert.equal(isActiveCustomerRecord({ record_type: 'customer', pipeline_stage: null }), true);
    assert.equal(isActiveCustomerRecord({ record_type: 'customer', pipeline_stage: '' }), true);
    assert.equal(isActiveCustomerRecord({ record_type: 'customer', pipeline_stage: 'active' }), true);
    assert.equal(isActiveCustomerRecord({ record_type: 'customer', pipeline_stage: 'past' }), false);
    assert.equal(isActiveCustomerRecord({ record_type: 'customer', pipeline_stage: 'inactive' }), false);
    assert.equal(isActiveCustomerRecord({ record_type: 'customer', pipeline_stage: 'archived' }), false);
    assert.equal(isActiveCustomerRecord({ record_type: 'customer', pipeline_stage: 'cancelled' }), false);
    assert.equal(isActiveCustomerRecord({ record_type: 'lead', pipeline_stage: null }), false);
    assert.equal(isActiveCustomerRecord({ record_type: 'customer', pipeline_stage: 'recurring' }), false);
  });

  it('cash after paid costs subtracts paid contractor and expense cash only', () => {
    assert.equal(
      calculateCashAfterPaidCosts({
        cashCollected: 2450,
        contractorCashPaid: 2390,
        otherCashExpenses: 0
      }),
      60
    );
  });

  it('primary dashboard metrics expose one cash metric without Net cash', () => {
    const rows = buildPrimaryDashboardMetrics({
      expectedRevenue: 3400,
      collected: 2450,
      outstanding: 950,
      contractorCost: 3040,
      expectedProfit: 360,
      cashAfterPaidCosts: 60
    });

    assert.deepEqual(
      rows.map((row) => row.key),
      [
        'expectedRevenue',
        'collected',
        'outstanding',
        'contractorCost',
        'expectedProfit',
        'cashAfterPaidCosts'
      ]
    );
    assert.equal(rows.some((row) => /net cash/i.test(row.label)), false);
    assert.equal(rows.find((row) => row.key === 'expectedProfit')?.value, 360);
    assert.equal(rows.find((row) => row.key === 'cashAfterPaidCosts')?.label, 'Cash after paid costs');
  });
});
