import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  calculateJobPaymentStatus,
  calculateOutstandingBalance,
  resolveExpectedJobAmount
} from '@/lib/finance/job-payments';
import { computeJobProfitability } from '@/lib/finance-server';
import {
  calculateDirectJobOutstanding,
  calculatePaidToYou,
  sumJobPaymentsByJobId,
  type InvoiceMetricRow,
  type JobPaymentMetricRow
} from '@/lib/dashboard-metrics';

describe('direct job payments', () => {
  it('allows payment status without an invoice when expected amount is set', () => {
    assert.equal(calculateJobPaymentStatus(500, 0), 'unpaid');
    assert.equal(calculateJobPaymentStatus(500, 200), 'partially_paid');
    assert.equal(calculateJobPaymentStatus(500, 500), 'paid');
    assert.equal(calculateJobPaymentStatus(500, 600), 'paid');
    assert.equal(calculateJobPaymentStatus(0, 100), 'no_amount_set');
  });

  it('calculates outstanding balance from expected minus collected', () => {
    assert.equal(calculateOutstandingBalance(500, 200), 300);
    assert.equal(calculateOutstandingBalance(500, 500), 0);
    assert.equal(calculateOutstandingBalance(500, 700), 0);
  });

  it('updates collected revenue and profit for direct payments', () => {
    const result = computeJobProfitability({
      hasInvoice: false,
      invoiceTotal: 0,
      manualRevenue: 1000,
      collectedAmount: 400,
      laborCost: 100,
      materialCost: 50,
      otherExpenses: 25,
      payments: []
    });

    assert.equal(result.expectedAmount, 1000);
    assert.equal(result.collectedAmount, 400);
    assert.equal(result.outstanding, 600);
    assert.equal(result.paymentStatus, 'partially_paid');
    assert.equal(result.collectedProfit, 225);
    assert.equal(result.expectedProfit, 825);
  });

  it('uses invoice total as expected amount when an invoice exists', () => {
    const expected = resolveExpectedJobAmount({
      manualRevenue: 800,
      invoiceTotal: 1200,
      hasInvoice: true
    });
    assert.equal(expected, 1200);
  });

  it('includes direct job payments in paid to you by payment date', () => {
    const invoices: InvoiceMetricRow[] = [];
    const jobPayments: JobPaymentMetricRow[] = [
      { job_id: 'job-1', amount: 150, paid_at: '2026-07-10T12:00:00.000Z' },
      { job_id: 'job-2', amount: 75, paid_at: '2026-06-20T12:00:00.000Z' }
    ];

    const july = calculatePaidToYou({
      invoices,
      paymentRows: [],
      jobPaymentRows: jobPayments,
      start: '2026-07-01',
      end: '2026-08-01',
      range: 'month'
    });
    assert.equal(july.paidToYou, 150);
  });

  it('does not double count invoice and direct job payment sources in outstanding', () => {
    const invoiced = new Set(['job-invoiced']);
    const collected = sumJobPaymentsByJobId([
      { job_id: 'job-direct', amount: 100, paid_at: '2026-07-01' }
    ]);
    const outstanding = calculateDirectJobOutstanding(
      [
        { id: 'job-direct', revenue_amount: 400 },
        { id: 'job-invoiced', revenue_amount: 900 }
      ],
      invoiced,
      collected
    );
    assert.equal(outstanding, 300);
  });
});

describe('photo report defaults', () => {
  it('treats missing customer_visible as internal only', () => {
    const row = { customer_visible: undefined as boolean | undefined };
    assert.equal(Boolean(row.customer_visible), false);
  });
});
