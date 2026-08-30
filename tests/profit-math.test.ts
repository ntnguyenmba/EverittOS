import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { withTruthfulProfit } from '@/lib/finance/profit-math';
import type { JobProfitability } from '@/lib/finance-types';

function profitability(overrides: Partial<JobProfitability> = {}): JobProfitability {
  return {
    hasInvoice: false,
    invoiceTotal: 0,
    manualRevenue: 100,
    revenueNotes: null,
    expectedAmount: 100,
    collectedAmount: 100,
    paymentsReceived: 100,
    outstanding: 0,
    paymentStatus: 'paid',
    laborCost: 140,
    materialCost: 0,
    otherExpenses: 0,
    totalExpenses: 140,
    expectedProfit: 0,
    collectedProfit: 0,
    estimatedProfit: 0,
    revenueBasis: 100,
    payments: [],
    ...overrides
  };
}

describe('truthful job profit', () => {
  it('shows a real loss when collected revenue is below costs', () => {
    const result = withTruthfulProfit(profitability());
    assert.equal(result.expectedProfit, -40);
    assert.equal(result.collectedProfit, -40);
    assert.equal(result.estimatedProfit, -40);
  });

  it('uses expected profit before any customer payment is collected', () => {
    const result = withTruthfulProfit(profitability({
      expectedAmount: 220,
      collectedAmount: 0,
      paymentsReceived: 0,
      totalExpenses: 140,
      revenueBasis: 220
    }));
    assert.equal(result.expectedProfit, 80);
    assert.equal(result.collectedProfit, -140);
    assert.equal(result.estimatedProfit, 80);
    assert.equal(result.revenueBasis, 220);
  });
});
