import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  calculateBalanceDue,
  calculateInvoicePaymentStatus
} from '@/lib/outbound/invoice-payment';
import { calculateJobPaymentStatus, calculateOutstandingBalance } from '@/lib/finance/job-payments';
import { computeJobProfitability } from '@/lib/finance-server';
import { calculatePaidToYou, type InvoiceMetricRow, type JobPaymentMetricRow } from '@/lib/dashboard-metrics';

describe('invoice payment ledger reconciliation rules', () => {
  it('recalculates paid, outstanding, and status after a partial payment edit', () => {
    const invoiceAmount = 1000;
    const ledgerTotalAfterEdit = 350;
    const amountPaid = ledgerTotalAfterEdit;
    const balanceDue = calculateBalanceDue(invoiceAmount, amountPaid);
    const status = calculateInvoicePaymentStatus({
      amount: invoiceAmount,
      amount_paid: amountPaid,
      due_date: '2099-01-01'
    });

    assert.equal(amountPaid, 350);
    assert.equal(balanceDue, 650);
    assert.equal(status, 'partially_paid');
  });

  it('marks invoice paid when ledger total meets invoice amount', () => {
    const status = calculateInvoicePaymentStatus({
      amount: 500,
      amount_paid: 500,
      due_date: '2099-01-01'
    });
    assert.equal(status, 'paid');
    assert.equal(calculateBalanceDue(500, 500), 0);
  });

  it('marks unpaid when all ledger rows are removed', () => {
    const status = calculateInvoicePaymentStatus({
      amount: 500,
      amount_paid: 0,
      due_date: '2099-01-01'
    });
    assert.equal(status, 'unpaid');
    assert.equal(calculateJobPaymentStatus(500, 0), 'unpaid');
  });
});

describe('direct versus invoice payment counting', () => {
  it('does not double count when invoice payments exist and job payments are empty', () => {
    const invoices: InvoiceMetricRow[] = [
      {
        id: 'inv-1',
        amount: 800,
        amount_paid: 800,
        invoice_date: '2026-07-01',
        payment_status: 'paid'
      }
    ];
    const invoicePayments = [{ invoice_id: 'inv-1', amount: 800, paid_at: '2026-07-05' }];
    const jobPayments: JobPaymentMetricRow[] = [];

    const paid = calculatePaidToYou({
      invoices,
      paymentRows: invoicePayments,
      jobPaymentRows: jobPayments,
      start: '2026-07-01',
      end: '2026-08-01',
      range: 'month'
    }).paidToYou;

    assert.equal(paid, 800);
  });

  it('adds direct job payments by paid_at without treating expected amount as cash', () => {
    const jobPayments: JobPaymentMetricRow[] = [
      { job_id: 'job-1', amount: 120, paid_at: '2026-07-12' }
    ];
    const paid = calculatePaidToYou({
      invoices: [],
      paymentRows: [],
      jobPaymentRows: jobPayments,
      start: '2026-07-01',
      end: '2026-08-01',
      range: 'month'
    }).paidToYou;

    assert.equal(paid, 120);
    assert.equal(calculateOutstandingBalance(400, 120), 280);
  });

  it('keeps collected profit based on cash received minus expenses', () => {
    const result = computeJobProfitability({
      hasInvoice: true,
      invoiceTotal: 1000,
      manualRevenue: 900,
      collectedAmount: 600,
      laborCost: 100,
      materialCost: 50,
      otherExpenses: 50,
      payments: []
    });

    assert.equal(result.expectedAmount, 1000);
    assert.equal(result.collectedAmount, 600);
    assert.equal(result.outstanding, 400);
    assert.equal(result.paymentStatus, 'partially_paid');
    assert.equal(result.collectedProfit, 400);
    assert.equal(result.expectedProfit, 800);
  });
});
