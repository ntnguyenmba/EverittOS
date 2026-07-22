import { formatCurrency } from '@/lib/finance-format';
import { normalizeLocale, type Locale } from '@/lib/i18n/config';

export type LaborPaymentBasis = 'hourly' | 'flat' | 'visit';

export type LaborBasisLabels = {
  flatAmount: string;
  visit: string;
  visits: string;
  hour: string;
  hours: string;
  quantity: string;
  visitsLabel: string;
  hoursLabel: string;
};

const DEFAULT_LABELS: LaborBasisLabels = {
  flatAmount: 'Flat amount',
  visit: 'visit',
  visits: 'visits',
  hour: 'hour',
  hours: 'hours',
  quantity: 'Quantity',
  visitsLabel: 'Visits',
  hoursLabel: 'Hours'
};

const LABELS_BY_LOCALE: Record<Locale, LaborBasisLabels> = {
  en: DEFAULT_LABELS,
  es: {
    flatAmount: 'Monto fijo',
    visit: 'visita',
    visits: 'visitas',
    hour: 'hora',
    hours: 'horas',
    quantity: 'Cantidad',
    visitsLabel: 'Visitas',
    hoursLabel: 'Horas'
  },
  vi: {
    flatAmount: 'Số tiền cố định',
    visit: 'lần',
    visits: 'lần',
    hour: 'giờ',
    hours: 'giờ',
    quantity: 'Số lượng',
    visitsLabel: 'Số lần',
    hoursLabel: 'Số giờ'
  }
};

export function getLaborBasisLabels(locale?: string | null): LaborBasisLabels {
  return LABELS_BY_LOCALE[normalizeLocale(locale)];
}

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
  locale?: string | null;
  labels?: Partial<LaborBasisLabels>;
}): string {
  const quantity = Number(input.quantity || 0);
  const rate = Number(input.rate || 0);
  const total = Number(input.total || 0);
  const basis = normalizeLaborPaymentBasis(input.paymentBasis, quantity);
  const labels = { ...getLaborBasisLabels(input.locale), ...input.labels };

  if (basis === 'flat') {
    return `${labels.flatAmount} · ${formatCurrency(total || rate)}`;
  }

  const quantityLabel = Number.isInteger(quantity)
    ? String(quantity)
    : quantity.toFixed(2).replace(/0+$/, '').replace(/\.$/, '');

  if (basis === 'visit') {
    const unit = quantity === 1 ? labels.visit : labels.visits;
    return `${quantityLabel} ${unit} × ${formatCurrency(rate)} = ${formatCurrency(total)}`;
  }

  const unit = quantity === 1 ? labels.hour : labels.hours;
  return `${quantityLabel} ${unit} × ${formatCurrency(rate)} = ${formatCurrency(total)}`;
}

export function laborQuantityLabel(
  basis: LaborPaymentBasis,
  locale?: string | null
): string {
  const labels = getLaborBasisLabels(locale);
  if (basis === 'flat') return labels.quantity;
  if (basis === 'visit') return labels.visitsLabel;
  return labels.hoursLabel;
}
