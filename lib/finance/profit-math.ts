import type { JobProfitability } from '@/lib/finance-types';

function money(value: unknown): number {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

/**
 * Profit must be allowed to go negative. Clamping losses to zero hides real
 * operating losses and makes job financials disagree with cash math.
 */
export function withTruthfulProfit<T extends JobProfitability>(profitability: T): T {
  const collectedAmount = Math.max(0, money(profitability.collectedAmount));
  const expectedAmount = Math.max(0, money(profitability.expectedAmount));
  const totalExpenses = Math.max(0, money(profitability.totalExpenses));
  const expectedProfit = Number((expectedAmount - totalExpenses).toFixed(2));
  const collectedProfit = Number((collectedAmount - totalExpenses).toFixed(2));

  return {
    ...profitability,
    expectedProfit,
    collectedProfit,
    estimatedProfit: collectedAmount > 0 ? collectedProfit : expectedProfit,
    revenueBasis: collectedAmount > 0 ? collectedAmount : expectedAmount
  };
}
