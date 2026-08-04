/**
 * Decimal-safe money helpers for job/recurring finance.
 * Intermediate math uses integer cents; stored values remain numeric(12,2) dollars
 * to match EverittOS jobs/expenses/labor columns.
 */

export function dollarsToCents(value: unknown): number {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return Math.round(value * 100);
  }
  const raw = String(value ?? '')
    .trim()
    .replace(/[^0-9.-]/g, '');
  if (!raw) return 0;
  const parsed = Number.parseFloat(raw);
  if (!Number.isFinite(parsed)) return 0;
  return Math.round(Math.max(0, parsed) * 100);
}

export function centsToDollars(cents: number): number {
  const safe = Number.isFinite(cents) ? Math.max(0, Math.round(cents)) : 0;
  return Number((safe / 100).toFixed(2));
}

export function parseMoneyDollars(value: unknown): number {
  return centsToDollars(dollarsToCents(value));
}

/**
 * Optional money input: blank/null/undefined → null; intentional 0 stays 0.
 * Do not use `value || null` for monetary fields — it drops valid zeros.
 * Negatives are preserved so callers can reject them explicitly.
 */
export function optionalMoneyDollars(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) return null;
    const raw = trimmed.replace(/[^0-9.-]/g, '');
    if (!raw || raw === '-' || raw === '.' || raw === '-.') return null;
    const parsed = Number.parseFloat(raw);
    if (!Number.isFinite(parsed)) return null;
    return Number((Math.round(parsed * 100) / 100).toFixed(2));
  }
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) return null;
    return Number((Math.round(value * 100) / 100).toFixed(2));
  }
  return optionalMoneyDollars(String(value));
}

export function addMoneyDollars(...values: unknown[]): number {
  return centsToDollars(values.reduce<number>((sum, value) => sum + dollarsToCents(value), 0));
}

export function subtractMoneyDollars(minuend: unknown, ...subtrahends: unknown[]): number {
  const cents =
    dollarsToCents(minuend) - subtrahends.reduce<number>((sum, value) => sum + dollarsToCents(value), 0);
  return Number((cents / 100).toFixed(2));
}

export function multiplyMoneyDollars(amount: unknown, quantity: unknown): number {
  const amountCents = dollarsToCents(amount);
  const qty =
    typeof quantity === 'number' && Number.isFinite(quantity)
      ? quantity
      : Number.parseFloat(String(quantity ?? '0'));
  const safeQty = Number.isFinite(qty) ? Math.max(0, qty) : 0;
  return centsToDollars(Math.round(amountCents * safeQty));
}

export type ExpectedJobFinance = {
  expectedRevenue: number;
  expectedContractorCost: number;
  expectedAdditionalExpense: number;
  expectedProfit: number;
  expectedExpenseTotal: number;
};

/** Expected profit = client price − contractor pay − additional expected expenses */
export function calculateExpectedJobFinance(input: {
  clientPrice?: unknown;
  contractorPay?: unknown;
  additionalExpenses?: unknown;
}): ExpectedJobFinance {
  const expectedRevenue = parseMoneyDollars(input.clientPrice);
  const expectedContractorCost = parseMoneyDollars(input.contractorPay);
  const expectedAdditionalExpense = parseMoneyDollars(input.additionalExpenses);
  const expectedExpenseTotal = addMoneyDollars(expectedContractorCost, expectedAdditionalExpense);
  const expectedProfit = subtractMoneyDollars(expectedRevenue, expectedContractorCost, expectedAdditionalExpense);
  return {
    expectedRevenue,
    expectedContractorCost,
    expectedAdditionalExpense,
    expectedExpenseTotal,
    expectedProfit
  };
}

export type ActualJobFinance = {
  collectedRevenue: number;
  actualContractorPayments: number;
  actualRecordedExpenses: number;
  actualProfit: number;
};

/** Actual profit = collected revenue − actual contractor payments − actual recorded expenses */
export function calculateActualJobFinance(input: {
  collectedRevenue?: unknown;
  actualContractorPayments?: unknown;
  actualRecordedExpenses?: unknown;
}): ActualJobFinance {
  const collectedRevenue = parseMoneyDollars(input.collectedRevenue);
  const actualContractorPayments = parseMoneyDollars(input.actualContractorPayments);
  const actualRecordedExpenses = parseMoneyDollars(input.actualRecordedExpenses);
  return {
    collectedRevenue,
    actualContractorPayments,
    actualRecordedExpenses,
    actualProfit: subtractMoneyDollars(collectedRevenue, actualContractorPayments, actualRecordedExpenses)
  };
}
