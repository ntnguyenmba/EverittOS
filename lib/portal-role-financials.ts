/**
 * Role-safe portal financials.
 * Contractor: worker-linked job_labor only.
 * Client: customer-facing invoice / job revenue only.
 */

export const CONTRACTOR_FORBIDDEN_FIELDS = [
  'revenue_amount',
  'expected_contractor_cost',
  'expected_additional_expense',
  'expected_profit',
  'profit',
  'margin',
  'client_income',
  'invoice_total',
  'company_revenue'
] as const;

export const CLIENT_FORBIDDEN_FIELDS = [
  'expected_contractor_cost',
  'contractor_pay',
  'contractor_hourly_rate',
  'contractor_hours',
  'contractor_pay_basis',
  'total_cost',
  'job_labor',
  'labor_cost',
  'margin',
  'profit',
  'expected_additional_expense',
  'expense',
  'expenses'
] as const;

export const CONTRACTOR_SAFE_JOB_COLUMNS =
  'id, title, customer_name, address, status, start_date, due_date, scheduled_start, assigned_to, notes, customer_notes, phone';

export const CLIENT_SAFE_JOB_COLUMNS =
  'id, title, status, customer_name, customer_notes, address, scheduled_start, scheduled_end, start_date, due_date, timezone, completed_at, created_at, revenue_amount';

const IGNORED_INVOICE_STATUSES = new Set([
  'void',
  'cancelled',
  'canceled',
  'draft',
  'scheduled'
]);

export type ContractorLaborInput = {
  job_id?: string | null;
  worker_id?: string | null;
  total_cost?: number | string | null;
  payment_status?: string | null;
};

export type ClientInvoiceInput = {
  amount?: number | string | null;
  amount_paid?: number | string | null;
  status?: string | null;
  payment_status?: string | null;
};

export type ContractorJobPay = {
  payAmount: number | null;
  paymentStatus: 'paid' | 'pending' | 'unpaid' | null;
};

export type ClientJobCharges = {
  jobTotal: number | null;
  paid: number;
  balanceDue: number | null;
};

function moneyNumber(value: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function roundMoney(value: number): number {
  return Number(value.toFixed(2));
}

function normalizedStatus(value: string | null | undefined): string {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '_');
}

export function objectHasForbiddenField(
  value: unknown,
  forbidden: readonly string[]
): string | null {
  if (!value || typeof value !== 'object') return null;
  if (Array.isArray(value)) {
    for (const item of value) {
      const nested = objectHasForbiddenField(item, forbidden);
      if (nested) return nested;
    }
    return null;
  }

  for (const [key, nestedValue] of Object.entries(value as Record<string, unknown>)) {
    if (forbidden.includes(key)) return key;
    const nested = objectHasForbiddenField(nestedValue, forbidden);
    if (nested) return nested;
  }
  return null;
}

export function contractorPayFromLabor(
  laborRows: ContractorLaborInput[],
  workerIds: string[],
  jobId?: string | null
): ContractorJobPay {
  const allowed = new Set(workerIds.map((id) => String(id || '').trim()).filter(Boolean));
  const own = laborRows.filter((row) => {
    const workerId = String(row.worker_id || '').trim();
    if (!workerId || !allowed.has(workerId)) return false;
    if (jobId && String(row.job_id || '') !== String(jobId)) return false;
    return true;
  });

  if (!own.length) {
    return { payAmount: null, paymentStatus: null };
  }

  const payAmount = roundMoney(own.reduce((sum, row) => sum + moneyNumber(row.total_cost), 0));
  const statuses = own.map((row) => {
    const status = normalizedStatus(row.payment_status);
    if (status === 'paid') return 'paid';
    if (status === 'pending') return 'pending';
    return 'unpaid';
  });

  let paymentStatus: ContractorJobPay['paymentStatus'] = 'unpaid';
  if (statuses.every((status) => status === 'paid')) paymentStatus = 'paid';
  else if (statuses.some((status) => status === 'pending')) paymentStatus = 'pending';

  return { payAmount, paymentStatus };
}

export function contractorEarningsTotals(laborRows: ContractorLaborInput[], workerIds: string[]) {
  const { payAmount } = contractorPayFromLabor(laborRows, workerIds);
  const allowed = new Set(workerIds.map((id) => String(id || '').trim()).filter(Boolean));
  let paid = 0;
  for (const row of laborRows) {
    const workerId = String(row.worker_id || '').trim();
    if (!workerId || !allowed.has(workerId)) continue;
    const amount = moneyNumber(row.total_cost);
    if (normalizedStatus(row.payment_status) === 'paid') paid += amount;
  }
  const total = payAmount == null ? 0 : payAmount;
  const paidRounded = roundMoney(paid);
  return {
    total: roundMoney(total),
    paid: paidRounded,
    owed: roundMoney(Math.max(0, total - paidRounded))
  };
}

export function clientJobCharges(input: {
  invoices?: ClientInvoiceInput[] | null;
  revenueAmount?: number | string | null;
}): ClientJobCharges {
  const invoices = (input.invoices || []).filter((invoice) => {
    const status = normalizedStatus(invoice.status);
    return !IGNORED_INVOICE_STATUSES.has(status);
  });

  if (invoices.length) {
    const jobTotal = roundMoney(invoices.reduce((sum, invoice) => sum + moneyNumber(invoice.amount), 0));
    const paid = roundMoney(invoices.reduce((sum, invoice) => sum + moneyNumber(invoice.amount_paid), 0));
    return {
      jobTotal,
      paid,
      balanceDue: roundMoney(Math.max(0, jobTotal - paid))
    };
  }

  if (input.revenueAmount != null && input.revenueAmount !== '' && Number.isFinite(Number(input.revenueAmount))) {
    const jobTotal = roundMoney(Number(input.revenueAmount));
    return {
      jobTotal,
      paid: 0,
      balanceDue: jobTotal
    };
  }

  return { jobTotal: null, paid: 0, balanceDue: null };
}

export function toClientFacingCharges(charges: ClientJobCharges) {
  return {
    jobTotal: charges.jobTotal,
    paid: charges.paid,
    balanceDue: charges.balanceDue
  };
}
