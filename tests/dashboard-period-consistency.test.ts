import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  EXPECTED_PROFIT_FORMULA,
  buildFinanceDebugBreakdown,
  calculateEstimatedProfit,
  calculateExpectedRevenue,
  calculatePeriodOutstanding,
  calculatePeriodUnpaidContractorPay,
  calculateUnpaidContractorPay,
  type InvoiceMetricRow,
  type JobPaymentMetricRow,
  type JobRevenueRow,
  type LaborCostRow
} from '@/lib/dashboard-metrics';

describe('dashboard period consistency', () => {
  it('documents the exact Expected Profit formula', () => {
    assert.equal(
      EXPECTED_PROFIT_FORMULA,
      'Expected Profit = (Invoice Revenue + Unbilled Revenue) − Contractor Cost (accrued) − Business Expenses'
    );

    const expectedRevenue = calculateExpectedRevenue(2000, 1400);
    const profit = calculateEstimatedProfit({
      expectedRevenue,
      contractorPay: 1000,
      otherExpenses: 200
    });
    assert.equal(expectedRevenue, 3400);
    assert.equal(profit, 2200);
  });

  it('scopes outstanding to the selected period while keeping lifetime open AR separate', () => {
    const invoices: InvoiceMetricRow[] = [
      {
        id: 'inv-july',
        amount: 1000,
        amount_paid: 200,
        invoice_date: '2026-07-10',
        job_id: 'job-july',
        status: 'sent'
      },
      {
        id: 'inv-june',
        amount: 500,
        amount_paid: 0,
        invoice_date: '2026-06-10',
        job_id: 'job-june',
        status: 'sent'
      }
    ];
    const jobs: JobRevenueRow[] = [
      { id: 'job-july', revenue_amount: 1000, status: 'completed', customer_name: 'A' },
      { id: 'job-june', revenue_amount: 500, status: 'completed', customer_name: 'B' },
      { id: 'job-open', revenue_amount: 300, status: 'in_progress', customer_name: 'C' }
    ];
    const jobPayments: JobPaymentMetricRow[] = [];
    const jobDates = new Map([
      ['job-july', '2026-07-08'],
      ['job-june', '2026-06-08'],
      ['job-open', '2026-07-15']
    ]);

    const period = calculatePeriodOutstanding({
      invoices,
      jobs,
      jobPayments,
      start: '2026-07-01',
      end: '2026-08-01',
      jobDates
    });

    // July invoice remaining 800 + July unbilled job 300
    assert.equal(period.total, 1100);
    assert.equal(period.invoiceTotal, 800);
    assert.equal(period.jobTotal, 300);
  });

  it('scopes unpaid contractor labor to the period while lifetime keeps all unpaid', () => {
    const labor: LaborCostRow[] = [
      { job_id: 'job-july', total_cost: 400, payment_status: 'unpaid', created_at: '2026-07-05' },
      { job_id: 'job-june', total_cost: 250, payment_status: 'unpaid', created_at: '2026-06-05' },
      { job_id: 'job-july-paid', total_cost: 100, payment_status: 'paid', paid_at: '2026-07-09', created_at: '2026-07-04' }
    ];
    const jobDates = new Map([
      ['job-july', '2026-07-08'],
      ['job-june', '2026-06-08'],
      ['job-july-paid', '2026-07-07']
    ]);

    assert.equal(
      calculatePeriodUnpaidContractorPay(labor, '2026-07-01', '2026-08-01', jobDates),
      400
    );
    assert.equal(calculateUnpaidContractorPay(labor), 650);
  });

  it('builds a finance debug breakdown that reconciles expected profit and cash', () => {
    const debug = buildFinanceDebugBreakdown({
      range: 'month',
      start: '2026-07-01',
      end: '2026-08-01',
      invoiceRevenue: 2000,
      invoicePayments: 1200,
      directJobPayments: 300,
      periodOutstanding: 800,
      lifetimeOutstanding: 1500,
      unbilledRevenue: 400,
      contractorLaborPaid: 500,
      contractorLaborUnpaidPeriod: 200,
      contractorLaborUnpaidLifetime: 700,
      contractorLaborAccrued: 700,
      businessExpenses: 100,
      expectedRevenue: 2400,
      expectedProfit: 1600,
      cashAvailable: 900
    });

    assert.equal(debug.collected, 1500);
    assert.equal(debug.expectedRevenue, 2400);
    assert.equal(debug.expectedProfit, 1600);
    assert.equal(debug.cashAvailable, 900);
    assert.equal(debug.expectedProfitFormula, EXPECTED_PROFIT_FORMULA);
    assert.equal(
      Number((debug.invoiceRevenue + debug.unbilledRevenue).toFixed(2)),
      debug.expectedRevenue
    );
    assert.equal(
      Number((debug.expectedRevenue - debug.contractorLaborAccrued - debug.businessExpenses).toFixed(2)),
      debug.expectedProfit
    );
    assert.equal(
      Number((debug.collected - debug.contractorLaborPaid - debug.businessExpenses).toFixed(2)),
      debug.cashAvailable
    );
  });
});
