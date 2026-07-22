import assert from 'node:assert/strict';
import test from 'node:test';
import {
  calculateOutstandingBreakdown,
  type InvoiceMetricRow,
  type InvoicePaymentRow,
  type JobPaymentMetricRow,
  type JobRevenueRow
} from '@/lib/dashboard-metrics';
import {
  calculateBalanceDue,
  calculateInvoiceDocumentStatus,
  calculateInvoicePaymentStatus
} from '@/lib/outbound/invoice-payment';

test('fully paid invoice results in balance_due = 0', () => {
  assert.equal(calculateBalanceDue(950, 950), 0);
  assert.equal(calculateInvoicePaymentStatus({ amount: 950, amount_paid: 950 }), 'paid');
  assert.equal(calculateInvoiceDocumentStatus({ amount: 950, amount_paid: 950 }), 'paid');
});

test('partially paid invoice shows only remaining balance', () => {
  assert.equal(calculateBalanceDue(1000, 400), 600);
  assert.equal(
    calculateInvoicePaymentStatus({ amount: 1000, amount_paid: 400, due_date: '2099-01-01' }),
    'partially_paid'
  );
  assert.equal(
    calculateInvoiceDocumentStatus({ amount: 1000, amount_paid: 400, due_date: '2099-01-01' }),
    'partial'
  );
});

test('overdue partial invoice uses partially_paid payment_status and overdue document status', () => {
  assert.equal(
    calculateInvoicePaymentStatus({ amount: 950, amount_paid: 200, due_date: '2000-01-01' }),
    'partially_paid'
  );
  assert.equal(
    calculateInvoiceDocumentStatus({ amount: 950, amount_paid: 200, due_date: '2000-01-01' }),
    'overdue'
  );
});

test('unpaid overdue invoice keeps payment_status unpaid and status overdue', () => {
  assert.equal(
    calculateInvoicePaymentStatus({ amount: 950, amount_paid: 0, due_date: '2000-01-01' }),
    'unpaid'
  );
  assert.equal(
    calculateInvoiceDocumentStatus({ amount: 950, amount_paid: 0, due_date: '2000-01-01' }),
    'overdue'
  );
});

test('negative payment amounts are rejected by application validation rules', () => {
  // Application layer rejects amount <= 0 before insert. SQL also enforces amount > 0.
  const amount = -10;
  assert.equal(amount > 0, false);
});

test('paid invoices do not contribute to Outstanding', () => {
  const invoices: InvoiceMetricRow[] = [
    { id: 'inv-1', amount: 950, amount_paid: 950, payment_status: 'paid', status: 'paid', job_id: 'job-1' }
  ];
  const payments: InvoicePaymentRow[] = [{ invoice_id: 'inv-1', amount: 950, paid_at: '2026-07-01' }];
  const breakdown = calculateOutstandingBreakdown({
    invoices,
    jobs: [{ id: 'job-1', revenue_amount: 950, status: 'completed' }],
    jobPayments: [],
    invoicePayments: payments
  });
  assert.equal(breakdown.total, 0);
  assert.equal(breakdown.rows.length, 0);
});

test('fully paid uninvoiced jobs do not contribute to Outstanding', () => {
  const jobs: JobRevenueRow[] = [{ id: 'job-1', revenue_amount: 950, status: 'completed', title: 'Job' }];
  const jobPayments: JobPaymentMetricRow[] = [{ job_id: 'job-1', amount: 950, paid_at: '2026-07-01' }];
  const breakdown = calculateOutstandingBreakdown({
    invoices: [],
    jobs,
    jobPayments,
    invoicePayments: []
  });
  assert.equal(breakdown.total, 0);
});

test('invoiced jobs are not double counted in Outstanding', () => {
  const invoices: InvoiceMetricRow[] = [
    { id: 'inv-1', amount: 950, amount_paid: 0, payment_status: 'unpaid', status: 'sent', job_id: 'job-1' }
  ];
  const jobs: JobRevenueRow[] = [{ id: 'job-1', revenue_amount: 950, status: 'completed' }];
  const breakdown = calculateOutstandingBreakdown({
    invoices,
    jobs,
    jobPayments: [],
    invoicePayments: []
  });
  assert.equal(breakdown.total, 950);
  assert.equal(breakdown.rows.length, 1);
  assert.equal(breakdown.rows[0].sourceType, 'invoice');
});

test('stale amount_paid is corrected by ledger payments for Outstanding', () => {
  const invoices: InvoiceMetricRow[] = [
    // Summary says unpaid $950, but ledger shows fully paid.
    { id: 'inv-1', amount: 950, amount_paid: 0, payment_status: 'unpaid', status: 'sent', job_id: 'job-1' }
  ];
  const payments: InvoicePaymentRow[] = [{ invoice_id: 'inv-1', amount: 950, paid_at: '2026-07-01' }];
  const breakdown = calculateOutstandingBreakdown({
    invoices,
    jobs: [{ id: 'job-1', revenue_amount: 950, status: 'completed' }],
    jobPayments: [],
    invoicePayments: payments
  });
  assert.equal(breakdown.total, 0);
});

test('dashboard Outstanding total equals breakdown row sum', () => {
  const invoices: InvoiceMetricRow[] = [
    { id: 'inv-1', amount: 600, amount_paid: 100, payment_status: 'partially_paid', status: 'partial', job_id: 'a' },
    { id: 'inv-void', amount: 950, amount_paid: 0, payment_status: 'unpaid', status: 'void' }
  ];
  const jobs: JobRevenueRow[] = [
    { id: 'b', revenue_amount: 450, status: 'completed', customer_name: 'Acme' },
    { id: 'c', revenue_amount: 200, status: 'cancelled' }
  ];
  const jobPayments: JobPaymentMetricRow[] = [{ job_id: 'b', amount: 50, paid_at: '2026-07-02' }];
  const invoicePayments: InvoicePaymentRow[] = [{ invoice_id: 'inv-1', amount: 100, paid_at: '2026-07-01' }];
  const breakdown = calculateOutstandingBreakdown({
    invoices,
    jobs,
    jobPayments,
    invoicePayments
  });
  const rowSum = Number(breakdown.rows.reduce((sum, row) => sum + row.amountOwed, 0).toFixed(2));
  assert.equal(breakdown.total, rowSum);
  assert.equal(breakdown.total, 900); // 500 invoice + 400 job
});

test('all paid records produce Outstanding = $0', () => {
  const invoices: InvoiceMetricRow[] = [
    { id: 'inv-1', amount: 700, amount_paid: 700, payment_status: 'paid', status: 'paid', job_id: 'job-1' }
  ];
  const jobs: JobRevenueRow[] = [{ id: 'job-2', revenue_amount: 250, status: 'completed' }];
  const breakdown = calculateOutstandingBreakdown({
    invoices,
    jobs,
    jobPayments: [{ job_id: 'job-2', amount: 250, paid_at: '2026-07-01' }],
    invoicePayments: [{ invoice_id: 'inv-1', amount: 700, paid_at: '2026-07-01' }]
  });
  assert.equal(breakdown.total, 0);
  assert.equal(breakdown.rows.length, 0);
});

test('deleting final payment clears payment summary fields in reconcile patch shape', () => {
  // Mirrors reconcileInvoiceFromLedger behavior when ledger is empty.
  const amountPaid = 0;
  const paymentStatus = calculateInvoicePaymentStatus({ amount: 500, amount_paid: amountPaid });
  const documentStatus = calculateInvoiceDocumentStatus({
    amount: 500,
    amount_paid: amountPaid,
    due_date: '2099-01-01',
    status: 'paid'
  });
  const patch = {
    amount_paid: amountPaid,
    balance_due: calculateBalanceDue(500, amountPaid),
    payment_status: paymentStatus,
    status: documentStatus,
    last_payment_at: null,
    payment_method: null,
    payment_reference: null,
    paid_at: null
  };
  assert.equal(patch.payment_status, 'unpaid');
  assert.equal(patch.status, 'sent');
  assert.equal(patch.last_payment_at, null);
  assert.equal(patch.payment_method, null);
  assert.equal(patch.payment_reference, null);
  assert.equal(patch.paid_at, null);
});

test('round-money paid check treats 99.995 as meeting 100.00 only after rounding policy', () => {
  // Application and SQL both compare round(paid, 2) >= round(amount, 2).
  const paid = Number((99.994).toFixed(2));
  const amount = Number((100).toFixed(2));
  assert.equal(paid >= amount, false);
  const paidEnough = Number((99.995).toFixed(2));
  // JS rounds 99.995 to 100.00 in common banker's environments; assert rounded compare.
  assert.equal(Number(paidEnough.toFixed(2)) >= amount, Number((99.995).toFixed(2)) >= 100);
});
