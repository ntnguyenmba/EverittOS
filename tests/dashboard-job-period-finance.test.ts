import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildJobOperationalDateMap,
  calculateCashAfterPaidCosts,
  calculateContractorAccruedCost,
  calculateCustomerInvoices,
  calculateOutstandingBreakdown,
  calculatePaidToYou,
  calculateUninvoicedExpectedRevenue,
  collectibleInvoicedJobIds,
  dashboardInvoicePeriodDate,
  rangeBounds,
  type InvoiceMetricRow,
  type InvoicePaymentRow,
  type JobPaymentMetricRow,
  type LaborCostRow
} from '@/lib/dashboard-metrics';

test('invoice created after job date stays in the job operational period', () => {
  const jobs = [
    {
      id: 'job-1',
      status: 'completed',
      completed_at: '2026-06-10',
      start_date: '2026-06-08',
      scheduled_start: '2026-06-08',
      created_at: '2026-06-01'
    }
  ];
  const jobDates = buildJobOperationalDateMap(jobs);
  const invoices: InvoiceMetricRow[] = [
    {
      id: 'inv-1',
      amount: 500,
      invoice_date: '2026-07-15',
      created_at: '2026-07-15',
      payment_status: 'unpaid',
      status: 'sent',
      job_id: 'job-1'
    }
  ];
  assert.equal(dashboardInvoicePeriodDate(invoices[0], jobDates), '2026-06-10');
  assert.equal(calculateCustomerInvoices(invoices, '2026-07-01', '2026-08-01', jobDates), 0);
  assert.equal(calculateCustomerInvoices(invoices, '2026-06-01', '2026-07-01', jobDates), 500);
});

test('direct payment without an invoice counts in collected and clears outstanding', () => {
  const jobs = [{ id: 'job-1', revenue_amount: 400, status: 'completed', title: 'Clean' }];
  const jobPayments: JobPaymentMetricRow[] = [{ job_id: 'job-1', amount: 400, paid_at: '2026-07-12' }];
  const collected = calculatePaidToYou({
    invoices: [],
    paymentRows: [],
    jobPaymentRows: jobPayments,
    start: '2026-07-01',
    end: '2026-08-01',
    range: 'month'
  });
  const outstanding = calculateOutstandingBreakdown({
    invoices: [],
    jobs,
    jobPayments,
    invoicePayments: []
  });
  assert.equal(collected.paidToYou, 400);
  assert.equal(outstanding.total, 0);
});

test('invoice payment is not double counted with direct job payments', () => {
  const invoices: InvoiceMetricRow[] = [
    {
      id: 'inv-1',
      amount: 800,
      amount_paid: 800,
      invoice_date: '2026-07-01',
      payment_status: 'paid',
      status: 'paid',
      job_id: 'job-1'
    }
  ];
  const invoicePayments: InvoicePaymentRow[] = [{ invoice_id: 'inv-1', amount: 800, paid_at: '2026-07-05' }];
  // Same cash must not also appear as a direct job payment.
  const collected = calculatePaidToYou({
    invoices,
    paymentRows: invoicePayments,
    jobPaymentRows: [],
    start: '2026-07-01',
    end: '2026-08-01',
    range: 'month'
  });
  assert.equal(collected.paidToYou, 800);
});

test('partially paid invoice contributes only remaining balance to outstanding', () => {
  const invoices: InvoiceMetricRow[] = [
    {
      id: 'inv-1',
      amount: 1000,
      amount_paid: 250,
      payment_status: 'partially_paid',
      status: 'partial',
      job_id: 'job-1'
    }
  ];
  const breakdown = calculateOutstandingBreakdown({
    invoices,
    jobs: [{ id: 'job-1', revenue_amount: 1000, status: 'completed' }],
    jobPayments: [],
    invoicePayments: [{ invoice_id: 'inv-1', amount: 250, paid_at: '2026-07-02' }]
  });
  assert.equal(breakdown.total, 750);
});

test('fully paid direct-payment job has zero outstanding', () => {
  const breakdown = calculateOutstandingBreakdown({
    invoices: [],
    jobs: [{ id: 'job-1', revenue_amount: 950, status: 'completed' }],
    jobPayments: [{ job_id: 'job-1', amount: 950, paid_at: '2026-07-01' }],
    invoicePayments: []
  });
  assert.equal(breakdown.total, 0);
});

test('labor created after the job date still counts in the job period', () => {
  const jobDates = buildJobOperationalDateMap([
    {
      id: 'job-1',
      status: 'completed',
      completed_at: '2026-06-20',
      start_date: '2026-06-18',
      created_at: '2026-06-01'
    }
  ]);
  const labor: LaborCostRow[] = [
    {
      job_id: 'job-1',
      total_cost: 300,
      created_at: '2026-07-28',
      payment_status: 'unpaid'
    }
  ];
  assert.equal(calculateContractorAccruedCost(labor, '2026-07-01', '2026-08-01', jobDates), 0);
  assert.equal(calculateContractorAccruedCost(labor, '2026-06-01', '2026-07-01', jobDates), 300);
});

test('legacy labor row with no job operational date falls back to created_at', () => {
  const labor: LaborCostRow[] = [
    { total_cost: 120, created_at: '2026-07-08', payment_status: 'unpaid' }
  ];
  assert.equal(calculateContractorAccruedCost(labor, '2026-07-01', '2026-08-01', new Map()), 120);
  assert.equal(calculateContractorAccruedCost(labor, '2026-06-01', '2026-07-01', new Map()), 0);
});

test('cash after paid costs subtracts only paid contractor and paid expense amounts', () => {
  assert.equal(
    calculateCashAfterPaidCosts({
      cashCollected: 1000,
      contractorCashPaid: 200,
      otherCashExpenses: 50
    }),
    750
  );
});

test('invoice without a linked job uses invoice date for period totals', () => {
  const invoices: InvoiceMetricRow[] = [
    {
      id: 'inv-orphan',
      amount: 175,
      invoice_date: '2026-07-09',
      payment_status: 'unpaid',
      status: 'sent'
    }
  ];
  assert.equal(calculateCustomerInvoices(invoices, '2026-07-01', '2026-08-01', new Map()), 175);
  assert.equal(calculateCustomerInvoices(invoices, '2026-06-01', '2026-07-01', new Map()), 0);
});

test('uninvoiced jobs are not double counted when an active invoice exists', () => {
  const invoices: InvoiceMetricRow[] = [
    {
      id: 'inv-1',
      amount: 600,
      invoice_date: '2026-07-01',
      payment_status: 'unpaid',
      status: 'sent',
      job_id: 'job-1'
    }
  ];
  const jobs = [
    {
      id: 'job-1',
      revenue_amount: 600,
      status: 'completed',
      completed_at: '2026-07-02'
    },
    {
      id: 'job-2',
      revenue_amount: 200,
      status: 'completed',
      completed_at: '2026-07-03'
    }
  ];
  const uninvoiced = calculateUninvoicedExpectedRevenue(
    jobs,
    collectibleInvoicedJobIds(invoices),
    '2026-07-01',
    '2026-08-01'
  );
  assert.equal(uninvoiced, 200);
});

test('rangeBounds covers month, quarter, year, last year, and all time', () => {
  const now = new Date(2026, 6, 15); // July 15, 2026 local
  assert.deepEqual(rangeBounds('month', now), { start: '2026-07-01', end: '2026-08-01' });
  assert.deepEqual(rangeBounds('quarter', now), { start: '2026-07-01', end: '2026-10-01' });
  assert.deepEqual(rangeBounds('year', now), { start: '2026-01-01', end: '2027-01-01' });
  assert.deepEqual(rangeBounds('last_year', now), { start: '2025-01-01', end: '2026-01-01' });
  assert.deepEqual(rangeBounds('all_time', now), { start: null, end: null });
});
