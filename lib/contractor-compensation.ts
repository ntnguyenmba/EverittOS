export type ContractorClassification = 'contractor' | 'owner_operator';

export type HourlyRateParseResult =
  | { ok: true; value: number | null }
  | { ok: false; error: string };

const CLASSIFICATION_LABELS: Record<ContractorClassification, string> = {
  contractor: 'Independent contractor',
  owner_operator: 'Owner / owner-operator'
};

export function contractorClassificationOptions(): Array<{ value: ContractorClassification; label: string }> {
  return (Object.keys(CLASSIFICATION_LABELS) as ContractorClassification[]).map((value) => ({
    value,
    label: CLASSIFICATION_LABELS[value]
  }));
}

export function normalizeContractorClassification(
  value: string | null | undefined
): ContractorClassification {
  const normalized = (value || '').trim().toLowerCase();
  if (normalized === 'owner_operator' || normalized === 'owner-operator' || normalized === 'owner') {
    return 'owner_operator';
  }
  return 'contractor';
}

export function isOwnerOperatorClassification(classification: ContractorClassification): boolean {
  return classification === 'owner_operator';
}

export function parseHourlyRateInput(value: string | number | null | undefined): HourlyRateParseResult {
  if (value === null || value === undefined) {
    return { ok: true, value: null };
  }

  if (typeof value === 'number') {
    if (!Number.isFinite(value)) {
      return { ok: false, error: 'Enter a valid hourly compensation amount.' };
    }
    if (value < 0) {
      return { ok: false, error: 'Hourly compensation cannot be negative.' };
    }
    return { ok: true, value: Number(value.toFixed(2)) };
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return { ok: true, value: null };
  }

  const normalized = trimmed.replace(/,/g, '');
  if (!/^\d+(\.\d{1,2})?$/.test(normalized)) {
    return { ok: false, error: 'Enter a valid hourly compensation amount.' };
  }

  const parsed = Number.parseFloat(normalized);
  if (!Number.isFinite(parsed)) {
    return { ok: false, error: 'Enter a valid hourly compensation amount.' };
  }
  if (parsed < 0) {
    return { ok: false, error: 'Hourly compensation cannot be negative.' };
  }

  return { ok: true, value: Number(parsed.toFixed(2)) };
}

export function formatHourlyRateAmount(hourlyRate: number | null | undefined): string | null {
  if (hourlyRate === null || hourlyRate === undefined || !Number.isFinite(Number(hourlyRate))) {
    return null;
  }

  const amount = Number(hourlyRate).toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: Number(hourlyRate) % 1 === 0 ? 0 : 2,
    maximumFractionDigits: 2
  });

  return `${amount} / hour`;
}

export function formatContractorCompensationLabel(input: {
  classification?: string | null;
  hourlyRate?: number | null;
}): string {
  const classification = normalizeContractorClassification(input.classification);
  const rateLabel = formatHourlyRateAmount(input.hourlyRate);

  if (classification === 'owner_operator') {
    if (rateLabel) {
      return `${rateLabel} · Owner`;
    }
    return 'Owner · Compensation not entered';
  }

  if (rateLabel) {
    return rateLabel;
  }

  return 'Rate not entered';
}

export function laborCostFromHourlyRate(hourlyRate: number | null | undefined, hours: number): number {
  const safeHours = Number.isFinite(hours) ? Math.max(0, hours) : 0;
  if (hourlyRate === null || hourlyRate === undefined || !Number.isFinite(Number(hourlyRate))) {
    return 0;
  }
  return Number((safeHours * Number(hourlyRate)).toFixed(2));
}
