import assert from 'node:assert/strict';
import test from 'node:test';
import {
  calculateCashAfterExpenses,
  calculateContractorAccruedCost,
  calculateContractorCashPaid,
  calculateCustomerInvoices,
  calculateEstimatedProfit,
  calculateEstimatedProfitPercentage,
  calculateLatePayments,
  calculatePaidToYou,
  calculateStillOwed,
  cappedAmountPaid,
  countUnpaidInvoices,
  reconcileAllTimeInvoices,
  remainingBalance,
  type InvoiceMetricRow,
  type InvoicePaymentRow,
  type LaborCostRow
} from '@/lib/dashboard-metrics';

test('Customer invoices sums non-cancelled invoices in range', () => {
  const invoices: InvoiceMetricRow[] = [
    { id: '1', amount: 100, invoice_date: '2026-07-05', payment_status: 'unpaid' },
    { id: '2', amount: 250, invoice_date: '2026-07-10', payment_status: 'paid' },
    { id: '3', amount: 500, invoice_date: '2026-07-12', payment_status: 'cancelled' }
  ];
  assert.equal(calculateCustomerInvoices(invoices, '2026-07-01', '2026-08-01'), 350);
});

test('Cancelled invoice contributes $0 to customer invoices and still owed', () => {
  const invoices: InvoiceMetricRow[] = [
    { id: '1', amount: 500, amount_paid: 0, invoice_date: '2026-07-01', payment_status: 'cancelled' }
  ];
  assert.equal(calculateCustomerInvoices(invoices, '2026-07-01', '2026-08-01'), 0);
  assert.equal(calculateStillOwed(invoices), 0);
});

test('Partial payment still owed is remaining balance', () => {
  assert.equal(remainingBalance(300, 100), 200);
  assert.equal(calculateStillOwed([{ amount: 300, amount_paid: 100, payment_status: 'partially_paid' }]), 200);
});

test('Full payment still owed is zero', () => {
  assert.equal(remainingBalance(300, 300), 0);
  assert.equal(calculateStillOwed([{ amount: 300, amount_paid: 300, payment_status: 'paid' }]), 0);
});

test('Overpayment is capped at invoice total', () => {
  assert.equal(cappedAmountPaid(300, 400), 300);
  assert.equal(remainingBalance(300, 400), 0);
});

test('Paid to you uses payment ledger dates for period assignment', () => {
  const invoices: InvoiceMetricRow[] = [
    {
      id: 'old',
      amount: 1000,
      amount_paid: 700,
      invoice_date: '2026-06-01',
      payment_status: 'partially_paid'
    }
  ];
  const payments: InvoicePaymentRow[] = [
    { invoice_id: 'old', amount: 400, paid_at: '2026-06-15' },
    { invoice_id: 'old', amount: 300, paid_at: '2026-07-05' }
  ];
  const july = calculatePaidToYou({
    invoices,
    paymentRows: payments,
    start: '2026-07-01',
    end: '2026-08-01',
    range: 'month'
  });
  assert.equal(july.paidToYou, 300);
});

test('Missing payment timestamp uses documented legacy fallback', () => {
  const invoices: InvoiceMetricRow[] = [
    {
      id: 'legacy',
      amount: 200,
      amount_paid: 200,
      invoice_date: '2026-07-08',
      payment_status: 'paid',
      paid_at: null,
      last_payment_at: null
    },
    {
      id: 'old-undated',
      amount: 150,
      amount_paid: 150,
      invoice_date: '2026-05-01',
      payment_status: 'paid',
      paid_at: null,
      last_payment_at: null
    }
  ];
  const july = calculatePaidToYou({
    invoices,
    paymentRows: [],
    start: '2026-07-01',
    end: '2026-08-01',
    range: 'month'
  });
  // Only the invoice created in July is included for the bounded period.
  assert.equal(july.paidToYou, 200);
  assert.equal(july.paymentsMissingDates, 2);

  const allTime = calculatePaidToYou({
    invoices,
    paymentRows: [],
    start: null,
    end: null,
    range: 'all_time'
  });
  assert.equal(allTime.paidToYou, 350);
});

test('Old unpaid invoices appear in Still owed current', () => {
  const invoices: InvoiceMetricRow[] = [
    { id: '1', amount: 400, amount_paid: 0, invoice_date: '2025-01-01', payment_status: 'unpaid' },
    { id: '2', amount: 100, amount_paid: 40, invoice_date: '2026-07-01', payment_status: 'partially_paid' }
  ];
  assert.equal(calculateStillOwed(invoices), 460);
  assert.equal(countUnpaidInvoices(invoices), 2);
});

test('Late payments sum overdue unpaid balances', () => {
  const invoices: InvoiceMetricRow[] = [
    {
      id: '1',
      amount: 200,
      amount_paid: 50,
      due_date: '2026-06-01',
      payment_status: 'partially_paid'
    },
    {
      id: '2',
      amount: 100,
      amount_paid: 0,
      due_date: '2099-01-01',
      payment_status: 'unpaid'
    }
  ];
  const late = calculateLatePayments(invoices, '2026-07-14');
  assert.equal(late.amount, 150);
  assert.equal(late.count, 1);
});

test('Estimated profit uses expected revenue and recorded costs', () => {
  const profit = calculateEstimatedProfit({
    customerInvoices: 1000,
    uninvoicedCompletedWork: 0,
    contractorPay: 300,
    otherExpenses: 100
  });
  assert.equal(profit, 600);
  assert.equal(calculateEstimatedProfitPercentage(600, 1000), 60);
  assert.equal(calculateEstimatedProfitPercentage(600, 0), null);

  assert.equal(
    calculateEstimatedProfit({
      expectedRevenue: 3400,
      contractorPay: 3040,
      otherExpenses: 0
    }),
    360
  );
});

test('Cash after expenses uses paid cash only', () => {
  const cash = calculateCashAfterExpenses({
    cashCollected: 700,
    contractorCashPaid: 250,
    otherCashExpenses: 100
  });
  assert.equal(cash, 350);
});

test('Unpaid contractor labor is not deducted from cash after expenses', () => {
  const labor: LaborCostRow[] = [
    { total_cost: 2000, created_at: '2026-07-05', payment_status: 'unpaid', paid_at: null },
    { total_cost: 250, created_at: '2026-07-02', payment_status: 'paid', paid_at: '2026-07-03' }
  ];
  assert.equal(calculateContractorAccruedCost(labor, '2026-07-01', '2026-08-01'), 2250);
  assert.equal(calculateContractorCashPaid(labor, '2026-07-01', '2026-08-01', 'month'), 250);
  assert.equal(
    calculateCashAfterExpenses({
      cashCollected: 700,
      contractorCashPaid: calculateContractorCashPaid(labor, '2026-07-01', '2026-08-01', 'month'),
      otherCashExpenses: 100
    }),
    350
  );
});

test('All-time reconciliation: invoices = paid + still owed', () => {
  const invoices: InvoiceMetricRow[] = [
    { id: '1', amount: 300, amount_paid: 300, invoice_date: '2026-01-01', payment_status: 'paid', paid_at: '2026-01-10' },
    { id: '2', amount: 200, amount_paid: 50, invoice_date: '2026-02-01', payment_status: 'partially_paid', last_payment_at: '2026-02-05' },
    { id: '3', amount: 100, amount_paid: 0, invoice_date: '2026-03-01', payment_status: 'unpaid' },
    { id: '4', amount: 999, amount_paid: 0, invoice_date: '2026-03-01', payment_status: 'cancelled' }
  ];
  const customerInvoices = calculateCustomerInvoices(invoices, null, null);
  const stillOwed = calculateStillOwed(invoices);
  const paid = calculatePaidToYou({
    invoices,
    paymentRows: [],
    start: null,
    end: null,
    range: 'all_time'
  }).paidToYou;
  assert.equal(customerInvoices, 600);
  assert.equal(paid, 350);
  assert.equal(stillOwed, 250);
  const check = reconcileAllTimeInvoices({ customerInvoices, paidToYou: paid, stillOwed });
  assert.equal(check.ok, true);
});

test('Estimated profit percentage is available when costs are zero', () => {
  assert.equal(calculateEstimatedProfitPercentage(1000, 1000), 100);
});
