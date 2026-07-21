import { formatCurrency } from '@/lib/finance-format';

export type LaborPaymentBasis = 'hourly' | 'flat' | 'visit';

export function normalizeLaborPaymentBasis(
  value: unknown,
  quantity?: unknown
): LaborPaymentBasis {
  const raw = String(value || '')
    .trim()
    .toLowerCase();
  if (raw === 'flat' || raw === 'visit' || raw === 'hourly') return raw;

  // Legacy UI saved flat amounts as quantity = 1 with no basis column.
  if (Number(quantity) === 1) return 'flat';
  return 'hourly';
}

export function formatLaborPaymentLabel(input: {
  paymentBasis?: unknown;
  quantity?: unknown;
  rate?: unknown;
  total?: unknown;
}): string {
  const quantity = Number(input.quantity || 0);
  const rate = Number(input.rate || 0);
  const total = Number(input.total || 0);
  const basis = normalizeLaborPaymentBasis(input.paymentBasis, quantity);

  if (basis === 'flat') {
    return `Flat amount · ${formatCurrency(total || rate)}`;
  }

  const quantityLabel = Number.isInteger(quantity)
    ? String(quantity)
    : quantity.toFixed(2).replace(/0+$/, '').replace(/\.$/, '');

  if (basis === 'visit') {
    return `${quantityLabel} visit${quantity === 1 ? '' : 's'} × ${formatCurrency(rate)} = ${formatCurrency(total)}`;
  }

  return `${quantityLabel} hour${quantity === 1 ? '' : 's'} × ${formatCurrency(rate)} = ${formatCurrency(total)}`;
}

export function laborQuantityLabel(basis: LaborPaymentBasis): string {
  if (basis === 'flat') return 'Quantity';
  if (basis === 'visit') return 'Visits';
  return 'Hours';
}
