import assert from 'node:assert/strict';
import test from 'node:test';
import { DASHBOARD_LINKS } from '@/lib/dashboard-links';
import { isDashboardDetailMetric } from '@/lib/dashboard-metric-details';
import { getJobOperationalDate, isCancelledJobStatus } from '@/lib/job-operational-date';
import {
  formatLaborPaymentLabel,
  normalizeLaborPaymentBasis
} from '@/lib/job-labor-basis';
import { buildLaborRow } from '@/lib/finance-server';
import { calculateCashAfterExpenses, calculateDirectJobOutstanding, calculatePaidToYou } from '@/lib/dashboard-metrics';

test('dashboard money links point at details drill-down routes', () => {
  const detailMetrics = [
    DASHBOARD_LINKS.paidToYou,
    DASHBOARD_LINKS.customerInvoices,
    DASHBOARD_LINKS.stillOwed,
    DASHBOARD_LINKS.latePayments,
    DASHBOARD_LINKS.unpaidInvoices,
    DASHBOARD_LINKS.cashAfterExpenses,
    DASHBOARD_LINKS.estimatedProfit,
    DASHBOARD_LINKS.contractorPay,
    DASHBOARD_LINKS.contractorPayOwed,
    DASHBOARD_LINKS.contractorPayPending,
    DASHBOARD_LINKS.activeCustomers
  ];

  for (const href of detailMetrics) {
    assert.match(href, /^\/dashboard\/details\?metric=/);
    const metric = new URL(href, 'https://example.com').searchParams.get('metric');
    assert.equal(isDashboardDetailMetric(metric), true, `metric missing for ${href}`);
  }

  assert.equal(DASHBOARD_LINKS.otherExpenses, '/expenses');
});

test('getJobOperationalDate prefers completion then work dates over created_at', () => {
  assert.equal(
    getJobOperationalDate({
      status: 'completed',
      completed_at: '2026-07-10T15:00:00Z',
      start_date: '2026-07-01',
      created_at: '2026-06-01T00:00:00Z'
    }),
    '2026-07-10'
  );

  assert.equal(
    getJobOperationalDate({
      status: 'scheduled',
      scheduled_start: '2026-07-12T09:00:00Z',
      created_at: '2026-06-01T00:00:00Z'
    }),
    '2026-07-12'
  );

  assert.equal(
    getJobOperationalDate({
      status: 'new',
      created_at: '2026-06-01T00:00:00Z'
    }),
    '2026-06-01'
  );

  assert.equal(isCancelledJobStatus('cancelled'), true);
  assert.equal(isCancelledJobStatus('completed'), false);
});

test('contractor payment basis labels cover flat, hourly, and visit', () => {
  assert.equal(normalizeLaborPaymentBasis('flat'), 'flat');
  assert.equal(normalizeLaborPaymentBasis(null, 1), 'flat');
  assert.equal(normalizeLaborPaymentBasis(null, 4), 'hourly');

  assert.equal(
    formatLaborPaymentLabel({ paymentBasis: 'flat', quantity: 1, rate: 650, total: 650 }),
    'Flat amount · $650.00'
  );
  assert.equal(
    formatLaborPaymentLabel({ paymentBasis: 'hourly', quantity: 4, rate: 25, total: 100 }),
    '4 hours × $25.00 = $100.00'
  );
  assert.equal(
    formatLaborPaymentLabel({ paymentBasis: 'visit', quantity: 2, rate: 80, total: 160 }),
    '2 visits × $80.00 = $160.00'
  );

  assert.equal(buildLaborRow({ hours: 1, hourlyCost: 650, paymentBasis: 'flat' }).payment_basis, 'flat');
  assert.equal(buildLaborRow({ hours: 2, hourlyCost: 80, paymentBasis: 'visit' }).total_cost, 160);
});

test('finance scenarios A B C D E I avoid double counting and unpaid contractor cash', () => {
  // A: uninvoiced $500, direct $200
  const outstandingA = calculateDirectJobOutstanding(
    [{ id: 'job-a', revenue_amount: 500 }],
    new Set(),
    new Map([['job-a', 200]])
  );
  assert.equal(outstandingA, 300);

  // B: direct payments cover expected
  const outstandingB = calculateDirectJobOutstanding(
    [{ id: 'job-b', revenue_amount: 500 }],
    new Set(),
    new Map([['job-b', 500]])
  );
  assert.equal(outstandingB, 0);

  // C/D invoice payments use paid date ledger
  const paidPartial = calculatePaidToYou({
    invoices: [{ id: 'inv-1', amount: 500, amount_paid: 200, status: 'sent' }],
    paymentRows: [{ invoice_id: 'inv-1', amount: 200, paid_at: '2026-07-05' }],
    jobPaymentRows: [],
    start: '2026-07-01',
    end: '2026-07-31',
    range: 'month'
  });
  assert.equal(paidPartial.paidToYou, 200);

  const paidFull = calculatePaidToYou({
    invoices: [{ id: 'inv-2', amount: 500, amount_paid: 500, status: 'paid' }],
    paymentRows: [{ invoice_id: 'inv-2', amount: 500, paid_at: '2026-07-05' }],
    jobPaymentRows: [],
    start: '2026-07-01',
    end: '2026-07-31',
    range: 'month'
  });
  assert.equal(paidFull.paidToYou, 500);

  // E: invoice payment present; do not also count a direct payment for the same invoiced job in outstanding
  const outstandingE = calculateDirectJobOutstanding(
    [{ id: 'job-e', revenue_amount: 500 }],
    new Set(['job-e']),
    new Map([['job-e', 200]])
  );
  assert.equal(outstandingE, 0);

  // I: cash after costs ignores unpaid contractor cost
  assert.equal(
    calculateCashAfterExpenses({
      cashCollected: 200,
      contractorCashPaid: 100,
      otherCashExpenses: 50
    }),
    50
  );
});
