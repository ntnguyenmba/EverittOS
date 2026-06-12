export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(Number.isFinite(amount) ? amount : 0);
}

export function parseMoneyInput(value: string | number): number {
  if (typeof value === 'number') return Number.isFinite(value) ? Math.max(0, value) : 0;
  const parsed = Number.parseFloat(String(value).replace(/[^0-9.-]/g, ''));
  return Number.isFinite(parsed) ? Math.max(0, parsed) : 0;
}

export function laborTotal(hours: number, hourlyCost: number): number {
  const h = Number.isFinite(hours) ? hours : 0;
  const rate = Number.isFinite(hourlyCost) ? hourlyCost : 0;
  return Number((h * rate).toFixed(2));
}
