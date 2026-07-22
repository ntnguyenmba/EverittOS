import type { SupabaseClient } from '@supabase/supabase-js';
import { calculateInvoicePaymentStatus } from '@/lib/outbound/invoice-payment';
import { countOrganizationJobs } from '@/lib/jobs-org-query';
import {
  getCompletedJobReportingDate,
  getJobOperationalDate,
  isActiveCustomerRecord,
  isCompletedJobMissingCompletedAt,
  type JobDateFields
} from '@/lib/job-operational-date';

const CANCELLED_JOB_STATUSES = ['cancelled', 'canceled'];
const CANCELLED_BOOKING_STATUSES = ['cancelled', 'canceled'];

export type DashboardDateRange = 'month' | 'quarter' | 'year' | 'last_year' | 'all_time';

/**
 * Dashboard financial metrics.
 * Internal field names keep compatibility; UI uses plain-language labels.
 */
export type DashboardRevenueMetrics = {
  /** @deprecated Prefer paidToYou */
  revenueThisMonth: number;
  /** Paid to you — customer payments in the selected period */
  cashCollected: number;
  paidToYou: number;
  /** Customer invoices created in the selected period (invoices only, no manual job revenue) */
  customerInvoices: number;
  /** Uninvoiced job expected revenue in the selected period (excludes jobs that already have an invoice) */
  uninvoicedCompletedWork: number;
  /**
   * Expected revenue = invoice totals created in the period + uninvoiced job expected revenue.
   * Invoiced jobs are never double counted.
   */
  expectedRevenue: number;
  /**
   * @deprecated Prefer customerInvoices for invoice totals.
   * Previously mixed invoices + manual job revenue. Now equals customerInvoices only.
   */
  bookedRevenue: number;
  /** Still owed — current unpaid balances across all non-cancelled invoices */
  pendingIncoming: number;
  stillOwed: number;
  /** Late payments — current overdue unpaid balances */
  overdueAmount: number;
  latePayments: number;
  averageDaysToPayment: number | null;
  outstandingInvoices: number;
  outstandingInvoiceCount: number;
  overdueInvoiceCount: number;
  unpaidInvoiceTotal: number;
  jobsCompleted: number;
  jobsCompletedThisMonth: number;
  /** Completed jobs in the period that lack completed_at (using legacy date fallback) */
  completedJobsMissingCompletedAt: number;
  /** Job ids for completed jobs missing completed_at (for correction links) */
  completedJobsMissingCompletedAtIds: string[];
  activeCustomers: number;
  customerCount: number;
  upcomingJobs: number;
  /** Contractor pay recorded/incurred in the selected period */
  contractorPayThisMonth?: number;
  /** Contractor payments actually paid in the selected period */
  contractorPaymentsPaid?: number;
  unpaidContractorPay?: number;
  pendingContractorPay?: number;
  otherExpensesThisMonth?: number;
  expenseTotalThisMonth: number;
  /** Expected profit = expected revenue − contractor cost incurred − other expenses */
  netEstimateThisMonth: number;
  estimatedProfit: number;
  /** Cash after paid costs = payments received − contractor payments paid − expenses paid */
  netCashFlow: number;
  cashAfterExpenses: number;
  /** Alias of cashAfterExpenses — the single cash metric shown on the dashboard */
  cashAfterPaidCosts: number;
  /**
   * @deprecated Conflicting metric that excluded contractor payments. Always 0; use cashAfterPaidCosts.
   */
  moneySummaryNetCash: number;
  /** True when the organization has at least one invoice row (invoicing has been used). */
  hasCreatedInvoices: boolean;
  /** True when a required dashboard query failed (not empty data). */
  loadFailed: boolean;
  /** Invoices with amount_paid > 0 but no payment date (diagnostic) */
  paymentsMissingDates: number;
  bookingCountThisMonth: number;
  messageCount: number;
  reportCount: number;
  jobsByStatus: Record<string, number>;
  totalJobs: number;
};

export type LaborCostRow = {
  total_cost?: unknown;
  created_at?: unknown;
  payment_status?: unknown;
  paid_at?: unknown;
};

export type InvoiceMetricRow = {
  id?: unknown;
  amount?: unknown;
  amount_paid?: unknown;
  invoice_date?: unknown;
  created_at?: unknown;
  due_date?: unknown;
  payment_status?: unknown;
  status?: unknown;
  paid_at?: unknown;
  last_payment_at?: unknown;
  job_id?: unknown;
};

export type InvoicePaymentRow = {
  amount?: unknown;
  paid_at?: unknown;
  invoice_id?: unknown;
};

export type JobPaymentMetricRow = {
  amount?: unknown;
  paid_at?: unknown;
  job_id?: unknown;
};

export type JobRevenueRow = {
  id?: unknown;
  revenue_amount?: unknown;
};

function formatLocalDateOnly(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function todayIso(): string {
  return formatLocalDateOnly(new Date());
}

export function rangeBounds(range: DashboardDateRange, now = new Date()): { start: string | null; end: string | null } {
  const year = now.getFullYear();
  if (range === 'all_time') return { start: null, end: null };
  if (range === 'last_year') return { start: `${year - 1}-01-01`, end: `${year}-01-01` };
  if (range === 'year') return { start: `${year}-01-01`, end: `${year + 1}-01-01` };
  if (range === 'quarter') {
    const quarterStartMonth = Math.floor(now.getMonth() / 3) * 3;
    const start = new Date(year, quarterStartMonth, 1);
    const end = new Date(year, quarterStartMonth + 3, 1);
    return { start: formatLocalDateOnly(start), end: formatLocalDateOnly(end) };
  }
  const start = new Date(year, now.getMonth(), 1);
  const end = new Date(year, now.getMonth() + 1, 1);
  return { start: formatLocalDateOnly(start), end: formatLocalDateOnly(end) };
}

export function inRange(value: unknown, start: string | null, end: string | null): boolean {
  const date = String(value || '').slice(0, 10);
  if (!date) return false;
  if (start && date < start) return false;
  if (end && date >= end) return false;
  return true;
}

export function num(value: unknown): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

export function isCancelledInvoice(row: { payment_status?: unknown; status?: unknown }): boolean {
  const statusHint = String(row.payment_status || row.status || '').toLowerCase();
  return statusHint === 'cancelled' || statusHint === 'canceled';
}

export function invoiceDate(row: { invoice_date?: unknown; created_at?: unknown }): string {
  return String(row.invoice_date || row.created_at || '').slice(0, 10);
}

export function paymentDate(row: { paid_at?: unknown; last_payment_at?: unknown }): string {
  return String(row.paid_at || row.last_payment_at || '').slice(0, 10);
}

/** Cap paid amount at invoice total so overpayments do not inflate cash or understate still owed. */
export function cappedAmountPaid(amount: unknown, amountPaid: unknown): number {
  const total = Math.max(0, num(amount));
  const paid = Math.max(0, num(amountPaid));
  if (total <= 0) return paid;
  return Math.min(paid, total);
}

export function remainingBalance(amount: unknown, amountPaid: unknown): number {
  return Math.max(0, num(amount) - cappedAmountPaid(amount, amountPaid));
}

function daysBetween(startValue: unknown, endValue: unknown): number | null {
  const start = new Date(String(startValue || ''));
  const end = new Date(String(endValue || ''));
  if (!Number.isFinite(start.getTime()) || !Number.isFinite(end.getTime())) return null;
  return Math.max(0, Math.round((end.getTime() - start.getTime()) / 86400000));
}

/** Customer invoices = non-cancelled invoice totals created in the selected period. */
export function calculateCustomerInvoices(
  invoices: InvoiceMetricRow[],
  start: string | null,
  end: string | null
): number {
  return invoices.reduce((sum, inv) => {
    if (isCancelledInvoice(inv)) return sum;
    return inRange(invoiceDate(inv), start, end) ? sum + num(inv.amount) : sum;
  }, 0);
}

/** Still owed on non-invoiced jobs with an expected amount set. */
export function calculateDirectJobOutstanding(
  jobs: JobRevenueRow[],
  invoicedJobIds: Set<string>,
  collectedByJobId: Map<string, number>
): number {
  let total = 0;
  for (const job of jobs) {
    const jobId = String(job.id || '');
    if (!jobId || invoicedJobIds.has(jobId)) continue;
    const expected = num(job.revenue_amount);
    if (expected <= 0) continue;
    const collected = collectedByJobId.get(jobId) || 0;
    total += Math.max(0, expected - collected);
  }
  return Number(total.toFixed(2));
}

export function sumJobPaymentsByJobId(rows: JobPaymentMetricRow[]): Map<string, number> {
  const map = new Map<string, number>();
  for (const row of rows) {
    const jobId = String(row.job_id || '');
    if (!jobId) continue;
    map.set(jobId, Number(((map.get(jobId) || 0) + num(row.amount)).toFixed(2)));
  }
  return map;
}

/** Still owed = current unpaid balances on non-cancelled invoices. */
export function calculateStillOwed(invoices: InvoiceMetricRow[]): number {
  return invoices.reduce((sum, inv) => {
    if (isCancelledInvoice(inv)) return sum;
    return sum + remainingBalance(inv.amount, inv.amount_paid);
  }, 0);
}

/** Late payments = current overdue unpaid balances. */
export function calculateLatePayments(invoices: InvoiceMetricRow[], today = todayIso()): {
  amount: number;
  count: number;
} {
  let amount = 0;
  let count = 0;
  for (const inv of invoices) {
    if (isCancelledInvoice(inv)) continue;
    const balance = remainingBalance(inv.amount, inv.amount_paid);
    if (balance <= 0) continue;
    const status = calculateInvoicePaymentStatus({
      amount: num(inv.amount),
      amount_paid: cappedAmountPaid(inv.amount, inv.amount_paid),
      due_date: inv.due_date as string | null,
      payment_status: inv.payment_status as string | null
    });
    if (status === 'overdue' || (inv.due_date && String(inv.due_date).slice(0, 10) < today && balance > 0)) {
      amount += balance;
      count += 1;
    }
  }
  return { amount, count };
}

export function countUnpaidInvoices(invoices: InvoiceMetricRow[]): number {
  return invoices.reduce((count, inv) => {
    if (isCancelledInvoice(inv)) return count;
    return remainingBalance(inv.amount, inv.amount_paid) > 0 ? count + 1 : count;
  }, 0);
}

/**
 * Paid to you from payment ledger rows whose paid_at falls in range.
 * Falls back to invoice summary fields when no ledger rows exist for an invoice.
 */
export function calculatePaidToYou(input: {
  invoices: InvoiceMetricRow[];
  paymentRows: InvoicePaymentRow[];
  jobPaymentRows?: JobPaymentMetricRow[];
  start: string | null;
  end: string | null;
  range: DashboardDateRange;
}): { paidToYou: number; paymentsMissingDates: number } {
  const { invoices, paymentRows, jobPaymentRows = [], start, end, range } = input;
  const cancelledInvoiceIds = new Set(
    invoices.filter((inv) => isCancelledInvoice(inv)).map((inv) => String(inv.id || '')).filter(Boolean)
  );
  const activeInvoiceIds = new Set(
    invoices.filter((inv) => !isCancelledInvoice(inv)).map((inv) => String(inv.id || '')).filter(Boolean)
  );

  let paidToYou = 0;
  const invoicesWithLedger = new Set<string>();

  for (const row of paymentRows) {
    const invoiceId = String(row.invoice_id || '');
    if (invoiceId && cancelledInvoiceIds.has(invoiceId)) continue;
    if (invoiceId && activeInvoiceIds.size > 0 && !activeInvoiceIds.has(invoiceId)) {
      // Payment belongs to an invoice outside this org/result set.
      continue;
    }
    if (invoiceId) invoicesWithLedger.add(invoiceId);
    if (range === 'all_time') {
      paidToYou += num(row.amount);
      continue;
    }
    if (inRange(row.paid_at, start, end)) {
      paidToYou += num(row.amount);
    }
  }

  let paymentsMissingDates = 0;

  // Legacy fallback for invoices that have amount_paid but no ledger payment rows.
  for (const inv of invoices) {
    if (isCancelledInvoice(inv)) continue;
    const invoiceId = String(inv.id || '');
    if (invoiceId && invoicesWithLedger.has(invoiceId)) continue;

    const paid = cappedAmountPaid(inv.amount, inv.amount_paid);
    if (paid <= 0) continue;

    const paidDate = paymentDate(inv);
    if (!paidDate) {
      paymentsMissingDates += 1;
      // Undated payments: include in all_time only. For bounded periods, include only when
      // the invoice itself was created in the period (documented legacy fallback).
      if (range === 'all_time') {
        paidToYou += paid;
      } else if (inRange(invoiceDate(inv), start, end)) {
        paidToYou += paid;
      }
      continue;
    }

    if (range === 'all_time' || inRange(paidDate, start, end)) {
      paidToYou += paid;
    }
  }

  for (const row of jobPaymentRows) {
    if (range === 'all_time') {
      paidToYou += num(row.amount);
      continue;
    }
    if (inRange(row.paid_at, start, end)) {
      paidToYou += num(row.amount);
    }
  }

  return {
    paidToYou: Number(paidToYou.toFixed(2)),
    paymentsMissingDates
  };
}

/** Accrued contractor labor cost recorded/incurred in the selected period. */
export function calculateContractorAccruedCost(
  laborRows: LaborCostRow[],
  start: string | null,
  end: string | null
): number {
  return laborRows.reduce((sum, row) => {
    return inRange(row.created_at, start, end) ? sum + num(row.total_cost) : sum;
  }, 0);
}

/**
 * Contractor cash paid during the selected period.
 * Paid rows without paid_at cannot be assigned to a cash-flow period.
 */
export function calculateContractorCashPaid(
  laborRows: LaborCostRow[],
  start: string | null,
  end: string | null,
  range: DashboardDateRange = 'month'
): number {
  return laborRows.reduce((sum, row) => {
    const status = String(row.payment_status || '').toLowerCase();
    if (status !== 'paid') return sum;
    if (!row.paid_at) return sum;
    if (range === 'all_time') return sum + num(row.total_cost);
    if (!inRange(row.paid_at, start, end)) return sum;
    return sum + num(row.total_cost);
  }, 0);
}

export function calculateUnpaidContractorPay(laborRows: LaborCostRow[]): number {
  return laborRows.reduce((sum, row) => {
    const status = String(row.payment_status || 'unpaid').toLowerCase();
    return status === 'unpaid' ? sum + num(row.total_cost) : sum;
  }, 0);
}

export function calculatePendingContractorPay(laborRows: LaborCostRow[]): number {
  return laborRows.reduce((sum, row) => {
    const status = String(row.payment_status || '').toLowerCase();
    return status === 'pending' ? sum + num(row.total_cost) : sum;
  }, 0);
}

export type JobExpectedRevenueRow = JobDateFields & {
  id?: unknown;
  revenue_amount?: unknown;
};

/**
 * Uninvoiced expected revenue for jobs in the period.
 * Jobs that already have an invoice are never included.
 */
export function calculateUninvoicedExpectedRevenue(
  jobs: JobExpectedRevenueRow[],
  invoicedJobIds: Set<string>,
  start: string | null,
  end: string | null
): number {
  return jobs.reduce((sum, job) => {
    const jobId = String(job.id || '');
    if (jobId && invoicedJobIds.has(jobId)) return sum;
    const status = String(job.status || '').toLowerCase();
    if (status === 'cancelled' || status === 'canceled') return sum;
    const amount = num(job.revenue_amount);
    if (amount <= 0) return sum;
    const bookedDate = getJobOperationalDate(job);
    return inRange(bookedDate, start, end) ? sum + amount : sum;
  }, 0);
}

/** Expected revenue = invoice totals + uninvoiced job expected revenue (no double count). */
export function calculateExpectedRevenue(
  customerInvoices: number,
  uninvoicedExpectedRevenue: number
): number {
  return Number((num(customerInvoices) + num(uninvoicedExpectedRevenue)).toFixed(2));
}

/**
 * Expected profit = expected revenue − contractor cost incurred − other recorded expenses.
 * Pass expectedRevenue, or customerInvoices + uninvoicedCompletedWork.
 */
export function calculateEstimatedProfit(input: {
  expectedRevenue?: number;
  customerInvoices?: number;
  uninvoicedCompletedWork?: number;
  contractorPay: number;
  otherExpenses: number;
}): number {
  const expected =
    input.expectedRevenue !== undefined
      ? num(input.expectedRevenue)
      : num(input.customerInvoices) + num(input.uninvoicedCompletedWork);
  return Number((expected - num(input.contractorPay) - num(input.otherExpenses)).toFixed(2));
}

/** Cash after paid costs = payments received − contractor payments paid − expenses paid. */
export function calculateNetCashFlow(input: {
  cashCollected: number;
  contractorCashPaid: number;
  otherCashExpenses: number;
}): number {
  return Number(
    (num(input.cashCollected) - num(input.contractorCashPaid) - num(input.otherCashExpenses)).toFixed(2)
  );
}

export const calculateCashAfterExpenses = calculateNetCashFlow;
export const calculateCashAfterPaidCosts = calculateNetCashFlow;

/**
 * @deprecated Use calculateCashAfterPaidCosts. This excluded contractor payments and conflicted with cash after paid costs.
 */
export function calculateMoneySummaryNetCash(collected: number, expensesPaid: number): number {
  return Number((num(collected) - num(expensesPaid)).toFixed(2));
}

export type PrimaryDashboardMetricKey =
  | 'expectedRevenue'
  | 'collected'
  | 'outstanding'
  | 'contractorCost'
  | 'expectedProfit'
  | 'cashAfterPaidCosts';

export type PrimaryDashboardMetric = {
  key: PrimaryDashboardMetricKey;
  label: string;
  value: number;
  help: string;
};

/** Primary dashboard cards — one accurate set of money metrics, no duplicate Net cash. */
export function buildPrimaryDashboardMetrics(input: {
  expectedRevenue: number;
  collected: number;
  outstanding: number;
  contractorCost: number;
  expectedProfit: number;
  cashAfterPaidCosts: number;
  labels?: Partial<Record<PrimaryDashboardMetricKey, string>>;
  helps?: Partial<Record<PrimaryDashboardMetricKey, string>>;
}): PrimaryDashboardMetric[] {
  const defaults: Record<PrimaryDashboardMetricKey, { label: string; help: string }> = {
    expectedRevenue: {
      label: 'Expected revenue',
      help: 'Invoice totals created in this period plus expected amounts on jobs that do not have an invoice yet. A job is never counted twice.'
    },
    collected: {
      label: 'Collected',
      help: 'Client payments actually received in this period from invoices and direct job payments.'
    },
    outstanding: {
      label: 'Outstanding',
      help: 'Unpaid invoice balances plus unpaid expected amounts on jobs without an invoice.'
    },
    contractorCost: {
      label: 'Contractor cost',
      help: 'Contractor cost recorded for this period, whether already paid or still owed.'
    },
    expectedProfit: {
      label: 'Expected profit',
      help: 'Expected revenue minus contractor cost incurred minus other recorded expenses. This is not the same as cash in the bank.'
    },
    cashAfterPaidCosts: {
      label: 'Cash after paid costs',
      help: 'Payments actually received minus contractor payments actually paid minus expenses actually paid.'
    }
  };

  return (Object.keys(defaults) as PrimaryDashboardMetricKey[]).map((key) => ({
    key,
    label: input.labels?.[key] || defaults[key].label,
    value: Number(num(input[key]).toFixed(2)),
    help: input.helps?.[key] || defaults[key].help
  }));
}

/**
 * @deprecated Money summary Net cash conflicted with Cash after paid costs. Use buildPrimaryDashboardMetrics.
 */
export type MoneySummaryMetric = {
  key: 'collected' | 'outstanding' | 'invoiced' | 'netCash';
  label: string;
  value: number;
  help: string;
};

/** @deprecated Use buildPrimaryDashboardMetrics. */
export function buildMoneySummaryMetrics(input: {
  rangeLabel: string;
  collected: number;
  outstanding: number;
  invoiced: number;
  expensesPaid: number;
  hasCreatedInvoices: boolean;
}): MoneySummaryMetric[] {
  const collected = Math.max(0, num(input.collected));
  const outstanding = Math.max(0, num(input.outstanding));
  const invoiced = Math.max(0, num(input.invoiced));
  const period = input.rangeLabel.toLowerCase();
  const rows: MoneySummaryMetric[] = [
    {
      key: 'collected',
      label: `Collected ${period}`,
      value: collected,
      help: 'Client payments received during this period from direct job payments and invoice payments. The same payment is never counted twice.'
    },
    {
      key: 'outstanding',
      label: 'Outstanding balance',
      value: outstanding,
      help: 'Current unpaid invoice balances plus unpaid expected amounts on jobs that do not have an invoice.'
    }
  ];
  if (input.hasCreatedInvoices) {
    rows.push({
      key: 'invoiced',
      label: `Invoiced ${period}`,
      value: invoiced,
      help: 'Total of non-cancelled invoices created during this period.'
    });
  }
  // Intentionally omit the old Net cash row — it excluded contractor payments.
  return rows;
}

export function calculateEstimatedProfitPercentage(
  estimatedProfit: number,
  expectedRevenue: number
): number | null {
  if (expectedRevenue <= 0) return null;
  return Number(((estimatedProfit / expectedRevenue) * 100).toFixed(1));
}

export function countCompletedJobsMissingCompletedAt(
  jobs: JobDateFields[]
): { count: number; ids: string[] } {
  const ids: string[] = [];
  for (const job of jobs) {
    if (!isCompletedJobMissingCompletedAt(job)) continue;
    const id = String(job.id || '');
    if (id) ids.push(id);
  }
  return { count: ids.length, ids };
}

/**
 * All-time reconciliation for non-cancelled invoices:
 * customer invoices ≈ paid to you + still owed (within rounding).
 */
export function reconcileAllTimeInvoices(input: {
  customerInvoices: number;
  paidToYou: number;
  stillOwed: number;
  tolerance?: number;
}): { ok: boolean; difference: number } {
  const difference = Number(
    (num(input.customerInvoices) - num(input.paidToYou) - num(input.stillOwed)).toFixed(2)
  );
  const tolerance = input.tolerance ?? 0.02;
  return { ok: Math.abs(difference) <= tolerance, difference };
}

function emptyMetrics(): DashboardRevenueMetrics {
  return {
    revenueThisMonth: 0,
    cashCollected: 0,
    paidToYou: 0,
    customerInvoices: 0,
    uninvoicedCompletedWork: 0,
    expectedRevenue: 0,
    bookedRevenue: 0,
    pendingIncoming: 0,
    stillOwed: 0,
    overdueAmount: 0,
    latePayments: 0,
    averageDaysToPayment: null,
    outstandingInvoices: 0,
    outstandingInvoiceCount: 0,
    overdueInvoiceCount: 0,
    unpaidInvoiceTotal: 0,
    jobsCompleted: 0,
    jobsCompletedThisMonth: 0,
    completedJobsMissingCompletedAt: 0,
    completedJobsMissingCompletedAtIds: [],
    activeCustomers: 0,
    customerCount: 0,
    upcomingJobs: 0,
    contractorPayThisMonth: 0,
    contractorPaymentsPaid: 0,
    unpaidContractorPay: 0,
    pendingContractorPay: 0,
    otherExpensesThisMonth: 0,
    expenseTotalThisMonth: 0,
    netEstimateThisMonth: 0,
    estimatedProfit: 0,
    netCashFlow: 0,
    cashAfterExpenses: 0,
    cashAfterPaidCosts: 0,
    moneySummaryNetCash: 0,
    hasCreatedInvoices: false,
    loadFailed: false,
    paymentsMissingDates: 0,
    bookingCountThisMonth: 0,
    messageCount: 0,
    reportCount: 0,
    jobsByStatus: {},
    totalJobs: 0
  };
}

export async function fetchDashboardRevenueMetrics(
  supabase: SupabaseClient,
  organizationId: string | null,
  range: DashboardDateRange = 'month'
): Promise<DashboardRevenueMetrics> {
  const { start, end } = rangeBounds(range);
  const today = todayIso();
  const empty = emptyMetrics();

  if (!organizationId) return empty;

  const [
    invoicesRes,
    paymentRowsRes,
    jobPaymentRowsRes,
    manualRevenueJobsRes,
    laborRes,
    completedJobsRes,
    customersRes,
    upcomingJobsRes,
    jobsRes,
    expensesRes,
    bookingsRes,
    messagesRes,
    reportsRes,
    totalJobsRes,
    visitsRes
  ] = await Promise.all([
    supabase
      .from('invoices')
      .select(
        'id, amount, amount_paid, invoice_date, created_at, due_date, payment_status, status, paid_at, last_payment_at, job_id'
      )
      .eq('organization_id', organizationId),
    supabase
      .from('invoice_payments')
      .select('amount, paid_at, invoice_id')
      .eq('organization_id', organizationId),
    supabase
      .from('job_payments')
      .select('amount, paid_at, job_id')
      .eq('organization_id', organizationId),
    supabase
      .from('jobs')
      .select('id, revenue_amount, created_at, start_date, scheduled_start, completed_at, status')
      .eq('organization_id', organizationId)
      .not('revenue_amount', 'is', null),
    supabase
      .from('job_labor')
      .select('total_cost, created_at, payment_status, paid_at')
      .eq('organization_id', organizationId),
    supabase
      .from('jobs')
      .select('id, status, completed_at, start_date, scheduled_start, due_date, created_at')
      .eq('organization_id', organizationId)
      .eq('status', 'completed'),
    supabase
      .from('customers')
      .select('id, record_type, pipeline_stage')
      .eq('organization_id', organizationId)
      .eq('record_type', 'customer'),
    supabase
      .from('jobs')
      .select('id', { count: 'exact', head: true })
      .eq('organization_id', organizationId)
      .neq('status', 'completed')
      .neq('status', 'cancelled')
      .neq('status', 'canceled')
      .gte('scheduled_start', `${today}T00:00:00`),
    supabase
      .from('jobs')
      .select('id, status, created_at, start_date, scheduled_start, completed_at, due_date')
      .eq('organization_id', organizationId)
      .neq('status', 'cancelled')
      .neq('status', 'canceled'),
    // Expenses have only amount + date (no payment_status). Treat date as cash-expense date.
    supabase.from('expenses').select('amount, date').eq('organization_id', organizationId),
    supabase
      .from('bookings')
      .select('id, starts_at')
      .eq('organization_id', organizationId)
      .not('status', 'in', `(${CANCELLED_BOOKING_STATUSES.join(',')})`),
    supabase.from('customer_messages').select('id, created_at').eq('organization_id', organizationId),
    supabase.from('job_reports').select('id, created_at').eq('organization_id', organizationId),
    countOrganizationJobs(supabase, organizationId, { excludeStatuses: CANCELLED_JOB_STATUSES }),
    supabase.from('job_visits').select('job_id, visit_date').eq('organization_id', organizationId)
  ]);

  const safeCount = (res: { count: number | null; error: unknown }) => (res.error ? 0 : res.count || 0);
  const safeData = <T,>(res: { data: T | null; error: unknown }, fallback: T): T =>
    res.error ? fallback : res.data || fallback;

  const latestVisitByJobId = new Map<string, string>();
  for (const visit of (visitsRes.error ? [] : safeData(visitsRes, [])) as Array<{
    job_id?: unknown;
    visit_date?: unknown;
  }>) {
    const jobId = String(visit.job_id || '');
    const visitDate = String(visit.visit_date || '').slice(0, 10);
    if (!jobId || !/^\d{4}-\d{2}-\d{2}$/.test(visitDate)) continue;
    const current = latestVisitByJobId.get(jobId);
    if (!current || visitDate > current) latestVisitByJobId.set(jobId, visitDate);
  }

  const withVisitFallback = <T extends { id?: unknown }>(
    rows: T[]
  ): Array<T & { latest_completed_visit_date: string | null }> =>
    rows.map((row) => ({
      ...row,
      latest_completed_visit_date: latestVisitByJobId.get(String(row.id || '')) || null
    }));

  const invoices = safeData(invoicesRes, []) as InvoiceMetricRow[];
  // If invoice_payments table is missing (migration not applied), fall back gracefully.
  const paymentRows = paymentRowsRes.error ? [] : (safeData(paymentRowsRes, []) as InvoicePaymentRow[]);
  const jobPaymentRows = jobPaymentRowsRes.error ? [] : (safeData(jobPaymentRowsRes, []) as JobPaymentMetricRow[]);
  const loadFailed = Boolean(
    invoicesRes.error || expensesRes.error || manualRevenueJobsRes.error || laborRes.error
  );

  const invoicedJobIds = new Set<string>();
  for (const inv of invoices) {
    if (inv.job_id) invoicedJobIds.add(String(inv.job_id));
  }

  const customerInvoices = calculateCustomerInvoices(invoices, start, end);
  const { paidToYou, paymentsMissingDates } = calculatePaidToYou({
    invoices,
    paymentRows,
    jobPaymentRows,
    start,
    end,
    range
  });
  const invoiceStillOwed = calculateStillOwed(invoices);
  const directJobOutstanding = calculateDirectJobOutstanding(
    safeData(manualRevenueJobsRes, []) as JobRevenueRow[],
    invoicedJobIds,
    sumJobPaymentsByJobId(jobPaymentRows)
  );
  const stillOwed = Number((invoiceStillOwed + directJobOutstanding).toFixed(2));
  const late = calculateLatePayments(invoices, today);
  const outstandingInvoiceCount = countUnpaidInvoices(invoices);

  const paymentDurations: number[] = [];
  for (const inv of invoices) {
    if (isCancelledInvoice(inv)) continue;
    const amount = num(inv.amount);
    const paid = cappedAmountPaid(inv.amount, inv.amount_paid);
    const paidDate = paymentDate(inv);
    const bookedDate = invoiceDate(inv);
    if (paid > 0 && paidDate && paid >= amount) {
      const duration = daysBetween(bookedDate, paidDate);
      if (duration !== null && (range === 'all_time' || inRange(paidDate, start, end))) {
        paymentDurations.push(duration);
      }
    }
  }

  const manualRevenueJobs = withVisitFallback(
    safeData(manualRevenueJobsRes, []) as JobExpectedRevenueRow[]
  );
  const uninvoicedCompletedWork = Number(
    calculateUninvoicedExpectedRevenue(manualRevenueJobs, invoicedJobIds, start, end).toFixed(2)
  );
  const expectedRevenue = calculateExpectedRevenue(customerInvoices, uninvoicedCompletedWork);

  const averageDaysToPayment = paymentDurations.length
    ? paymentDurations.reduce((sum, days) => sum + days, 0) / paymentDurations.length
    : null;

  const rangeJobs = withVisitFallback(
    safeData(jobsRes, []) as Array<JobDateFields & { id?: string | null; status?: string | null }>
  ).filter((job) => {
    const operationalDate = getJobOperationalDate(job);
    if (!operationalDate) return false;
    return inRange(operationalDate, start, end);
  });
  const jobsByStatus: Record<string, number> = {};
  for (const job of rangeJobs) {
    const status = (job.status as string) || 'new';
    jobsByStatus[status] = (jobsByStatus[status] || 0) + 1;
  }

  const laborRows = safeData(laborRes, []) as LaborCostRow[];
  const contractorPay = calculateContractorAccruedCost(laborRows, start, end);
  const contractorPaymentsPaid = calculateContractorCashPaid(laborRows, start, end, range);
  const unpaidContractorPay = calculateUnpaidContractorPay(laborRows);
  const pendingContractorPay = calculatePendingContractorPay(laborRows);

  // Expenses schema has amount + date only (no unpaid/pending states). date is used as cash date.
  const otherExpenses = safeData(expensesRes, []).reduce(
    (sum, row) => (inRange(row.date, start, end) ? sum + num(row.amount) : sum),
    0
  );

  const accruedCosts = contractorPay + otherExpenses;
  const estimatedProfit = calculateEstimatedProfit({
    expectedRevenue,
    contractorPay,
    otherExpenses
  });
  const cashAfterPaidCosts = calculateCashAfterPaidCosts({
    cashCollected: paidToYou,
    contractorCashPaid: contractorPaymentsPaid,
    otherCashExpenses: otherExpenses
  });
  const hasCreatedInvoices = invoices.length > 0;

  const completedRows = withVisitFallback(
    safeData(completedJobsRes, []) as Array<JobDateFields & { id?: unknown }>
  );
  const completedInRange = completedRows.filter((row) => {
    const reportingDate = getCompletedJobReportingDate(row);
    if (!reportingDate) return false;
    return range === 'all_time' || inRange(reportingDate, start, end);
  });
  const missingCompletedAt = countCompletedJobsMissingCompletedAt(completedRows);

  const customerRows = customersRes.error
    ? []
    : ((customersRes.data || []) as Array<{ record_type?: string | null; pipeline_stage?: string | null }>);
  const activeCustomerCount = customerRows.filter((row) => isActiveCustomerRecord(row)).length;

  const bookingCount = safeData(bookingsRes, []).filter((row) => inRange(row.starts_at, start, end)).length;
  const messageCount = safeData(messagesRes, []).filter((row) => inRange(row.created_at, start, end)).length;
  const reportCount = safeData(reportsRes, []).filter((row) => inRange(row.created_at, start, end)).length;

  return {
    revenueThisMonth: Number(paidToYou.toFixed(2)),
    cashCollected: Number(paidToYou.toFixed(2)),
    paidToYou: Number(paidToYou.toFixed(2)),
    customerInvoices: Number(customerInvoices.toFixed(2)),
    uninvoicedCompletedWork,
    expectedRevenue,
    // bookedRevenue now means customer invoices only (manual work is separate).
    bookedRevenue: Number(customerInvoices.toFixed(2)),
    pendingIncoming: Number(stillOwed.toFixed(2)),
    stillOwed: Number(stillOwed.toFixed(2)),
    overdueAmount: Number(late.amount.toFixed(2)),
    latePayments: Number(late.amount.toFixed(2)),
    averageDaysToPayment: averageDaysToPayment === null ? null : Number(averageDaysToPayment.toFixed(1)),
    outstandingInvoices: Number(stillOwed.toFixed(2)),
    outstandingInvoiceCount,
    overdueInvoiceCount: late.count,
    unpaidInvoiceTotal: Number(stillOwed.toFixed(2)),
    jobsCompleted: completedRows.length,
    jobsCompletedThisMonth: completedInRange.length,
    completedJobsMissingCompletedAt: missingCompletedAt.count,
    // IDs are retained for admin maintenance tooling only; dashboard never renders repair links.
    completedJobsMissingCompletedAtIds: missingCompletedAt.ids,
    activeCustomers: activeCustomerCount,
    customerCount: activeCustomerCount,
    upcomingJobs: safeCount(upcomingJobsRes),
    contractorPayThisMonth: Number(contractorPay.toFixed(2)),
    contractorPaymentsPaid: Number(contractorPaymentsPaid.toFixed(2)),
    unpaidContractorPay: Number(unpaidContractorPay.toFixed(2)),
    pendingContractorPay: Number(pendingContractorPay.toFixed(2)),
    otherExpensesThisMonth: Number(otherExpenses.toFixed(2)),
    expenseTotalThisMonth: Number(accruedCosts.toFixed(2)),
    netEstimateThisMonth: estimatedProfit,
    estimatedProfit,
    netCashFlow: cashAfterPaidCosts,
    cashAfterExpenses: cashAfterPaidCosts,
    cashAfterPaidCosts,
    moneySummaryNetCash: 0,
    hasCreatedInvoices,
    loadFailed,
    paymentsMissingDates,
    bookingCountThisMonth: bookingCount,
    messageCount,
    reportCount,
    jobsByStatus,
    totalJobs: range === 'all_time' ? (totalJobsRes.error ? rangeJobs.length : totalJobsRes.count) : rangeJobs.length
  };
}

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat(undefined, {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0
  }).format(amount);
}
