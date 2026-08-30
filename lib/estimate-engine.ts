export type EstimateSettings = {
  enabled?: boolean;
  currency?: string;
  rangePercent?: number;
  minimumCharge?: number;
  basePrices?: Record<string, number>;
  bedroomAmount?: number;
  bathroomAmount?: number;
  sqftStep?: number;
  sqftStepAmount?: number;
  frequencyMultipliers?: Record<string, number>;
  addOns?: Record<string, number>;
};

export type EstimateResult = {
  min: number;
  max: number;
  midpoint: number;
  currency: string;
  basis: number;
};

export const DEFAULT_ESTIMATE_SETTINGS: Required<EstimateSettings> = {
  enabled: true,
  currency: 'USD',
  rangePercent: 12,
  minimumCharge: 120,
  basePrices: {
    'standard cleaning': 140,
    'deep cleaning': 220,
    'move-in / move-out': 260
  },
  bedroomAmount: 20,
  bathroomAmount: 30,
  sqftStep: 500,
  sqftStepAmount: 20,
  frequencyMultipliers: {
    'one-time': 1,
    weekly: 0.85,
    'bi-weekly': 0.9,
    monthly: 0.95
  },
  addOns: {
    oven: 35,
    refrigerator: 35,
    windows: 50,
    laundry: 25
  }
};

function numberValue(value: unknown, fallback: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function normalizeKey(value: unknown) {
  return String(value || '').trim().toLowerCase();
}

function firstValue(payload: Record<string, unknown>, keys: string[]) {
  const entries = Object.entries(payload);
  for (const key of keys) {
    const wanted = normalizeKey(key);
    const match = entries.find(([entryKey]) => normalizeKey(entryKey) === wanted);
    if (match && match[1] !== undefined && match[1] !== null && String(match[1]).trim() !== '') return match[1];
  }
  return undefined;
}

export function normalizeEstimateSettings(raw: unknown): Required<EstimateSettings> {
  const source = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
  const estimate = source.estimate && typeof source.estimate === 'object' ? (source.estimate as Record<string, unknown>) : source;

  return {
    enabled: estimate.enabled !== false,
    currency: String(estimate.currency || DEFAULT_ESTIMATE_SETTINGS.currency),
    rangePercent: numberValue(estimate.rangePercent, DEFAULT_ESTIMATE_SETTINGS.rangePercent),
    minimumCharge: numberValue(estimate.minimumCharge, DEFAULT_ESTIMATE_SETTINGS.minimumCharge),
    basePrices: {
      ...DEFAULT_ESTIMATE_SETTINGS.basePrices,
      ...((estimate.basePrices as Record<string, number> | undefined) || {})
    },
    bedroomAmount: numberValue(estimate.bedroomAmount, DEFAULT_ESTIMATE_SETTINGS.bedroomAmount),
    bathroomAmount: numberValue(estimate.bathroomAmount, DEFAULT_ESTIMATE_SETTINGS.bathroomAmount),
    sqftStep: Math.max(1, numberValue(estimate.sqftStep, DEFAULT_ESTIMATE_SETTINGS.sqftStep)),
    sqftStepAmount: numberValue(estimate.sqftStepAmount, DEFAULT_ESTIMATE_SETTINGS.sqftStepAmount),
    frequencyMultipliers: {
      ...DEFAULT_ESTIMATE_SETTINGS.frequencyMultipliers,
      ...((estimate.frequencyMultipliers as Record<string, number> | undefined) || {})
    },
    addOns: {
      ...DEFAULT_ESTIMATE_SETTINGS.addOns,
      ...((estimate.addOns as Record<string, number> | undefined) || {})
    }
  };
}

export function calculateEstimate(rawSettings: unknown, payload: Record<string, unknown>): EstimateResult | null {
  const settings = normalizeEstimateSettings(rawSettings);
  if (!settings.enabled) return null;

  const serviceType = normalizeKey(firstValue(payload, ['Service type', 'Service', 'Cleaning type']));
  const bedrooms = Math.max(0, numberValue(firstValue(payload, ['Bedrooms', 'Beds']), 0));
  const bathrooms = Math.max(0, numberValue(firstValue(payload, ['Bathrooms', 'Baths']), 0));
  const sqft = Math.max(0, numberValue(firstValue(payload, ['Approx. sq ft', 'Square feet', 'Sq ft', 'Square footage']), 0));
  const frequency = normalizeKey(firstValue(payload, ['Frequency', 'Service frequency']));
  const addOnText = normalizeKey(firstValue(payload, ['Add-ons', 'Add ons', 'Extras', 'Special requests']));

  const fallbackBase = Math.min(...Object.values(settings.basePrices).filter((value) => Number.isFinite(value) && value > 0));
  let total = numberValue(settings.basePrices[serviceType], Number.isFinite(fallbackBase) ? fallbackBase : settings.minimumCharge);

  total += Math.max(0, bedrooms - 1) * settings.bedroomAmount;
  total += Math.max(0, bathrooms - 1) * settings.bathroomAmount;

  if (sqft > 1000) {
    total += Math.ceil((sqft - 1000) / settings.sqftStep) * settings.sqftStepAmount;
  }

  for (const [label, price] of Object.entries(settings.addOns)) {
    if (addOnText.includes(normalizeKey(label))) total += numberValue(price, 0);
  }

  const multiplier = numberValue(settings.frequencyMultipliers[frequency], 1);
  total *= multiplier > 0 ? multiplier : 1;
  total = Math.max(settings.minimumCharge, total);

  const range = Math.max(0, settings.rangePercent) / 100;
  const min = Math.max(settings.minimumCharge, Math.round(total * (1 - range)));
  const max = Math.max(min, Math.round(total * (1 + range)));

  return {
    min,
    max,
    midpoint: Math.round((min + max) / 2),
    currency: settings.currency,
    basis: Math.round(total)
  };
}

export function formatEstimateRange(result: EstimateResult) {
  try {
    const formatter = new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency: result.currency,
      maximumFractionDigits: 0
    });
    return `${formatter.format(result.min)}–${formatter.format(result.max)}`;
  } catch {
    return `${result.currency} ${result.min}–${result.max}`;
  }
}
