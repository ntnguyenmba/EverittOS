import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  buildMoneySummaryMetrics,
  calculateDirectJobOutstanding,
  calculateMoneySummaryNetCash,
  calculatePaidToYou,
  calculateStillOwed,
  formatCurrency,
  sumJobPaymentsByJobId,
  type InvoiceMetricRow,
  type InvoicePaymentRow,
  type JobPaymentMetricRow
} from '@/lib/dashboard-metrics';

describe('Money summary calculations', () => {
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

  it('net cash equals collected minus expenses paid', () => {
    assert.equal(calculateMoneySummaryNetCash(500, 120), 380);
    assert.equal(calculateMoneySummaryNetCash(0, 0), 0);
    assert.equal(calculateMoneySummaryNetCash(100, 250), -150);
  });

  it('shows $0 labels for no-data accounts and hides invoiced when unused', () => {
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
      ['collected', 'outstanding', 'netCash']
    );
    assert.equal(rows.every((row) => row.value === 0), true);
    assert.equal(formatCurrency(0).includes('0'), true);
    assert.equal(rows.some((row) => row.label.toLowerCase().includes('not available')), false);
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
      ['collected', 'outstanding', 'invoiced', 'netCash']
    );
    assert.equal(rows.find((row) => row.key === 'invoiced')?.value, 300);
    assert.equal(rows.find((row) => row.key === 'netCash')?.value, 160);
    assert.equal(rows.find((row) => row.key === 'collected')?.label, 'Collected this month');
    assert.equal(rows.find((row) => row.key === 'outstanding')?.label, 'Outstanding balance');
    assert.equal(rows.find((row) => row.key === 'invoiced')?.label, 'Invoiced this month');
    assert.equal(rows.find((row) => row.key === 'netCash')?.label, 'Net cash this month');
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
    assert.equal(calculateMoneySummaryNetCash(collected, 0), 0);
  });
});
