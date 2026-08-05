import assert from 'node:assert/strict';
import test from 'node:test';

import {
  buildJobOperationalDateMap,
  buildPrimaryDashboardMetrics,
  calculateContractorAccruedCost,
  calculateContractorCashPaid,
  calculateCustomerInvoices,
  calculateDirectJobOutstanding,
  calculateEstimatedProfit,
  calculateJobRevenue,
  calculateMoneyKept,
  calculateOutstandingBreakdown,
  calculatePaidToYou,
  calculatePeriodOutstanding,
  calculatePeriodUnpaidContractorPay,
  calculateStillOwed,
  calculateUninvoicedExpectedRevenue,
  cappedAmountPaid,
  collectibleInvoicedJobIds,
  customersOweForRange,
  rangeBounds,
  reconcileDashboardLedger,
  remainingBalance,
  sumJobPaymentsByJobId,
  type DashboardDateRange,
  type InvoiceMetricRow,
  type InvoicePaymentRow,
  type JobPaymentMetricRow,
  type JobRevenueRow,
  type LaborCostRow
} from '../lib/dashboard-metrics';

function ledgerFor(range: DashboardDateRange, now: Date, input: {
  invoices: InvoiceMetricRow[];
  invoicePayments: InvoicePaymentRow[];
  jobPayments: JobPaymentMetricRow[];
  jobs: JobRevenueRow[];
  labor: LaborCostRow[];
  expenses: number;
}) {
  const { start, end } = rangeBounds(range, now);
  const jobDates = buildJobOperationalDateMap(
    input.jobs.map((job) => ({
      id: String(job.id || ''),
      status: job.status ? String(job.status) : null,
      completed_at: (job as { completed_at?: string }).completed_at || null,
      start_date: (job as { start_date?: string }).start_date || null,
      created_at: (job as { created_at?: string }).created_at || null
    }))
  );
  const moneyReceived = calculatePaidToYou({
    invoices: input.invoices,
    paymentRows: input.invoicePayments,
    jobPaymentRows: input.jobPayments,
    start,
    end,
    range
  }).paidToYou;
  const lifetime = calculateOutstandingBreakdown({
    invoices: input.invoices,
    jobs: input.jobs,
    jobPayments: input.jobPayments,
    invoicePayments: input.invoicePayments
  }).total;
  const period = calculatePeriodOutstanding({
    invoices: input.invoices,
    jobs: input.jobs,
    jobPayments: input.jobPayments,
    invoicePayments: input.invoicePayments,
    start,
    end,
    jobDates
  }).total;
  const customersOwe = customersOweForRange(range, lifetime, period);
  const jobRevenue = calculateJobRevenue(moneyReceived, customersOwe);
  const contractorCosts = calculateContractorAccruedCost(input.labor, start, end, jobDates);
  const paidContractors = calculateContractorCashPaid(input.labor, start, end, range);
  const profit = calculateEstimatedProfit({
    expectedRevenue: jobRevenue,
    contractorPay: contractorCosts,
    otherExpenses: input.expenses
  });
  const moneyKept = calculateMoneyKept({
    moneyReceived,
    paidContractors,
    businessExpenses: input.expenses
  });
  return { moneyReceived, customersOwe, jobRevenue, contractorCosts, paidContractors, profit, moneyKept };
}

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

test('direct payment then invoice later never loses money received', () => {
  const invoices: InvoiceMetricRow[] = [
    {
      id: 'inv-1',
      job_id: 'job-1',
      amount: 1000,
      amount_paid: 0,
      status: 'sent',
      payment_status: 'unpaid',
      invoice_date: '2026-07-20'
    }
  ];
  const jobPayments: JobPaymentMetricRow[] = [
    { job_id: 'job-1', amount: 400, paid_at: '2026-07-10' }
  ];

  const money = calculatePaidToYou({
    invoices,
    paymentRows: [],
    jobPaymentRows: jobPayments,
    start: '2026-07-01',
    end: '2026-08-01',
    range: 'month'
  });

  assert.equal(money.paidToYou, 400);
  assert.equal(money.directJobPayments, 400);

  const outstanding = calculateOutstandingBreakdown({
    invoices,
    jobs: [{ id: 'job-1', revenue_amount: 1000, status: 'completed' }],
    jobPayments,
    invoicePayments: []
  });
  // Unmigrated direct payment reduces invoice outstanding so revenue does not inflate.
  assert.equal(outstanding.total, 600);
  assert.equal(calculateJobRevenue(money.paidToYou, outstanding.total), 1000);
});

test('partial invoice payments leave only the remaining balance in customers owe', () => {
  const invoices: InvoiceMetricRow[] = [
    {
      id: 'inv-1',
      job_id: 'job-1',
      amount: 1000,
      amount_paid: 250,
      status: 'partial',
      payment_status: 'partially_paid'
    }
  ];
  const invoicePayments: InvoicePaymentRow[] = [
    { invoice_id: 'inv-1', amount: 250, paid_at: '2026-07-05' }
  ];
  const money = calculatePaidToYou({
    invoices,
    paymentRows: invoicePayments,
    jobPaymentRows: [],
    start: '2026-07-01',
    end: '2026-08-01',
    range: 'month'
  });
  const outstanding = calculateOutstandingBreakdown({
    invoices,
    jobs: [{ id: 'job-1', revenue_amount: 1000, status: 'completed' }],
    jobPayments: [],
    invoicePayments
  });

  assert.equal(money.paidToYou, 250);
  assert.equal(outstanding.total, 750);
  assert.equal(calculateJobRevenue(money.paidToYou, outstanding.total), 1000);
});

test('invoice payment is not double counted with a legacy job payment row', () => {
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
  const money = calculatePaidToYou({
    invoices,
    paymentRows: [{ invoice_id: 'inv-1', amount: 800, paid_at: '2026-07-05' }],
    jobPaymentRows: [{ job_id: 'job-1', amount: 800, paid_at: '2026-07-05' }],
    start: '2026-07-01',
    end: '2026-08-01',
    range: 'month'
  });
  assert.equal(money.paidToYou, 800);
});

test('recurring and one-time completed jobs contribute once to uninvoiced revenue', () => {
  const jobs = [
    {
      id: 'occ-1',
      revenue_amount: 120,
      status: 'completed',
      completed_at: '2026-07-08',
      recurring_series_id: 'series-1'
    },
    {
      id: 'occ-2',
      revenue_amount: 120,
      status: 'completed',
      completed_at: '2026-07-15',
      recurring_series_id: 'series-1'
    },
    {
      id: 'one-time',
      revenue_amount: 200,
      status: 'completed',
      completed_at: '2026-07-12'
    },
    {
      id: 'cancelled-occ',
      revenue_amount: 120,
      status: 'cancelled',
      completed_at: '2026-07-20',
      recurring_series_id: 'series-1'
    }
  ];
  const uninvoiced = calculateUninvoicedExpectedRevenue(jobs, new Set(), '2026-07-01', '2026-08-01');
  assert.equal(uninvoiced, 440);
});

test('cancelled jobs are excluded from money received, customers owe, and job revenue', () => {
  const jobs: JobRevenueRow[] = [{ id: 'job-x', revenue_amount: 500, status: 'cancelled' }];
  const jobPayments: JobPaymentMetricRow[] = [{ job_id: 'job-x', amount: 500, paid_at: '2026-07-01' }];
  // Cancelled jobs can still have a payment recorded; money received keeps the cash.
  const money = calculatePaidToYou({
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
  assert.equal(money.paidToYou, 500);
  assert.equal(outstanding.total, 0);
});

test('unpaid and paid labor are separated; paid contractors use paid_at only', () => {
  const labor: LaborCostRow[] = [
    { job_id: 'job-1', total_cost: 300, payment_status: 'unpaid', created_at: '2026-07-05' },
    { job_id: 'job-1', total_cost: 200, payment_status: 'paid', paid_at: '2026-07-08', created_at: '2026-07-05' },
    { job_id: 'job-1', total_cost: 50, payment_status: 'paid', paid_at: null, created_at: '2026-07-05' }
  ];
  const jobDates = new Map([['job-1', '2026-07-04']]);
  assert.equal(calculateContractorAccruedCost(labor, '2026-07-01', '2026-08-01', jobDates), 550);
  assert.equal(calculateContractorCashPaid(labor, '2026-07-01', '2026-08-01', 'month'), 200);
  assert.equal(calculatePeriodUnpaidContractorPay(labor, '2026-07-01', '2026-08-01', jobDates), 300);
});

test('business expenses only reduce money kept and profit', () => {
  const moneyReceived = 1000;
  const customersOwe = 200;
  const jobRevenue = calculateJobRevenue(moneyReceived, customersOwe);
  const profit = calculateEstimatedProfit({
    expectedRevenue: jobRevenue,
    contractorPay: 300,
    otherExpenses: 100
  });
  const moneyKept = calculateMoneyKept({
    moneyReceived,
    paidContractors: 150,
    businessExpenses: 100
  });
  assert.equal(jobRevenue, 1200);
  assert.equal(profit, 800);
  assert.equal(moneyKept, 750);
});

test('every dashboard filter reconciles money received + customers owe = job revenue', () => {
  const now = new Date(2026, 6, 15); // July 15, 2026
  const invoices: InvoiceMetricRow[] = [
    {
      id: 'inv-1',
      job_id: 'job-1',
      amount: 1000,
      amount_paid: 400,
      status: 'sent',
      payment_status: 'partially_paid',
      invoice_date: '2026-07-02'
    }
  ];
  const invoicePayments: InvoicePaymentRow[] = [
    { invoice_id: 'inv-1', amount: 400, paid_at: '2026-07-05' }
  ];
  const jobPayments: JobPaymentMetricRow[] = [
    { job_id: 'job-2', amount: 150, paid_at: '2026-07-12' }
  ];
  const jobs: JobRevenueRow[] = [
    {
      id: 'job-1',
      revenue_amount: 1000,
      status: 'completed',
      completed_at: '2026-07-02',
      start_date: '2026-07-01',
      created_at: '2026-07-01'
    } as JobRevenueRow,
    {
      id: 'job-2',
      revenue_amount: 200,
      status: 'completed',
      completed_at: '2026-07-11',
      start_date: '2026-07-10',
      created_at: '2026-07-10'
    } as JobRevenueRow
  ];
  const labor: LaborCostRow[] = [
    { job_id: 'job-1', total_cost: 250, payment_status: 'paid', paid_at: '2026-07-06', created_at: '2026-07-03' },
    { job_id: 'job-2', total_cost: 80, payment_status: 'unpaid', created_at: '2026-07-12' }
  ];

  for (const range of ['today', 'week', 'month', 'year', 'all_time'] as DashboardDateRange[]) {
    const expenses = range === 'all_time' || range === 'year' || range === 'month' ? 40 : 0;
    const result = ledgerFor(range, now, {
      invoices,
      invoicePayments,
      jobPayments,
      jobs,
      labor,
      expenses
    });
    const reconciled = reconcileDashboardLedger({
      moneyReceived: result.moneyReceived,
      customersOwe: result.customersOwe,
      jobRevenue: result.jobRevenue
    });
    assert.equal(reconciled.ok, true, `${range} job revenue must reconcile`);
    assert.equal(
      Number((result.jobRevenue - result.contractorCosts - expenses).toFixed(2)),
      result.profit,
      `${range} profit formula`
    );
    assert.equal(
      Number((result.moneyReceived - result.paidContractors - expenses).toFixed(2)),
      result.moneyKept,
      `${range} money kept formula`
    );
  }
});

test('primary dashboard metrics expose the plain-language finance cards', () => {
  const rows = buildPrimaryDashboardMetrics({
    expectedRevenue: 1200,
    collected: 1000,
    outstanding: 200,
    contractorCost: 300,
    expectedProfit: 800,
    cashAfterPaidCosts: 750
  });
  assert.equal(rows.find((row) => row.key === 'expectedRevenue')?.label, 'Job revenue');
  assert.equal(rows.find((row) => row.key === 'collected')?.label, 'Money received');
  assert.equal(rows.find((row) => row.key === 'outstanding')?.label, 'Customers owe');
  assert.equal(rows.find((row) => row.key === 'cashAfterPaidCosts')?.label, 'Money kept');
  assert.equal(rows.find((row) => row.key === 'expectedProfit')?.label, 'Profit');
});

test('top customer completed revenue uses max of quote/invoice/payment once', () => {
  // Mirrors owner-top-performer-metric completed-revenue attribution.
  const completedJobs = [
    { id: 'job-1', status: 'completed', revenue_amount: 200, invoice: 250, payments: 100 },
    { id: 'job-2', status: 'cancelled', revenue_amount: 900, invoice: 0, payments: 0 },
    { id: 'job-3', status: 'draft', revenue_amount: 500, invoice: 0, payments: 0 },
    { id: 'job-4', status: 'in_progress', revenue_amount: 300, invoice: 0, payments: 0 }
  ];
  let total = 0;
  for (const job of completedJobs) {
    if (!['completed', 'complete', 'finished', 'done'].includes(job.status)) continue;
    total += Math.max(job.revenue_amount, job.invoice, job.payments);
  }
  assert.equal(total, 250);
});
