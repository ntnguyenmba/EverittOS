import assert from 'node:assert/strict';
import test from 'node:test';

import {
  calculateCustomerInvoices,
  calculateDirectJobOutstanding,
  calculateOutstandingBreakdown,
  calculateStillOwed,
  cappedAmountPaid,
  collectibleInvoicedJobIds,
  remainingBalance,
  sumJobPaymentsByJobId
} from '../lib/dashboard-metrics';

test('collectible invoices are not double counted as direct job revenue', () => {
  const invoices = [
    {
      id: 'invoice-1',
      job_id: 'job-1',
      amount: 280,
      amount_paid: 0,
      invoice_date: '2026-08-01',
      status: 'sent'
    }
  ];
  const jobs = [
    { id: 'job-1', revenue_amount: 280, status: 'completed' },
    { id: 'job-2', revenue_amount: 140, status: 'completed' }
  ];

  const invoicedJobIds = collectibleInvoicedJobIds(invoices);
  const directOutstanding = calculateDirectJobOutstanding(jobs, invoicedJobIds, new Map());

  assert.equal(calculateCustomerInvoices(invoices, '2026-08-01', '2026-09-01'), 280);
  assert.equal(directOutstanding, 140);
});

test('cancelled jobs never create an outstanding customer balance', () => {
  const jobs = [
    { id: 'job-cancelled-us', revenue_amount: 300, status: 'canceled' },
    { id: 'job-cancelled-uk', revenue_amount: 225, status: 'cancelled' }
  ];

  assert.equal(calculateDirectJobOutstanding(jobs, new Set(), new Map()), 0);
});

test('cancelled, draft, void, and scheduled invoices are excluded from still owed', () => {
  const invoices = [
    { amount: 100, amount_paid: 0, status: 'cancelled' },
    { amount: 100, amount_paid: 0, status: 'draft' },
    { amount: 100, amount_paid: 0, status: 'void' },
    { amount: 100, amount_paid: 0, status: 'scheduled' },
    { amount: 125, amount_paid: 25, status: 'sent' }
  ];

  assert.equal(calculateStillOwed(invoices), 100);
});

test('overpayments cannot create negative balances or inflate collected invoice value', () => {
  assert.equal(cappedAmountPaid(90, 150), 90);
  assert.equal(remainingBalance(90, 150), 0);
  assert.equal(remainingBalance(90, -20), 90);
});

test('ledger invoice payments override stale invoice amount_paid values', () => {
  const result = calculateOutstandingBreakdown({
    invoices: [
      {
        id: 'invoice-1',
        job_id: 'job-1',
        amount: 300,
        amount_paid: 300,
        status: 'sent'
      }
    ],
    jobs: [{ id: 'job-1', revenue_amount: 300, status: 'completed' }],
    jobPayments: [],
    invoicePayments: [{ invoice_id: 'invoice-1', amount: 75, paid_at: '2026-08-01' }]
  });

  assert.equal(result.invoiceTotal, 225);
  assert.equal(result.jobTotal, 0);
  assert.equal(result.total, 225);
  assert.equal(result.rows[0]?.amountPaid, 75);
  assert.equal(result.rows[0]?.amountOwed, 225);
});

test('multiple job payments are summed and outstanding never falls below zero', () => {
  const payments = sumJobPaymentsByJobId([
    { job_id: 'job-1', amount: 60 },
    { job_id: 'job-1', amount: 50 },
    { job_id: 'job-1', amount: 100 }
  ]);

  const result = calculateOutstandingBreakdown({
    invoices: [],
    jobs: [{ id: 'job-1', revenue_amount: 180, status: 'completed' }],
    jobPayments: [
      { job_id: 'job-1', amount: 60 },
      { job_id: 'job-1', amount: 50 },
      { job_id: 'job-1', amount: 100 }
    ]
  });

  assert.equal(payments.get('job-1'), 210);
  assert.equal(result.total, 0);
  assert.equal(result.rows.length, 0);
});

test('outstanding breakdown combines invoice and uninvoiced job balances exactly once', () => {
  const result = calculateOutstandingBreakdown({
    invoices: [
      {
        id: 'invoice-1',
        job_id: 'job-invoiced',
        amount: 250,
        amount_paid: 100,
        status: 'sent'
      }
    ],
    jobs: [
      { id: 'job-invoiced', revenue_amount: 250, status: 'completed' },
      { id: 'job-direct', revenue_amount: 175, status: 'completed' },
      { id: 'job-cancelled', revenue_amount: 500, status: 'cancelled' }
    ],
    jobPayments: [{ job_id: 'job-direct', amount: 25 }]
  });

  assert.equal(result.invoiceTotal, 150);
  assert.equal(result.jobTotal, 150);
  assert.equal(result.total, 300);
  assert.equal(result.rows.length, 2);
});
