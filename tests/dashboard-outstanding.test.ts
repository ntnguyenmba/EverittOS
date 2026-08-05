import assert from 'node:assert/strict';
import test from 'node:test';
import {
  calculateCustomerInvoices,
  calculateDirectJobOutstanding,
  calculateExpectedRevenue,
  calculateOutstandingBreakdown,
  calculatePaidToYou,
  calculateStillOwed,
  calculateUninvoicedExpectedRevenue,
  collectibleInvoicedJobIds,
  isCollectibleInvoice,
  type InvoiceMetricRow,
  type JobPaymentMetricRow,
  type JobRevenueRow
} from '@/lib/dashboard-metrics';
import { calculateCashAfterPaidCosts, calculateEstimatedProfit } from '@/lib/dashboard-metrics';
import { getCompletedJobReportingDate } from '@/lib/job-operational-date';
import { getAuthFlowCopy } from '@/lib/i18n/auth-copy';
import { getDashboardFinanceCopy } from '@/lib/i18n/dashboard-finance-copy';

test('fully paid invoice = $0 outstanding', () => {
  const invoices: InvoiceMetricRow[] = [
    { id: 'inv-1', amount: 500, amount_paid: 500, payment_status: 'paid', status: 'paid', job_id: 'job-1' }
  ];
  const breakdown = calculateOutstandingBreakdown({ invoices, jobs: [], jobPayments: [] });
  assert.equal(breakdown.total, 0);
  assert.equal(breakdown.rows.length, 0);
});

test('partially paid invoice = remaining balance only', () => {
  const invoices: InvoiceMetricRow[] = [
    { id: 'inv-1', amount: 1000, amount_paid: 400, payment_status: 'partial', status: 'sent', job_id: 'job-1' }
  ];
  const breakdown = calculateOutstandingBreakdown({ invoices, jobs: [], jobPayments: [] });
  assert.equal(breakdown.total, 600);
  assert.equal(breakdown.rows.length, 1);
  assert.equal(breakdown.rows[0].amountOwed, 600);
});

test('fully paid direct-payment job = $0 outstanding', () => {
  const jobs: JobRevenueRow[] = [{ id: 'job-1', revenue_amount: 800, status: 'completed', title: 'Clean' }];
  const payments: JobPaymentMetricRow[] = [{ job_id: 'job-1', amount: 800, paid_at: '2026-07-01' }];
  const breakdown = calculateOutstandingBreakdown({ invoices: [], jobs, jobPayments: payments });
  assert.equal(breakdown.total, 0);
  assert.equal(breakdown.rows.length, 0);
});

test('partially paid uninvoiced job = remaining balance only', () => {
  const jobs: JobRevenueRow[] = [{ id: 'job-1', revenue_amount: 900, status: 'completed', title: 'Deep clean' }];
  const payments: JobPaymentMetricRow[] = [{ job_id: 'job-1', amount: 300, paid_at: '2026-07-01' }];
  const breakdown = calculateOutstandingBreakdown({ invoices: [], jobs, jobPayments: payments });
  assert.equal(breakdown.total, 600);
  assert.equal(breakdown.rows[0].sourceType, 'job');
});

test('invoiced job is not counted again as uninvoiced', () => {
  const invoices: InvoiceMetricRow[] = [
    { id: 'inv-1', amount: 500, amount_paid: 0, payment_status: 'unpaid', status: 'sent', job_id: 'job-1' }
  ];
  const jobs: JobRevenueRow[] = [{ id: 'job-1', revenue_amount: 500, status: 'completed' }];
  const breakdown = calculateOutstandingBreakdown({ invoices, jobs, jobPayments: [] });
  assert.equal(breakdown.total, 500);
  assert.equal(breakdown.invoiceTotal, 500);
  assert.equal(breakdown.jobTotal, 0);
  assert.equal(breakdown.rows.length, 1);
  assert.equal(breakdown.rows[0].sourceType, 'invoice');
});

test('cancelled job is excluded from outstanding', () => {
  const jobs: JobRevenueRow[] = [{ id: 'job-1', revenue_amount: 400, status: 'cancelled' }];
  const breakdown = calculateOutstandingBreakdown({ invoices: [], jobs, jobPayments: [] });
  assert.equal(breakdown.total, 0);
});

test('voided invoice is excluded from outstanding', () => {
  const invoices: InvoiceMetricRow[] = [
    { id: 'inv-1', amount: 950, amount_paid: 0, payment_status: 'unpaid', status: 'void' },
    { id: 'inv-2', amount: 950, amount_paid: 0, payment_status: 'void', status: 'sent' },
    { id: 'inv-3', amount: 200, amount_paid: 0, payment_status: 'unpaid', status: 'draft' }
  ];
  assert.equal(isCollectibleInvoice(invoices[0]), false);
  assert.equal(isCollectibleInvoice(invoices[1]), false);
  assert.equal(isCollectibleInvoice(invoices[2]), false);
  const breakdown = calculateOutstandingBreakdown({ invoices, jobs: [], jobPayments: [] });
  assert.equal(breakdown.total, 0);
});

test('cancelled via status field while payment_status is unpaid is excluded', () => {
  const invoices: InvoiceMetricRow[] = [
    { id: 'inv-1', amount: 950, amount_paid: 0, payment_status: 'unpaid', status: 'cancelled' }
  ];
  assert.equal(calculateStillOwed(invoices), 0);
  assert.equal(calculateOutstandingBreakdown({ invoices, jobs: [], jobPayments: [] }).total, 0);
});

test('deleted payment is excluded (absent from payment rows)', () => {
  const jobs: JobRevenueRow[] = [{ id: 'job-1', revenue_amount: 500, status: 'completed' }];
  // Soft-deleted payments are not returned by queries, so they are absent here.
  const payments: JobPaymentMetricRow[] = [];
  const breakdown = calculateOutstandingBreakdown({ invoices: [], jobs, jobPayments: payments });
  assert.equal(breakdown.total, 500);
});

test('drill-down sum equals dashboard outstanding total', () => {
  const invoices: InvoiceMetricRow[] = [
    { id: 'inv-1', amount: 1000, amount_paid: 250, payment_status: 'partial', status: 'sent', job_id: 'job-a' },
    { id: 'inv-void', amount: 999, amount_paid: 0, payment_status: 'unpaid', status: 'voided', job_id: 'job-b' }
  ];
  const jobs: JobRevenueRow[] = [
    { id: 'job-a', revenue_amount: 1000, status: 'completed' },
    { id: 'job-c', revenue_amount: 400, status: 'completed', customer_name: 'Acme' },
    { id: 'job-d', revenue_amount: 100, status: 'cancelled' }
  ];
  const payments: JobPaymentMetricRow[] = [{ job_id: 'job-c', amount: 100, paid_at: '2026-07-02' }];
  const breakdown = calculateOutstandingBreakdown({ invoices, jobs, jobPayments: payments });
  const rowSum = Number(breakdown.rows.reduce((sum, row) => sum + row.amountOwed, 0).toFixed(2));
  assert.equal(breakdown.total, rowSum);
  assert.equal(breakdown.total, 1050); // 750 invoice + 300 job
  assert.equal(breakdown.total, breakdown.invoiceTotal + breakdown.jobTotal);
});

test('when every invoice and job is fully paid, outstanding is exactly $0', () => {
  const invoices: InvoiceMetricRow[] = [
    { id: 'inv-1', amount: 1200, amount_paid: 1200, payment_status: 'paid', status: 'paid', job_id: 'job-1' }
  ];
  const jobs: JobRevenueRow[] = [{ id: 'job-2', revenue_amount: 300, status: 'completed' }];
  const payments: JobPaymentMetricRow[] = [{ job_id: 'job-2', amount: 300, paid_at: '2026-07-01' }];
  const breakdown = calculateOutstandingBreakdown({ invoices, jobs, jobPayments: payments });
  assert.equal(breakdown.total, 0);
  assert.equal(breakdown.rows.length, 0);
});

test('draft invoice does not block uninvoiced job outstanding', () => {
  const invoices: InvoiceMetricRow[] = [
    { id: 'draft', amount: 500, amount_paid: 0, payment_status: 'draft', status: 'draft', job_id: 'job-1' }
  ];
  const jobs: JobRevenueRow[] = [{ id: 'job-1', revenue_amount: 500, status: 'completed' }];
  assert.equal(collectibleInvoicedJobIds(invoices).has('job-1'), false);
  const breakdown = calculateOutstandingBreakdown({ invoices, jobs, jobPayments: [] });
  assert.equal(breakdown.total, 500);
  assert.equal(breakdown.jobTotal, 500);
});

test('job revenue equals money received plus customers owe', () => {
  const invoices: InvoiceMetricRow[] = [
    { id: 'inv-1', amount: 2000, amount_paid: 600, invoice_date: '2026-07-05', payment_status: 'partially_paid', status: 'partial', job_id: 'job-1' },
    { id: 'void', amount: 500, invoice_date: '2026-07-06', payment_status: 'unpaid', status: 'void' }
  ];
  const jobs = [
    {
      id: 'job-1',
      revenue_amount: 2000,
      status: 'completed',
      completed_at: '2026-07-04'
    },
    {
      id: 'job-2',
      revenue_amount: 1400,
      status: 'completed',
      completed_at: '2026-07-08'
    }
  ];
  const invoiced = calculateCustomerInvoices(invoices, '2026-07-01', '2026-08-01');
  const uninvoiced = calculateUninvoicedExpectedRevenue(
    jobs,
    collectibleInvoicedJobIds(invoices),
    '2026-07-01',
    '2026-08-01'
  );
  assert.equal(invoiced, 2000);
  assert.equal(uninvoiced, 1400);

  const moneyReceived = calculatePaidToYou({
    invoices,
    paymentRows: [{ invoice_id: 'inv-1', amount: 600, paid_at: '2026-07-06' }],
    jobPaymentRows: [],
    start: '2026-07-01',
    end: '2026-08-01',
    range: 'month'
  }).paidToYou;
  const customersOwe = calculateOutstandingBreakdown({
    invoices,
    jobs,
    jobPayments: [],
    invoicePayments: [{ invoice_id: 'inv-1', amount: 600, paid_at: '2026-07-06' }]
  }).total;
  assert.equal(moneyReceived, 600);
  assert.equal(customersOwe, 2800); // 1400 invoice remaining + 1400 uninvoiced job
  assert.equal(calculateExpectedRevenue(moneyReceived, customersOwe), 3400);
});

test('expected profit example: $3400 - $3040 - $0 = $360', () => {
  const profit = calculateEstimatedProfit({
    expectedRevenue: 3400,
    contractorPay: 3040,
    otherExpenses: 0
  });
  assert.equal(profit, 360);
});

test('collected includes invoice payments and direct job payments without duplicates', () => {
  const invoices: InvoiceMetricRow[] = [
    { id: 'inv-1', amount: 500, amount_paid: 500, invoice_date: '2026-07-01', payment_status: 'paid' }
  ];
  const result = calculatePaidToYou({
    invoices,
    paymentRows: [{ invoice_id: 'inv-1', amount: 500, paid_at: '2026-07-10' }],
    jobPaymentRows: [{ job_id: 'job-2', amount: 200, paid_at: '2026-07-12' }],
    start: '2026-07-01',
    end: '2026-08-01',
    range: 'month'
  });
  assert.equal(result.paidToYou, 700);
});

test('cash after paid costs subtracts only paid contractor and expense amounts', () => {
  const cash = calculateCashAfterPaidCosts({
    cashCollected: 1000,
    contractorCashPaid: 200,
    otherCashExpenses: 50
  });
  assert.equal(cash, 750);
});

test('job reporting date prefers completed_at then visit then start then scheduled; never created_at', () => {
  assert.equal(
    getCompletedJobReportingDate({
      status: 'completed',
      completed_at: '2026-07-15',
      latest_completed_visit_date: '2026-07-10',
      start_date: '2026-07-01',
      scheduled_start: '2026-07-02',
      created_at: '2026-01-01'
    }),
    '2026-07-15'
  );
  assert.equal(
    getCompletedJobReportingDate({
      status: 'completed',
      completed_at: null,
      latest_completed_visit_date: '2026-07-10',
      start_date: '2026-07-01',
      scheduled_start: '2026-07-02',
      created_at: '2026-01-01'
    }),
    '2026-07-10'
  );
  assert.equal(
    getCompletedJobReportingDate({
      status: 'completed',
      completed_at: null,
      latest_completed_visit_date: null,
      start_date: '2026-07-01',
      scheduled_start: '2026-07-02',
      created_at: '2026-01-01'
    }),
    '2026-07-01'
  );
  assert.equal(
    getCompletedJobReportingDate({
      status: 'completed',
      completed_at: null,
      latest_completed_visit_date: null,
      start_date: null,
      scheduled_start: '2026-07-02T09:00:00',
      created_at: '2026-01-01'
    }),
    '2026-07-02'
  );
  assert.equal(
    getCompletedJobReportingDate({
      status: 'completed',
      completed_at: null,
      latest_completed_visit_date: null,
      start_date: null,
      scheduled_start: null,
      created_at: '2026-01-01'
    }),
    null
  );
});

test('signup referral has visible Select one and separate field labels', () => {
  for (const locale of ['en', 'es', 'vi'] as const) {
    const copy = getAuthFlowCopy(locale).signup;
    assert.ok(copy.selectOne.trim().length > 0);
    assert.notEqual(copy.businessName, copy.howDidYouHear);
    assert.notEqual(copy.businessName, copy.referralDetails);
    assert.notEqual(copy.optional, copy.businessName);
    assert.ok(copy.referralOptions.googleSearch.trim().length > 0);
    assert.ok(copy.existingUnconfirmed.includes(locale === 'en' ? 'Try signing in' : locale === 'es' ? 'iniciar sesión' : 'đăng nhập') || copy.existingUnconfirmed.length > 10);
  }
});

test('finance cards use locale keys for Customers owe, Contractor costs, Profit', () => {
  const en = getDashboardFinanceCopy('en');
  assert.equal(en.money.outstanding, 'Customers owe');
  assert.equal(
    en.money.outstandingHelp,
    'Remaining unpaid invoice balances plus unpaid direct jobs without invoices for the selected period.'
  );
  assert.equal(en.money.contractorCost, 'Contractor costs');
  assert.equal(en.money.contractorCostHelp, 'Total labor cost for jobs in this period, paid or unpaid.');
  assert.equal(en.money.expectedProfit, 'Profit');
  assert.equal(
    en.money.expectedProfitHelp,
    'Profit = Job revenue − Contractor costs − Business expenses.'
  );
});

test('calculateDirectJobOutstanding excludes cancelled and collectible-invoiced jobs', () => {
  const jobs: JobRevenueRow[] = [
    { id: 'a', revenue_amount: 100, status: 'completed' },
    { id: 'b', revenue_amount: 200, status: 'cancelled' },
    { id: 'c', revenue_amount: 300, status: 'completed' }
  ];
  const total = calculateDirectJobOutstanding(jobs, new Set(['c']), new Map([['a', 40]]));
  assert.equal(total, 60);
});
