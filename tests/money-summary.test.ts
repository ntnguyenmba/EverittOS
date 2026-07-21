import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  buildMoneySummaryMetrics,
  buildPrimaryDashboardMetrics,
  calculateCashAfterPaidCosts,
  calculateDirectJobOutstanding,
  calculatePaidToYou,
  calculateStillOwed,
  formatCurrency,
  sumJobPaymentsByJobId,
  type InvoiceMetricRow,
  type InvoicePaymentRow,
  type JobPaymentMetricRow
} from '@/lib/dashboard-metrics';

describe('Dashboard money calculations', () => {
  it('includes direct job payments and invoice payments without double counting', () => {
    const invoices: InvoiceMetricRow[] = [
      {
        id: 'inv-1',
        amount: 500,
        amount_paid: 200,
        invoice_date: '2026-07-01',
        payment_status: 'partially_paid',
        job_id: 'job-invoiced'
      }
    ];
    const invoicePayments: InvoicePaymentRow[] = [
      { invoice_id: 'inv-1', amount: 200, paid_at: '2026-07-05' }
    ];
    const jobPayments: JobPaymentMetricRow[] = [
      { job_id: 'job-direct', amount: 150, paid_at: '2026-07-08' }
    ];

    const collected = calculatePaidToYou({
      invoices,
      paymentRows: invoicePayments,
      jobPaymentRows: jobPayments,
      start: '2026-07-01',
      end: '2026-08-01',
      range: 'month'
    }).paidToYou;

    assert.equal(collected, 350);
  });

  it('outstanding includes unpaid invoices and uninvoiced job balances', () => {
    const invoices: InvoiceMetricRow[] = [
      { id: 'inv-1', amount: 400, amount_paid: 100, payment_status: 'partially_paid', job_id: 'job-a' }
    ];
    const invoiceStillOwed = calculateStillOwed(invoices);
    const collectedByJob = sumJobPaymentsByJobId([
      { job_id: 'job-b', amount: 50, paid_at: '2026-07-01' }
    ]);
    const directOutstanding = calculateDirectJobOutstanding(
      [
        { id: 'job-a', revenue_amount: 400 },
        { id: 'job-b', revenue_amount: 200 }
      ],
      new Set(['job-a']),
      collectedByJob
    );

    assert.equal(invoiceStillOwed, 300);
    assert.equal(directOutstanding, 150);
    assert.equal(invoiceStillOwed + directOutstanding, 450);
  });

  it('cash after paid costs equals collected minus paid contractor costs and expenses', () => {
    assert.equal(
      calculateCashAfterPaidCosts({
        cashCollected: 500,
        contractorCashPaid: 120,
        otherCashExpenses: 40
      }),
      340
    );
    assert.equal(
      calculateCashAfterPaidCosts({
        cashCollected: 0,
        contractorCashPaid: 0,
        otherCashExpenses: 0
      }),
      0
    );
  });

  it('legacy money summary no longer includes conflicting Net cash', () => {
    const rows = buildMoneySummaryMetrics({
      rangeLabel: 'This month',
      collected: 0,
      outstanding: 0,
      invoiced: 0,
      expensesPaid: 0,
      hasCreatedInvoices: false
    });

    assert.deepEqual(
      rows.map((row) => row.key),
      ['collected', 'outstanding']
    );
    assert.equal(rows.every((row) => row.value === 0), true);
    assert.equal(formatCurrency(0).includes('0'), true);
    assert.equal(rows.some((row) => /net cash/i.test(row.label)), false);
  });

  it('includes invoiced metric only after invoices exist', () => {
    const rows = buildMoneySummaryMetrics({
      rangeLabel: 'This month',
      collected: 200,
      outstanding: 50,
      invoiced: 300,
      expensesPaid: 40,
      hasCreatedInvoices: true
    });

    assert.deepEqual(
      rows.map((row) => row.key),
      ['collected', 'outstanding', 'invoiced']
    );
    assert.equal(rows.find((row) => row.key === 'invoiced')?.value, 300);
    assert.equal(rows.find((row) => row.key === 'collected')?.label, 'Collected this month');
  });

  it('primary metrics use Cash after paid costs as the only cash summary', () => {
    const rows = buildPrimaryDashboardMetrics({
      expectedRevenue: 300,
      collected: 200,
      outstanding: 50,
      contractorCost: 80,
      expectedProfit: 180,
      cashAfterPaidCosts: 160
    });

    assert.equal(rows.find((row) => row.key === 'cashAfterPaidCosts')?.value, 160);
    assert.equal(rows.some((row) => row.key === 'cashAfterPaidCosts'), true);
    assert.equal(
      rows.filter((row) => /cash/i.test(row.label)).length,
      1
    );
  });

  it('does not treat expected job amounts as collected cash', () => {
    const collected = calculatePaidToYou({
      invoices: [],
      paymentRows: [],
      jobPaymentRows: [],
      start: '2026-07-01',
      end: '2026-08-01',
      range: 'month'
    }).paidToYou;

    assert.equal(collected, 0);
    assert.equal(
      calculateCashAfterPaidCosts({
        cashCollected: collected,
        contractorCashPaid: 0,
        otherCashExpenses: 0
      }),
      0
    );
  });
});
