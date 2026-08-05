import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  buildPrimaryDashboardMetrics,
  calculateCashAfterPaidCosts,
  calculateDirectJobOutstanding,
  calculateJobRevenue,
  calculateMoneyKept,
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

  it('keeps direct payments after an invoice is created later with no invoice payments', () => {
    const invoices: InvoiceMetricRow[] = [
      {
        id: 'inv-1',
        amount: 500,
        amount_paid: 0,
        invoice_date: '2026-07-20',
        payment_status: 'unpaid',
        status: 'sent',
        job_id: 'job-1'
      }
    ];
    const collected = calculatePaidToYou({
      invoices,
      paymentRows: [],
      jobPaymentRows: [{ job_id: 'job-1', amount: 175, paid_at: '2026-07-08' }],
      start: '2026-07-01',
      end: '2026-08-01',
      range: 'month'
    }).paidToYou;

    assert.equal(collected, 175);
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
      calculateMoneyKept({
        moneyReceived: 0,
        paidContractors: 0,
        businessExpenses: 0
      }),
      0
    );
  });

  it('job revenue always equals money received plus customers owe', () => {
    assert.equal(calculateJobRevenue(200, 50), 250);
    assert.equal(calculateJobRevenue(0, 0), 0);
  });

  it('primary metrics use Money kept as the only cash summary', () => {
    const rows = buildPrimaryDashboardMetrics({
      expectedRevenue: 300,
      collected: 200,
      outstanding: 50,
      contractorCost: 80,
      expectedProfit: 180,
      cashAfterPaidCosts: 160
    });

    assert.equal(rows.find((row) => row.key === 'cashAfterPaidCosts')?.value, 160);
    assert.equal(rows.find((row) => row.key === 'cashAfterPaidCosts')?.label, 'Money kept');
    assert.equal(rows.find((row) => row.key === 'expectedRevenue')?.label, 'Job revenue');
    assert.equal(formatCurrency(0).includes('0'), true);
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
