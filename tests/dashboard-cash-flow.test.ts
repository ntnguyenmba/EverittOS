import assert from 'node:assert/strict';
import test from 'node:test';
import {
  calculateContractorAccruedCost,
  calculateContractorCashPaid,
  calculateNetCashFlow,
  calculatePendingContractorPay,
  calculateUnpaidContractorPay,
  type LaborCostRow
} from '@/lib/dashboard-metrics';

const laborFixture: LaborCostRow[] = [
  { total_cost: 2000, created_at: '2026-07-05', payment_status: 'unpaid', paid_at: null },
  { total_cost: 800, created_at: '2026-07-08', payment_status: 'paid', paid_at: '2026-07-10' },
  { total_cost: 500, created_at: '2026-06-20', payment_status: 'paid', paid_at: '2026-07-02' },
  { total_cost: 300, created_at: '2026-07-12', payment_status: 'pending', paid_at: null },
  { total_cost: 150, created_at: '2026-07-01', payment_status: 'paid', paid_at: null }
];

test('accrued contractor cost includes unpaid and pending labor in range', () => {
  const accrued = calculateContractorAccruedCost(laborFixture, '2026-07-01', '2026-08-01');
  assert.equal(accrued, 2000 + 800 + 300 + 150);
});

test('contractor cash paid only includes paid rows with paid_at in range', () => {
  const paid = calculateContractorCashPaid(laborFixture, '2026-07-01', '2026-08-01', 'month');
  // 800 (paid this month, created this month) + 500 (created last month, paid this month)
  // excludes unpaid, pending, and paid-without-paid_at
  assert.equal(paid, 1300);
});

test('paid contractor outside range is not deducted from cash flow period', () => {
  const paid = calculateContractorCashPaid(
    [{ total_cost: 999, created_at: '2026-07-01', payment_status: 'paid', paid_at: '2026-06-15' }],
    '2026-07-01',
    '2026-08-01',
    'month'
  );
  assert.equal(paid, 0);
});

test('unpaid and pending rows are not deducted from Net Cash Flow', () => {
  const cashPaid = calculateContractorCashPaid(laborFixture, '2026-07-01', '2026-08-01', 'month');
  const net = calculateNetCashFlow({
    cashCollected: 5000,
    contractorCashPaid: cashPaid,
    otherCashExpenses: 500
  });
  // Scenario A: 5000 - 1300 - 500 = 3200 (unpaid 2000 not deducted)
  assert.equal(net, 3200);
  assert.equal(calculateUnpaidContractorPay(laborFixture), 2000);
  assert.equal(calculatePendingContractorPay(laborFixture), 300);
});

test('Scenario A: unpaid labor does not reduce net cash flow', () => {
  const net = calculateNetCashFlow({
    cashCollected: 5000,
    contractorCashPaid: 0,
    otherCashExpenses: 500
  });
  assert.equal(net, 4500);
});

test('Scenario B: paying contractor next month creates negative cash flow', () => {
  const net = calculateNetCashFlow({
    cashCollected: 0,
    contractorCashPaid: 2000,
    otherCashExpenses: 0
  });
  assert.equal(net, -2000);
});

test('Scenario C: partial customer payment and paid contractor', () => {
  const net = calculateNetCashFlow({
    cashCollected: 1500,
    contractorCashPaid: 800,
    otherCashExpenses: 200
  });
  assert.equal(net, 500);
});

test('paid row missing paid_at is not assigned to a cash-flow period', () => {
  const paid = calculateContractorCashPaid(
    [{ total_cost: 400, created_at: '2026-07-01', payment_status: 'paid', paid_at: null }],
    '2026-07-01',
    '2026-08-01',
    'month'
  );
  assert.equal(paid, 0);
  const accrued = calculateContractorAccruedCost(
    [{ total_cost: 400, created_at: '2026-07-01', payment_status: 'paid', paid_at: null }],
    '2026-07-01',
    '2026-08-01'
  );
  assert.equal(accrued, 400);
});
