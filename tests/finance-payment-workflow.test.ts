import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  calculateCashAfterExpenses,
  calculateContractorAccruedCost,
  calculateContractorCashPaid,
  calculateCustomerInvoices,
  calculateEstimatedProfit,
  calculateLatePayments,
  calculatePaidToYou,
  calculateStillOwed,
  countUnpaidInvoices,
  reconcileAllTimeInvoices,
  remainingBalance,
  type InvoiceMetricRow,
  type InvoicePaymentRow,
  type LaborCostRow
} from '@/lib/dashboard-metrics';
import { computeJobProfitability } from '@/lib/finance-server';
import {
  calculateBalanceDue,
  calculateInvoicePaymentStatus
} from '@/lib/outbound/invoice-payment';

/**
 * Integration-style workflow: one customer payment path drives every metric.
 * Simulates create invoice → partial pay → second pay → contractor pay → expense.
 */
describe('canonical payment workflow metrics', () => {
  it('uses a direct payment as expected revenue when no amount or invoice was entered', () => {
    const result = computeJobProfitability({
      invoiceTotal: 0,
      manualRevenue: 0,
      collectedAmount: 350,
      laborCost: 200,
      materialCost: 25,
      otherExpenses: 10,
      hasInvoice: false
    });

    assert.equal(result.expectedAmount, 350);
    assert.equal(result.paymentStatus, 'paid');
    assert.equal(result.outstanding, 0);
    assert.equal(result.expectedProfit, 115);
    assert.equal(result.collectedProfit, 115);
  });

  it('keeps a manually entered expected amount when it is higher than a partial payment', () => {
    const result = computeJobProfitability({
      invoiceTotal: 0,
      manualRevenue: 500,
      collectedAmount: 200,
      laborCost: 100,
      materialCost: 0,
      otherExpenses: 0,
      hasInvoice: false
    });

    assert.equal(result.expectedAmount, 500);
    assert.equal(result.paymentStatus, 'partially_paid');
    assert.equal(result.outstanding, 300);
    assert.equal(result.expectedProfit, 400);
    assert.equal(result.collectedProfit, 100);
  });

  it('keeps Customer invoices = Paid + Still owed (all time) through partial payments', () => {
    const invoices: InvoiceMetricRow[] = [
      {
        id: 'inv-1',
        amount: 1000,
        amount_paid: 0,
        invoice_date: '2026-07-01',
        due_date: '2026-07-10',
        payment_status: 'unpaid',
        status: 'sent'
      }
    ];
    const payments: InvoicePaymentRow[] = [];

    // Step 1: invoice created
    assert.equal(calculateCustomerInvoices(invoices, null, null), 1000);
    assert.equal(calculateStillOwed(invoices), 1000);
    assert.equal(countUnpaidInvoices(invoices), 1);
    assert.equal(
      calculatePaidToYou({ invoices, paymentRows: payments, start: null, end: null, range: 'all_time' })
        .paidToYou,
      0
    );

    // Step 2: record first payment $400 on 2026-07-05
    payments.push({ invoice_id: 'inv-1', amount: 400, paid_at: '2026-07-05' });
    invoices[0].amount_paid = 400;
    invoices[0].payment_status = calculateInvoicePaymentStatus({
      amount: 1000,
      amount_paid: 400,
      due_date: '2026-07-10'
    });
    invoices[0].status = 'partial';

    assert.equal(calculateStillOwed(invoices), 600);
    assert.equal(
      calculatePaidToYou({
        invoices,
        paymentRows: payments,
        start: '2026-07-01',
        end: '2026-08-01',
        range: 'month'
      }).paidToYou,
      400
    );
    assert.equal(
      reconcileAllTimeInvoices({
        customerInvoices: calculateCustomerInvoices(invoices, null, null),
        paidToYou: calculatePaidToYou({
          invoices,
          paymentRows: payments,
          start: null,
          end: null,
          range: 'all_time'
        }).paidToYou,
        stillOwed: calculateStillOwed(invoices)
      }).ok,
      true
    );

    // Step 3: second payment $600 on 2026-07-20
    payments.push({ invoice_id: 'inv-1', amount: 600, paid_at: '2026-07-20' });
    invoices[0].amount_paid = 1000;
    invoices[0].payment_status = 'paid';
    invoices[0].status = 'paid';
    invoices[0].paid_at = '2026-07-20';

    assert.equal(calculateStillOwed(invoices), 0);
    assert.equal(countUnpaidInvoices(invoices), 0);
    assert.equal(
      calculatePaidToYou({
        invoices,
        paymentRows: payments,
        start: '2026-07-01',
        end: '2026-08-01',
        range: 'month'
      }).paidToYou,
      1000
    );
    assert.equal(
      reconcileAllTimeInvoices({
        customerInvoices: 1000,
        paidToYou: 1000,
        stillOwed: 0
      }).ok,
      true
    );
  });

  it('does not leak Worker B contractor pay into Worker A cash metrics', () => {
    const labor: LaborCostRow[] = [
      { total_cost: 200, created_at: '2026-07-03', payment_status: 'unpaid' },
      { total_cost: 150, created_at: '2026-07-04', payment_status: 'paid', paid_at: '2026-07-08' },
      { total_cost: 75, created_at: '2026-07-05', payment_status: 'pending' }
    ];

    assert.equal(calculateContractorAccruedCost(labor, '2026-07-01', '2026-08-01'), 425);
    assert.equal(calculateContractorCashPaid(labor, '2026-07-01', '2026-08-01', 'month'), 150);

    const paidToYou = 1000;
    const expenses = 50;
    const cash = calculateCashAfterExpenses({
      cashCollected: paidToYou,
      contractorCashPaid: 150,
      otherCashExpenses: expenses
    });
    assert.equal(cash, 800);

    const profit = calculateEstimatedProfit({
      moneyReceived: 1000,
      customersOwe: 0,
      contractorPay: 425,
      otherExpenses: expenses
    });
    assert.equal(profit, 525);
  });

  it('late payments only count overdue unpaid balances', () => {
    const invoices: InvoiceMetricRow[] = [
      {
        id: 'late',
        amount: 300,
        amount_paid: 50,
        due_date: '2026-07-01',
        payment_status: 'overdue'
      },
      {
        id: 'current',
        amount: 200,
        amount_paid: 0,
        due_date: '2026-12-31',
        payment_status: 'unpaid'
      },
      {
        id: 'cancelled',
        amount: 500,
        amount_paid: 0,
        due_date: '2026-06-01',
        payment_status: 'cancelled'
      }
    ];
    const late = calculateLatePayments(invoices, '2026-07-14');
    assert.equal(late.amount, 250);
    assert.equal(late.count, 1);
  });

  it('payment status helpers match ledger summary math', () => {
    assert.equal(calculateBalanceDue(1000, 400), 600);
    assert.equal(remainingBalance(1000, 400), 600);
    assert.equal(
      calculateInvoicePaymentStatus({ amount: 1000, amount_paid: 400, due_date: '2026-12-31' }),
      'partially_paid'
    );
    assert.equal(
      calculateInvoicePaymentStatus({ amount: 1000, amount_paid: 1000, due_date: '2026-07-01' }),
      'paid'
    );
  });

  it('cancelled invoice drops out of every customer cash metric', () => {
    const invoices: InvoiceMetricRow[] = [
      {
        id: 'c1',
        amount: 800,
        amount_paid: 200,
        invoice_date: '2026-07-01',
        payment_status: 'cancelled'
      },
      {
        id: 'open',
        amount: 100,
        amount_paid: 100,
        invoice_date: '2026-07-03',
        payment_status: 'paid',
        paid_at: '2026-07-04'
      }
    ];
    const payments: InvoicePaymentRow[] = [
      { invoice_id: 'c1', amount: 200, paid_at: '2026-07-02' },
      { invoice_id: 'open', amount: 100, paid_at: '2026-07-04' }
    ];
    assert.equal(calculateCustomerInvoices(invoices, null, null), 100);
    assert.equal(calculateStillOwed(invoices), 0);
    const paid = calculatePaidToYou({
      invoices,
      paymentRows: payments,
      start: null,
      end: null,
      range: 'all_time'
    });
    assert.equal(paid.paidToYou, 100);
  });
});
