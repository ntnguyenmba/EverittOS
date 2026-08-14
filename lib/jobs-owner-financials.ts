export function parseOwnerMoney(value: unknown): number | null {
  if (value == null || value === '') return null;
  const amount = Number(value);
  return Number.isFinite(amount) ? amount : null;
}

export function ownerProfitFromAmounts(
  customerPay: number | null,
  contractorPay: number | null,
  additionalExpense: number | null
): number | null {
  if (customerPay == null && contractorPay == null && additionalExpense == null) return null;
  return (customerPay ?? 0) - (contractorPay ?? 0) - (additionalExpense ?? 0);
}
