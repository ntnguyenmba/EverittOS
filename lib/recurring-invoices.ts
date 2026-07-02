export const RECURRING_CADENCES = ['weekly', 'monthly', 'quarterly', 'yearly'] as const;
export type RecurringCadence = (typeof RECURRING_CADENCES)[number];

export type RecurringInvoiceTemplate = {
  id: string;
  organization_id: string;
  customer_id: string | null;
  job_id: string | null;
  title: string;
  amount: number;
  cadence: string;
  next_run_on: string | null;
  active: boolean;
  metadata: Record<string, unknown>;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

export function isRecurringCadence(value: string): value is RecurringCadence {
  return RECURRING_CADENCES.includes(value as RecurringCadence);
}

export function advanceNextRunOn(cadence: string, fromDate: string): string {
  const base = new Date(`${fromDate}T12:00:00`);
  switch (cadence) {
    case 'weekly':
      base.setDate(base.getDate() + 7);
      break;
    case 'quarterly':
      base.setMonth(base.getMonth() + 3);
      break;
    case 'yearly':
      base.setFullYear(base.getFullYear() + 1);
      break;
    case 'monthly':
    default:
      base.setMonth(base.getMonth() + 1);
      break;
  }
  return base.toISOString().slice(0, 10);
}

export function cadenceLabel(cadence: string): string {
  switch (cadence) {
    case 'weekly':
      return 'Weekly';
    case 'quarterly':
      return 'Quarterly';
    case 'yearly':
      return 'Yearly';
    case 'monthly':
    default:
      return 'Monthly';
  }
}
