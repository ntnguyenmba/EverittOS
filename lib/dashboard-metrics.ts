import type { SupabaseClient } from '@supabase/supabase-js';
import {
  getCompletedJobReportingDate,
  getJobOperationalDate,
  isActiveCustomerRecord,
  isCompletedJobMissingCompletedAt,
  type JobDateFields
} from '@/lib/job-operational-date';
import {
  calculateScheduledExpectedFinance,
  calculateScheduledRevenue,
  isCancelledOrSkippedStatus,
  isCompletedLikeStatus
} from '@/lib/recurring-jobs';
import { effectiveContractorCost } from '@/lib/finance/contractor-cost';

const CANCELLED_JOB_STATUSES = ['cancelled', 'canceled'];
const CANCELLED_BOOKING_STATUSES = ['cancelled', 'canceled'];

export type DashboardDateRange = 'today' | 'week' | 'month' | 'quarter' | 'year' | 'last_year' | 'all_time';

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
   * Job revenue for jobs whose scheduled service date is in the selected period.
   * This is job-based and does not move when a customer pays on a different day.
   */
  expectedRevenue: number;
  /**
   * @deprecated Prefer customerInvoices for invoice totals.
   * Previously mixed invoices + manual job revenue. Now equals customerInvoices only.
   */
  bookedRevenue: number;
  /**
   * Still owed / lifetime outstanding — current unpaid balances across all open
   * collectible invoices and uninvoiced jobs (not period-filtered).
   */
  pendingIncoming: number;
  stillOwed: number;
  /**
   * Outstanding attributed to the selected dashboard period
   * (invoice/job operational date in range, remaining balance > 0).
   */
  periodOutstanding: number;
  /** Late payments — current overdue unpaid balances (lifetime/current) */
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
  /**
   * Scheduled revenue from currently generated future occurrences only.
   * Never includes unlimited lifetime series totals or completed/collected amounts.
   */
  scheduledRevenue: number;
  /** Expected contractor pay on generated active scheduled occurrences only */
  scheduledExpectedContractorExpense: number;
  /** Expected additional expenses on generated active scheduled occurrences only */
  scheduledExpectedAdditionalExpenses: number;
  /** Scheduled expected profit = scheduled revenue − expected contractor − expected additional */
  scheduledExpectedProfit: number;
  /**
   * Generated recurring occurrences attributed to the selected period
   * (active/upcoming in range; never counts the series definition itself).
   */
  recurringOccurrenceCount: number;
  /** One-time jobs attributed to the selected period (non-cancelled). */
  oneTimeJobCount: number;
  /** Active recurring schedule definitions (not job occurrences). */
  activeRecurringScheduleCount: number;
  /** Paused recurring schedule definitions. */
  pausedRecurringScheduleCount: number;
  /** Distinct customers with at least one recurring series (active or paused). */
  recurringCustomerCount: number;
  /** Completed recurring occurrences in the selected period. */
  completedRecurringOccurrenceCount: number;
  /** Cancelled/skipped recurring occurrences in the selected period. */
  cancelledRecurringOccurrenceCount: number;
  /** Contractor pay recorded/incurred in the selected period */
  contractorPayThisMonth?: number;
  /** Contractor payments actually paid in the selected period */
  contractorPaymentsPaid?: number;
  /** Unpaid contractor labor for jobs attributed to the selected period */
  periodUnpaidContractorPay?: number;
  /** All unpaid contractor labor (lifetime / current balance) */
  unpaidContractorPay?: number;
  pendingContractorPay?: number;
  /** Invoice ledger payments in the selected period (subset of Collected) */
  invoicePaymentsInPeriod?: number;
  /** Direct job payments in the selected period (subset of Collected; excludes invoiced jobs) */
  directJobPaymentsInPeriod?: number;
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
  /** Developer finance debug breakdown for the selected period */
  financeDebug?: FinanceDebugBreakdown;
};

export type FinanceDebugBreakdown = {
  range: DashboardDateRange;
  start: string | null;
  end: string | null;
  invoiceRevenue: number;
  directJobPayments: number;
  invoicePayments: number;
  collected: number;
  outstandingInvoices: number;
  periodOutstanding: number;
  lifetimeOutstanding: number;
  unbilledRevenue: number;
  contractorLaborPaid: number;
  contractorLaborUnpaidPeriod: number;
  contractorLaborUnpaidLifetime: number;
  contractorLaborAccrued: number;
  businessExpenses: number;
  expectedRevenue: number;
  expectedProfit: number;
  cashAvailable: number;
  expectedProfitFormula: string;
};

export type LaborCostRow = {
  total_cost?: unknown;
  created_at?: unknown;
  payment_status?: unknown;
  paid_at?: unknown;
  job_id?: unknown;
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
  status?: unknown;
  title?: unknown;
  customer_name?: unknown;
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
  if (range === 'today') {
    const start = formatLocalDateOnly(now);
    const endDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
    return { start, end: formatLocalDateOnly(endDate) };
  }
  if (range === 'week') {
    const day = now.getDay();
    const mondayOffset = day === 0 ? -6 : 1 - day;
    const startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() + mondayOffset);
    const endDate = new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate() + 7);
    return { start: formatLocalDateOnly(startDate), end: formatLocalDateOnly(endDate) };
  }
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

/**
 * Job rows used by the shared dashboard job-count engine.
 * Schedule definitions live in recurring_job_series — never in this set.
 */
export type JobCountRow = JobDateFields & {
  id?: unknown;
  status?: unknown;
  is_skipped?: unknown;
  recurring_series_id?: unknown;
  occurrence_date?: unknown;
  deleted_at?: unknown;
};

const EXCLUDED_COUNTABLE_JOB_STATUSES = new Set([
  'cancelled',
  'canceled',
  'draft',
  'deleted',
  'skipped'
]);

/**
 * Valid countable job = a real job record or generated visit.
 * Excludes cancelled/canceled, deleted, skipped visits, drafts, and schedule templates
 * (templates are stored in recurring_job_series, not jobs).
 */
export function isValidCountableJob(job: JobCountRow): boolean {
  const status = String(job.status || '').trim().toLowerCase();
  if (status && EXCLUDED_COUNTABLE_JOB_STATUSES.has(status)) return false;
  if (job.is_skipped === true) return false;
  if (String(job.is_skipped || '').trim().toLowerCase() === 'true') return false;
  if (job.deleted_at) return false;
  return true;
}

/** Completed jobs that are also valid countable jobs. */
export function isCompletedCountableJob(job: JobCountRow): boolean {
  if (!isValidCountableJob(job)) return false;
  return isCompletedLikeStatus(String(job.status || ''));
}

/**
 * One row per job id. Also collapses duplicate generated visits that share the
 * same recurring_series_id + occurrence_date.
 */
export function dedupeJobsForCounting<T extends JobCountRow>(jobs: T[]): T[] {
  const byId = new Map<string, T>();
  const seriesOccurrenceKeys = new Set<string>();
  for (const job of jobs) {
    const id = String(job.id || '').trim();
    if (!id || byId.has(id)) continue;
    const seriesId = String(job.recurring_series_id || '').trim();
    const occurrence = String(job.occurrence_date || '').slice(0, 10);
    if (seriesId && /^\d{4}-\d{2}-\d{2}$/.test(occurrence)) {
      const key = `${seriesId}:${occurrence}`;
      if (seriesOccurrenceKeys.has(key)) continue;
      seriesOccurrenceKeys.add(key);
    }
    byId.set(id, job);
  }
  return Array.from(byId.values());
}

/**
 * Single source of truth for dashboard / analytics / Ask Everitt / top-performer job lists.
 * Uses getJobOperationalDate + rangeBounds so a job never lands in two periods.
 * All Time counts every valid non-cancelled job once, even without an operational date.
 */
export function filterValidJobsInPeriod<T extends JobCountRow>(
  jobs: T[],
  range: DashboardDateRange,
  now = new Date()
): T[] {
  const { start, end } = rangeBounds(range, now);
  return dedupeJobsForCounting(jobs).filter((job) => {
    if (!isValidCountableJob(job)) return false;
    if (range === 'all_time') return true;
    const date = getJobOperationalDate(job);
    if (!date) return false;
    return inRange(date, start, end);
  });
}

/** Count of valid jobs attributed to the selected dashboard period. */
export function countValidJobsInPeriod(
  jobs: JobCountRow[],
  range: DashboardDateRange,
  now = new Date()
): number {
  return filterValidJobsInPeriod(jobs, range, now).length;
}

/** Completed valid jobs in the selected period (one count per job). */
export function countCompletedJobsInPeriod(
  jobs: JobCountRow[],
  range: DashboardDateRange,
  now = new Date()
): number {
  return filterValidJobsInPeriod(jobs, range, now).filter((job) =>
    isCompletedLikeStatus(String(job.status || ''))
  ).length;
}

export function buildJobsByStatusCounts(jobs: JobCountRow[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const job of jobs) {
    const status = String(job.status || 'new').trim() || 'new';
    counts[status] = (counts[status] || 0) + 1;
  }
  return counts;
}

/** Map Jobs-page period query values onto dashboard date ranges. */
export function dashboardRangeFromJobsPeriod(
  period: string | null | undefined
): DashboardDateRange {
  const value = String(period || 'all').toLowerCase();
  if (value === 'today') return 'today';
  if (value === 'week') return 'week';
  if (value === 'month') return 'month';
  if (value === 'year') return 'year';
  if (value === 'all_time' || value === 'all') return 'all_time';
  return 'all_time';
}

function statusTokens(row: { payment_status?: unknown; status?: unknown }): string[] {
  return [String(row.payment_status || '').toLowerCase(), String(row.status || '').toLowerCase()].filter(Boolean);
}

/** Invoice cancelled via payment_status or document status (either field). */
export function isCancelledInvoice(row: { payment_status?: unknown; status?: unknown }): boolean {
  return statusTokens(row).some((value) => value === 'cancelled' || value === 'canceled');
}

const NON_COLLECTIBLE_INVOICE_STATUSES = new Set([
  'cancelled',
  'canceled',
  'draft',
  'void',
  'voided',
  'deleted',
  'scheduled'
]);

/** Invoices that should never contribute to AR / expected revenue. */
export function isNonCollectibleInvoice(row: { payment_status?: unknown; status?: unknown }): boolean {
  return statusTokens(row).some((value) => NON_COLLECTIBLE_INVOICE_STATUSES.has(value));
}

export function isCollectibleInvoice(row: { payment_status?: unknown; status?: unknown }): boolean {
  return !isNonCollectibleInvoice(row);
}

/** Job ids that already have an active collectible invoice (never double count). */
export function collectibleInvoicedJobIds(invoices: InvoiceMetricRow[]): Set<string> {
  const ids = new Set<string>();
  for (const inv of invoices) {
    if (!isCollectibleInvoice(inv)) continue;
    const jobId = String(inv.job_id || '');
    if (jobId) ids.add(jobId);
  }
  return ids;
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

/** Customer invoices = collectible invoice totals in the selected period.
 * When jobDates are provided, attribute invoices to the linked job operational date
 * so creating an invoice later does not move an older job into a newer period.
 */
export function calculateCustomerInvoices(
  invoices: InvoiceMetricRow[],
  start: string | null,
  end: string | null,
  jobDates: Map<string, string> = new Map()
): number {
  return invoices.reduce((sum, inv) => {
    if (!isCollectibleInvoice(inv)) return sum;
    const jobId = String(inv.job_id || '');
    const periodDate = jobId && jobDates.has(jobId) ? jobDates.get(jobId)! : invoiceDate(inv);
    return inRange(periodDate, start, end) ? sum + num(inv.amount) : sum;
  }, 0);
}

export function buildJobOperationalDateMap(
  jobs: Array<JobDateFields & { id?: unknown }>
): Map<string, string> {
  const map = new Map<string, string>();
  for (const job of jobs) {
    const jobId = String(job.id || '');
    if (!jobId) continue;
    const date = getJobOperationalDate(job);
    if (date) map.set(jobId, date);
  }
  return map;
}

export function dashboardInvoicePeriodDate(
  invoice: InvoiceMetricRow,
  jobDates: Map<string, string>
): string {
  const jobId = String(invoice.job_id || '');
  if (jobId && jobDates.has(jobId)) return jobDates.get(jobId)!;
  return invoiceDate(invoice);
}

/** Still owed on eligible uninvoiced jobs with a positive expected amount. */
export function calculateDirectJobOutstanding(
  jobs: JobRevenueRow[],
  invoicedJobIds: Set<string>,
  collectedByJobId: Map<string, number>
): number {
  let total = 0;
  for (const job of jobs) {
    const jobId = String(job.id || '');
    if (!jobId || invoicedJobIds.has(jobId)) continue;
    const status = String(job.status || '').toLowerCase();
    if (status === 'cancelled' || status === 'canceled') continue;
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

/** Still owed = unpaid balances on collectible invoices only. */
export function calculateStillOwed(invoices: InvoiceMetricRow[]): number {
  return invoices.reduce((sum, inv) => {
    if (!isCollectibleInvoice(inv)) return sum;
    return sum + remainingBalance(inv.amount, inv.amount_paid);
  }, 0);
}

export type OutstandingBreakdownRow = {
  id: string;
  sourceType: 'invoice' | 'job';
  title: string;
  customerName: string | null;
  expectedOrInvoiced: number;
  amountPaid: number;
  amountOwed: number;
  invoiceStatus: string | null;
  dueDate: string | null;
  href: string;
};

/**
 * Single source of truth for Outstanding.
 * Dashboard card total and drill-down rows must use this helper.
 *
 * Prefer ledger payment totals when invoicePayments are provided so stale
 * invoice.amount_paid cannot inflate Outstanding.
 */
export function calculateOutstandingBreakdown(input: {
  invoices: InvoiceMetricRow[];
  jobs: JobRevenueRow[];
  jobPayments: JobPaymentMetricRow[];
  invoicePayments?: InvoicePaymentRow[];
  jobLookup?: Map<string, { title?: unknown; customer_name?: unknown }>;
}): { total: number; rows: OutstandingBreakdownRow[]; invoiceTotal: number; jobTotal: number } {
  const invoicedJobIds = collectibleInvoicedJobIds(input.invoices);
  const collectedByJob = sumJobPaymentsByJobId(input.jobPayments);
  const paidByInvoice = new Map<string, number>();
  const useLedger = Array.isArray(input.invoicePayments);
  for (const row of input.invoicePayments || []) {
    const invoiceId = String(row.invoice_id || '');
    const amount = num(row.amount);
    if (!invoiceId || amount <= 0) continue;
    paidByInvoice.set(invoiceId, Number(((paidByInvoice.get(invoiceId) || 0) + amount).toFixed(2)));
  }
  // Direct payments on jobs that later got invoices still reduce what customers owe when the
  // invoice ledger never absorbed them (prevents Money received + Customers owe overstating revenue).
  const jobsWithInvoiceSidePayments = buildJobsWithInvoiceSidePayments(
    input.invoices,
    input.invoicePayments || []
  );
  const unmigratedDirectByJob = new Map<string, number>();
  Array.from(collectedByJob.entries()).forEach(([jobId, amount]) => {
    if (!invoicedJobIds.has(jobId)) return;
    if (jobsWithInvoiceSidePayments.has(jobId)) return;
    unmigratedDirectByJob.set(jobId, amount);
  });
  const rows: OutstandingBreakdownRow[] = [];

  let invoiceTotal = 0;
  for (const inv of input.invoices) {
    if (!isCollectibleInvoice(inv)) continue;
    const invoiceId = String(inv.id || '');
    const jobId = inv.job_id ? String(inv.job_id) : '';
    const paidRaw = useLedger
      ? paidByInvoice.get(invoiceId) || 0
      : num(inv.amount_paid);
    // Credit unmigrated direct job payments once against the job's invoice balance.
    const directCredit = jobId ? unmigratedDirectByJob.get(jobId) || 0 : 0;
    if (jobId && directCredit > 0) unmigratedDirectByJob.set(jobId, 0);
    const paidTowardInvoice = Number((paidRaw + directCredit).toFixed(2));
    const owed = remainingBalance(inv.amount, paidTowardInvoice);
    if (owed <= 0) continue;
    invoiceTotal += owed;
    const paid = cappedAmountPaid(inv.amount, paidTowardInvoice);
    const job = jobId && input.jobLookup ? input.jobLookup.get(jobId) : null;
    rows.push({
      id: invoiceId,
      sourceType: 'invoice',
      title: String(job?.title || job?.customer_name || 'Invoice'),
      customerName: job?.customer_name ? String(job.customer_name) : null,
      expectedOrInvoiced: Number(num(inv.amount).toFixed(2)),
      amountPaid: Number(paid.toFixed(2)),
      amountOwed: Number(owed.toFixed(2)),
      invoiceStatus: String(inv.payment_status || inv.status || 'unpaid'),
      dueDate: inv.due_date ? String(inv.due_date).slice(0, 10) : null,
      href: jobId ? `/jobs/${jobId}` : `/invoices?focus=${encodeURIComponent(invoiceId)}`
    });
  }

  let jobTotal = 0;
  for (const job of input.jobs) {
    const jobId = String(job.id || '');
    if (!jobId || invoicedJobIds.has(jobId)) continue;
    const status = String(job.status || '').toLowerCase();
    if (status === 'cancelled' || status === 'canceled') continue;
    const expected = num(job.revenue_amount);
    if (expected <= 0) continue;
    const paid = collectedByJob.get(jobId) || 0;
    const owed = Math.max(0, Number((expected - paid).toFixed(2)));
    if (owed <= 0) continue;
    jobTotal += owed;
    rows.push({
      id: jobId,
      sourceType: 'job',
      title: String(job.title || job.customer_name || 'Job'),
      customerName: job.customer_name ? String(job.customer_name) : null,
      expectedOrInvoiced: Number(expected.toFixed(2)),
      amountPaid: Number(paid.toFixed(2)),
      amountOwed: Number(owed.toFixed(2)),
      invoiceStatus: null,
      dueDate: null,
      href: `/jobs/${jobId}`
    });
  }

  invoiceTotal = Number(invoiceTotal.toFixed(2));
  jobTotal = Number(jobTotal.toFixed(2));
  return {
    total: Number((invoiceTotal + jobTotal).toFixed(2)),
    rows,
    invoiceTotal,
    jobTotal
  };
}

/**
 * Outstanding balances for work attributed to the selected period only.
 * Uses the linked job operational date when present, otherwise the invoice date.
 */
export function calculatePeriodOutstanding(input: {
  invoices: InvoiceMetricRow[];
  jobs: JobRevenueRow[];
  jobPayments: JobPaymentMetricRow[];
  invoicePayments?: InvoicePaymentRow[];
  start: string | null;
  end: string | null;
  jobDates?: Map<string, string>;
}): { total: number; invoiceTotal: number; jobTotal: number } {
  const { start, end } = input;
  const jobDates = input.jobDates || new Map<string, string>();
  const breakdown = calculateOutstandingBreakdown(input);

  // All-time period uses the full current outstanding balance.
  if (start === null && end === null) {
    return {
      total: breakdown.total,
      invoiceTotal: breakdown.invoiceTotal,
      jobTotal: breakdown.jobTotal
    };
  }

  let invoiceTotal = 0;
  let jobTotal = 0;
  for (const row of breakdown.rows) {
    if (row.sourceType === 'invoice') {
      const inv = input.invoices.find((item) => String(item.id || '') === row.id);
      if (!inv) continue;
      const jobId = inv.job_id ? String(inv.job_id) : '';
      const attributed = (jobId && jobDates.get(jobId)) || invoiceDate(inv);
      if (!inRange(attributed, start, end)) continue;
      invoiceTotal += row.amountOwed;
      continue;
    }
    const job = input.jobs.find((item) => String(item.id || '') === row.id);
    if (!job) continue;
    const attributed = jobDates.get(row.id) || getJobOperationalDate(job as JobDateFields);
    if (!inRange(attributed, start, end)) continue;
    jobTotal += row.amountOwed;
  }

  invoiceTotal = Number(invoiceTotal.toFixed(2));
  jobTotal = Number(jobTotal.toFixed(2));
  return {
    total: Number((invoiceTotal + jobTotal).toFixed(2)),
    invoiceTotal,
    jobTotal
  };
}

/** Late payments = current overdue unpaid balances on collectible invoices. */
export function calculateLatePayments(invoices: InvoiceMetricRow[], today = todayIso()): {
  amount: number;
  count: number;
} {
  let amount = 0;
  let count = 0;
  for (const inv of invoices) {
    if (!isCollectibleInvoice(inv)) continue;
    const balance = remainingBalance(inv.amount, inv.amount_paid);
    if (balance <= 0) continue;
    const due = inv.due_date ? String(inv.due_date).slice(0, 10) : '';
    const documentStatus = String(inv.status || '').toLowerCase();
    const isOverdue =
      documentStatus === 'overdue' || (Boolean(due) && due < today && balance > 0);
    if (isOverdue) {
      amount += balance;
      count += 1;
    }
  }
  return { amount, count };
}

export function countUnpaidInvoices(invoices: InvoiceMetricRow[]): number {
  return invoices.reduce((count, inv) => {
    if (!isCollectibleInvoice(inv)) return count;
    return remainingBalance(inv.amount, inv.amount_paid) > 0 ? count + 1 : count;
  }, 0);
}

/**
 * Jobs whose collectible invoices already have payment coverage on the invoice side
 * (ledger rows or legacy amount_paid). Used to avoid double counting the same cash
 * when a legacy job_payments row still exists after invoicing.
 */
export function buildJobsWithInvoiceSidePayments(
  invoices: InvoiceMetricRow[],
  paymentRows: InvoicePaymentRow[]
): Set<string> {
  const invoicesWithLedger = new Set<string>();
  for (const row of paymentRows) {
    const invoiceId = String(row.invoice_id || '');
    if (!invoiceId || num(row.amount) <= 0) continue;
    invoicesWithLedger.add(invoiceId);
  }

  const jobIds = new Set<string>();
  for (const inv of invoices) {
    if (!isCollectibleInvoice(inv)) continue;
    const invoiceId = String(inv.id || '');
    const jobId = String(inv.job_id || '');
    if (!jobId) continue;
    if (invoiceId && invoicesWithLedger.has(invoiceId)) {
      jobIds.add(jobId);
      continue;
    }
    if (cappedAmountPaid(inv.amount, inv.amount_paid) > 0) {
      jobIds.add(jobId);
    }
  }
  return jobIds;
}

/**
 * Direct job payments always count unless the job's invoice side already recorded
 * the same cash. Creating an invoice later must never erase an earlier direct payment.
 */
export function shouldIncludeDirectJobPayment(
  jobId: string,
  invoicedJobIds: Set<string>,
  jobsWithInvoiceSidePayments: Set<string>
): boolean {
  if (!jobId) return true;
  if (!invoicedJobIds.has(jobId)) return true;
  return !jobsWithInvoiceSidePayments.has(jobId);
}

/**
 * Money received from payment ledger rows whose paid_at falls in range.
 * Includes invoice payment ledger + direct job payment ledger.
 * Never counts the same payment twice.
 * Never loses a direct payment because a job later received an invoice.
 * Falls back to invoice summary fields when no ledger rows exist for an invoice.
 */
export function calculatePaidToYou(input: {
  invoices: InvoiceMetricRow[];
  paymentRows: InvoicePaymentRow[];
  jobPaymentRows?: JobPaymentMetricRow[];
  start: string | null;
  end: string | null;
  range: DashboardDateRange;
}): {
  paidToYou: number;
  invoicePayments: number;
  directJobPayments: number;
  paymentsMissingDates: number;
} {
  const { invoices, paymentRows, jobPaymentRows = [], start, end, range } = input;
  const nonCollectibleInvoiceIds = new Set(
    invoices.filter((inv) => !isCollectibleInvoice(inv)).map((inv) => String(inv.id || '')).filter(Boolean)
  );
  const activeInvoiceIds = new Set(
    invoices.filter((inv) => isCollectibleInvoice(inv)).map((inv) => String(inv.id || '')).filter(Boolean)
  );

  let invoicePayments = 0;
  const invoicesWithLedger = new Set<string>();

  for (const row of paymentRows) {
    const invoiceId = String(row.invoice_id || '');
    if (invoiceId && nonCollectibleInvoiceIds.has(invoiceId)) continue;
    if (invoiceId && activeInvoiceIds.size > 0 && !activeInvoiceIds.has(invoiceId)) {
      // Payment belongs to an invoice outside this org/result set.
      continue;
    }
    if (invoiceId) invoicesWithLedger.add(invoiceId);
    if (range === 'all_time') {
      invoicePayments += num(row.amount);
      continue;
    }
    if (inRange(row.paid_at, start, end)) {
      invoicePayments += num(row.amount);
    }
  }

  let paymentsMissingDates = 0;

  // Legacy fallback for invoices that have amount_paid but no ledger payment rows.
  for (const inv of invoices) {
    if (!isCollectibleInvoice(inv)) continue;
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
        invoicePayments += paid;
      } else if (inRange(invoiceDate(inv), start, end)) {
        invoicePayments += paid;
      }
      continue;
    }

    if (range === 'all_time' || inRange(paidDate, start, end)) {
      invoicePayments += paid;
    }
  }

  // Direct job payments: always include unless the invoice side already captured that cash.
  let directJobPayments = 0;
  const invoicedJobIds = collectibleInvoicedJobIds(invoices);
  const jobsWithInvoiceSidePayments = buildJobsWithInvoiceSidePayments(invoices, paymentRows);
  for (const row of jobPaymentRows) {
    const jobId = String(row.job_id || '');
    if (!shouldIncludeDirectJobPayment(jobId, invoicedJobIds, jobsWithInvoiceSidePayments)) continue;
    if (range === 'all_time') {
      directJobPayments += num(row.amount);
      continue;
    }
    if (inRange(row.paid_at, start, end)) {
      directJobPayments += num(row.amount);
    }
  }

  const paidToYou = Number((invoicePayments + directJobPayments).toFixed(2));
  return {
    paidToYou,
    invoicePayments: Number(invoicePayments.toFixed(2)),
    directJobPayments: Number(directJobPayments.toFixed(2)),
    paymentsMissingDates
  };
}

/**
 * Accrued contractor labor for jobs in the selected period.
 * Prefer the job operational date over the labor row created_at.
 * Legacy labor rows without a job (or without a usable job date) fall back to created_at.
 */
export function calculateContractorAccruedCost(
  laborRows: LaborCostRow[],
  start: string | null,
  end: string | null,
  jobDates: Map<string, string> = new Map()
): number {
  return Number(
    laborRows
      .reduce((sum, row) => {
        const jobId = String(row.job_id || '');
        if (jobId) {
          const jobDate = jobDates.get(jobId);
          if (!jobDate) {
            // Job exists but has no operational date — exclude from bounded periods.
            return start === null && end === null ? sum + num(row.total_cost) : sum;
          }
          return inRange(jobDate, start, end) ? sum + num(row.total_cost) : sum;
        }
        // Legacy labor rows without a job use created_at as the only available period fallback.
        return inRange(row.created_at, start, end) ? sum + num(row.total_cost) : sum;
      }, 0)
      .toFixed(2)
  );
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

/** Lifetime / current unpaid contractor labor (not period-filtered). */
export function calculateUnpaidContractorPay(laborRows: LaborCostRow[]): number {
  return laborRows.reduce((sum, row) => {
    const status = String(row.payment_status || 'unpaid').toLowerCase();
    return status === 'unpaid' ? sum + num(row.total_cost) : sum;
  }, 0);
}

/**
 * Unpaid contractor labor for jobs attributed to the selected period.
 * Same date attribution rules as accrued contractor cost.
 */
export function calculatePeriodUnpaidContractorPay(
  laborRows: LaborCostRow[],
  start: string | null,
  end: string | null,
  jobDates: Map<string, string> = new Map()
): number {
  return Number(
    laborRows
      .reduce((sum, row) => {
        const status = String(row.payment_status || 'unpaid').toLowerCase();
        if (status !== 'unpaid') return sum;
        const jobId = String(row.job_id || '');
        if (jobId) {
          const jobDate = jobDates.get(jobId);
          if (!jobDate) {
            return start === null && end === null ? sum + num(row.total_cost) : sum;
          }
          return inRange(jobDate, start, end) ? sum + num(row.total_cost) : sum;
        }
        return inRange(row.created_at, start, end) ? sum + num(row.total_cost) : sum;
      }, 0)
      .toFixed(2)
  );
}

export const JOB_REVENUE_FORMULA = 'Job revenue = Money received + Customers owe';
export const EXPECTED_PROFIT_FORMULA =
  'Profit = Job revenue − Contractor costs − Business expenses';
export const MONEY_KEPT_FORMULA =
  'Money kept = Money received − Paid contractors − Business expenses';

export function buildFinanceDebugBreakdown(input: {
  range: DashboardDateRange;
  start: string | null;
  end: string | null;
  invoiceRevenue: number;
  invoicePayments: number;
  directJobPayments: number;
  periodOutstanding: number;
  lifetimeOutstanding: number;
  unbilledRevenue: number;
  contractorLaborPaid: number;
  contractorLaborUnpaidPeriod: number;
  contractorLaborUnpaidLifetime: number;
  contractorLaborAccrued: number;
  businessExpenses: number;
  expectedRevenue: number;
  expectedProfit: number;
  cashAvailable: number;
}): FinanceDebugBreakdown {
  const collected = Number((num(input.invoicePayments) + num(input.directJobPayments)).toFixed(2));
  const customersOwe =
    input.range === 'all_time'
      ? Number(num(input.lifetimeOutstanding).toFixed(2))
      : Number(num(input.periodOutstanding).toFixed(2));
  const expectedRevenue = calculateJobRevenue(collected, customersOwe);
  const expectedProfit = calculateEstimatedProfit({
    expectedRevenue,
    contractorPay: input.contractorLaborAccrued,
    otherExpenses: input.businessExpenses
  });
  const cashAvailable = calculateMoneyKept({
    moneyReceived: collected,
    paidContractors: input.contractorLaborPaid,
    businessExpenses: input.businessExpenses
  });
  return {
    range: input.range,
    start: input.start,
    end: input.end,
    invoiceRevenue: Number(num(input.invoiceRevenue).toFixed(2)),
    directJobPayments: Number(num(input.directJobPayments).toFixed(2)),
    invoicePayments: Number(num(input.invoicePayments).toFixed(2)),
    collected,
    outstandingInvoices: Number(num(input.periodOutstanding).toFixed(2)),
    periodOutstanding: Number(num(input.periodOutstanding).toFixed(2)),
    lifetimeOutstanding: Number(num(input.lifetimeOutstanding).toFixed(2)),
    unbilledRevenue: Number(num(input.unbilledRevenue).toFixed(2)),
    contractorLaborPaid: Number(num(input.contractorLaborPaid).toFixed(2)),
    contractorLaborUnpaidPeriod: Number(num(input.contractorLaborUnpaidPeriod).toFixed(2)),
    contractorLaborUnpaidLifetime: Number(num(input.contractorLaborUnpaidLifetime).toFixed(2)),
    contractorLaborAccrued: Number(num(input.contractorLaborAccrued).toFixed(2)),
    businessExpenses: Number(num(input.businessExpenses).toFixed(2)),
    expectedRevenue,
    expectedProfit,
    cashAvailable,
    expectedProfitFormula: EXPECTED_PROFIT_FORMULA
  };
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

export type DashboardJobFinanceRow = JobCountRow & {
  revenue_amount?: unknown;
  expected_contractor_cost?: unknown;
  expected_additional_expense?: unknown;
};

/** Job revenue attributed only by each job's operational service date. */
export function calculateJobRevenueFromJobs(jobs: DashboardJobFinanceRow[]): number {
  return Number(
    jobs
      .reduce((sum, job) => sum + Math.max(0, num(job.revenue_amount)), 0)
      .toFixed(2)
  );
}

/**
 * Match the cost shown on job cards: use recorded labor when present,
 * otherwise use the job's planned contractor cost.
 */
export function calculateEffectiveContractorCostForJobs(
  jobs: DashboardJobFinanceRow[],
  laborRows: LaborCostRow[]
): number {
  const laborByJobId = new Map<string, number>();
  for (const row of laborRows) {
    const jobId = String(row.job_id || '').trim();
    if (!jobId) continue;
    laborByJobId.set(jobId, (laborByJobId.get(jobId) || 0) + num(row.total_cost));
  }

  return Number(
    jobs
      .reduce((sum, job) => {
        const jobId = String(job.id || '').trim();
        const recordedLabor = jobId ? laborByJobId.get(jobId) || 0 : 0;
        return sum + effectiveContractorCost(num(job.expected_contractor_cost), recordedLabor);
      }, 0)
      .toFixed(2)
  );
}

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

/**
 * Customers owe for the selected dashboard filter.
 * All-time uses current open balances; bounded periods use period-attributed outstanding.
 */
export function customersOweForRange(
  range: DashboardDateRange,
  stillOwed: number,
  periodOutstanding: number
): number {
  return Number((range === 'all_time' ? num(stillOwed) : num(periodOutstanding)).toFixed(2));
}

/**
 * Job revenue = Money received + Customers owe.
 * Single source of truth for the revenue card — always reconciles with those two cards.
 */
export function calculateJobRevenue(moneyReceived: number, customersOwe: number): number {
  return Number((num(moneyReceived) + num(customersOwe)).toFixed(2));
}

/** Field-name alias of calculateJobRevenue (DashboardRevenueMetrics.expectedRevenue). */
export const calculateExpectedRevenue = calculateJobRevenue;

/**
 * Profit = Job revenue − Contractor costs − Business expenses.
 * Nothing else.
 */
export function calculateEstimatedProfit(input: {
  expectedRevenue?: number;
  moneyReceived?: number;
  customersOwe?: number;
  contractorPay: number;
  otherExpenses: number;
}): number {
  const expected =
    input.expectedRevenue !== undefined
      ? num(input.expectedRevenue)
      : calculateJobRevenue(num(input.moneyReceived), num(input.customersOwe));
  return Number((expected - num(input.contractorPay) - num(input.otherExpenses)).toFixed(2));
}

/**
 * Money kept = Money received − Paid contractors − Business expenses.
 * Nothing else.
 */
export function calculateMoneyKept(input: {
  moneyReceived: number;
  paidContractors: number;
  businessExpenses: number;
}): number {
  return Number(
    (num(input.moneyReceived) - num(input.paidContractors) - num(input.businessExpenses)).toFixed(2)
  );
}

/** Cash after paid costs — same formula as Money kept. */
export function calculateNetCashFlow(input: {
  cashCollected: number;
  contractorCashPaid: number;
  otherCashExpenses: number;
}): number {
  return calculateMoneyKept({
    moneyReceived: input.cashCollected,
    paidContractors: input.contractorCashPaid,
    businessExpenses: input.otherCashExpenses
  });
}

export const calculateCashAfterExpenses = calculateNetCashFlow;
export const calculateCashAfterPaidCosts = calculateNetCashFlow;

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

/** Primary dashboard cards — one accurate set of money metrics from the shared finance engine. */
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
      label: 'Job revenue',
      help: 'Total customer pay for jobs scheduled in the selected period.'
    },
    collected: {
      label: 'Money received',
      help: 'Customer payments actually received in this period from the invoice payment ledger and direct job payment ledger. The same payment is never counted twice.'
    },
    outstanding: {
      label: 'Customers owe',
      help: 'Remaining unpaid invoice balances plus unpaid direct jobs without invoices. Paid invoices and cancelled jobs are never included.'
    },
    contractorCost: {
      label: 'Contractor costs',
      help: 'Total labor cost for jobs in the selected period, paid or unpaid. Labor is never counted twice.'
    },
    expectedProfit: {
      label: 'Profit',
      help: 'Job revenue minus contractor costs minus business expenses.'
    },
    cashAfterPaidCosts: {
      label: 'Money kept',
      help: 'Money received minus paid contractors minus business expenses.'
    }
  };

  return (Object.keys(defaults) as PrimaryDashboardMetricKey[]).map((key) => ({
    key,
    label: input.labels?.[key] || defaults[key].label,
    value: Number(num(input[key]).toFixed(2)),
    help: input.helps?.[key] || defaults[key].help
  }));
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
 * Dashboard ledger reconciliation:
 * Money received + Customers owe = Job revenue (within rounding).
 */
export function reconcileDashboardLedger(input: {
  moneyReceived: number;
  customersOwe: number;
  jobRevenue: number;
  tolerance?: number;
}): { ok: boolean; difference: number } {
  const difference = Number(
    (num(input.jobRevenue) - num(input.moneyReceived) - num(input.customersOwe)).toFixed(2)
  );
  const tolerance = input.tolerance ?? 0.02;
  return { ok: Math.abs(difference) <= tolerance, difference };
}

/**
 * All-time invoice identity check (invoices only, not the job-revenue card):
 * customer invoices ≈ paid to you (invoice side) + invoice still owed.
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
    periodOutstanding: 0,
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
    scheduledRevenue: 0,
    scheduledExpectedContractorExpense: 0,
    scheduledExpectedAdditionalExpenses: 0,
    scheduledExpectedProfit: 0,
    recurringOccurrenceCount: 0,
    oneTimeJobCount: 0,
    activeRecurringScheduleCount: 0,
    pausedRecurringScheduleCount: 0,
    recurringCustomerCount: 0,
    completedRecurringOccurrenceCount: 0,
    cancelledRecurringOccurrenceCount: 0,
    contractorPayThisMonth: 0,
    contractorPaymentsPaid: 0,
    periodUnpaidContractorPay: 0,
    unpaidContractorPay: 0,
    pendingContractorPay: 0,
    invoicePaymentsInPeriod: 0,
    directJobPaymentsInPeriod: 0,
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
      .select(
        'id, title, customer_name, revenue_amount, created_at, start_date, scheduled_start, completed_at, status, due_date'
      )
      .eq('organization_id', organizationId)
      .not('revenue_amount', 'is', null),
    supabase
      .from('job_labor')
      .select('job_id, total_cost, created_at, payment_status, paid_at')
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
      .select(
        'id, status, created_at, start_date, scheduled_start, completed_at, due_date, is_skipped, recurring_series_id, occurrence_date, revenue_amount, expected_contractor_cost, expected_additional_expense'
      )
      .eq('organization_id', organizationId),
    // Expenses have only amount + date (no payment_status). Treat date as cash-expense date.
    supabase.from('expenses').select('amount, date').eq('organization_id', organizationId),
    supabase
      .from('bookings')
      .select('id, starts_at')
      .eq('organization_id', organizationId)
      .not('status', 'in', `(${CANCELLED_BOOKING_STATUSES.join(',')})`),
    supabase.from('customer_messages').select('id, created_at').eq('organization_id', organizationId),
    supabase.from('job_reports').select('id, created_at').eq('organization_id', organizationId),
    supabase.from('job_visits').select('job_id, visit_date').eq('organization_id', organizationId)
  ]);

  const safeCount = (res: { count: number | null; error: unknown }) => (res.error ? 0 : res.count || 0);
  const safeData = <T,>(res: { data: T | null; error: unknown }, fallback: T): T =>
    res.error ? fallback : res.data || fallback;

  // Optional recurring columns may be missing before migrations — retry without them.
  let jobsForCountingRes: {
    data: Array<JobDateFields & JobCountRow> | null;
    error: unknown;
  } = jobsRes;
  if (jobsRes.error && /column|schema cache|does not exist/i.test(String((jobsRes.error as { message?: string }).message || ''))) {
    jobsForCountingRes = await supabase
      .from('jobs')
      .select(
        'id, status, created_at, start_date, scheduled_start, completed_at, due_date, revenue_amount, expected_contractor_cost, expected_additional_expense'
      )
      .eq('organization_id', organizationId);
  }

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
    invoicesRes.error ||
      expensesRes.error ||
      manualRevenueJobsRes.error ||
      laborRes.error ||
      jobsForCountingRes.error
  );

  const revenueJobs = withVisitFallback(safeData(manualRevenueJobsRes, []) as JobRevenueRow[]);
  const rangeJobsSource = withVisitFallback(
    safeData(jobsForCountingRes, []) as Array<JobDateFields & DashboardJobFinanceRow>
  );
  // Job operational dates for period attribution (invoices + contractor labor).
  const jobDates = buildJobOperationalDateMap([
    ...rangeJobsSource,
    ...(revenueJobs as Array<JobDateFields & { id?: unknown }>)
  ]);

  const invoicedJobIds = collectibleInvoicedJobIds(invoices);
  const outstandingBreakdown = calculateOutstandingBreakdown({
    invoices,
    jobs: revenueJobs,
    jobPayments: jobPaymentRows,
    invoicePayments: paymentRows
  });
  const periodOutstandingBreakdown = calculatePeriodOutstanding({
    invoices,
    jobs: revenueJobs,
    jobPayments: jobPaymentRows,
    invoicePayments: paymentRows,
    start,
    end,
    jobDates
  });

  // Job-based invoice totals: use linked job operational date when available.
  const customerInvoices = calculateCustomerInvoices(invoices, start, end, jobDates);
  const { paidToYou, invoicePayments, directJobPayments, paymentsMissingDates } = calculatePaidToYou({
    invoices,
    paymentRows,
    jobPaymentRows,
    start,
    end,
    range
  });
  const stillOwed = outstandingBreakdown.total;
  const periodOutstanding = periodOutstandingBreakdown.total;
  const late = calculateLatePayments(invoices, today);
  const outstandingInvoiceCount = countUnpaidInvoices(invoices);

  const paymentDurations: number[] = [];
  for (const inv of invoices) {
    if (!isCollectibleInvoice(inv)) continue;
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

  const uninvoicedCompletedWork = Number(
    calculateUninvoicedExpectedRevenue(revenueJobs as JobExpectedRevenueRow[], invoicedJobIds, start, end).toFixed(2)
  );

  const averageDaysToPayment = paymentDurations.length
    ? paymentDurations.reduce((sum, days) => sum + days, 0) / paymentDurations.length
    : null;

  // One period job set drives job count, revenue, contractor cost, and profit.
  const rangeJobs = filterValidJobsInPeriod(
    rangeJobsSource as DashboardJobFinanceRow[],
    range
  );
  const jobsByStatus = buildJobsByStatusCounts(rangeJobs);
  const totalJobsInPeriod = rangeJobs.length;
  const expectedRevenue = calculateJobRevenueFromJobs(rangeJobs);

  const laborRows = safeData(laborRes, []) as LaborCostRow[];
  const contractorPay = calculateEffectiveContractorCostForJobs(rangeJobs, laborRows);
  const contractorPaymentsPaid = calculateContractorCashPaid(laborRows, start, end, range);
  const periodUnpaidContractorPay = calculatePeriodUnpaidContractorPay(laborRows, start, end, jobDates);
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
  const cashAfterPaidCosts = calculateMoneyKept({
    moneyReceived: paidToYou,
    paidContractors: contractorPaymentsPaid,
    businessExpenses: otherExpenses
  });
  const financeDebug = buildFinanceDebugBreakdown({
    range,
    start,
    end,
    invoiceRevenue: customerInvoices,
    invoicePayments,
    directJobPayments,
    periodOutstanding,
    lifetimeOutstanding: stillOwed,
    unbilledRevenue: uninvoicedCompletedWork,
    contractorLaborPaid: contractorPaymentsPaid,
    contractorLaborUnpaidPeriod: periodUnpaidContractorPay,
    contractorLaborUnpaidLifetime: unpaidContractorPay,
    contractorLaborAccrued: contractorPay,
    businessExpenses: otherExpenses,
    expectedRevenue,
    expectedProfit: estimatedProfit,
    cashAvailable: cashAfterPaidCosts
  });
  const hasCreatedInvoices = invoices.length > 0;

  const completedRows = withVisitFallback(
    safeData(completedJobsRes, []) as Array<JobDateFields & { id?: unknown }>
  );
  // Prefer the full org job set so completed counts use the same validity/dedupe rules.
  const completedInRangeCount = countCompletedJobsInPeriod(rangeJobsSource as JobCountRow[], range);
  const missingCompletedAt = countCompletedJobsMissingCompletedAt(completedRows);

  const customerRows = customersRes.error
    ? []
    : ((customersRes.data || []) as Array<{ record_type?: string | null; pipeline_stage?: string | null }>);
  const activeCustomerCount = customerRows.filter((row) => isActiveCustomerRecord(row)).length;

  const bookingCount = safeData(bookingsRes, []).filter((row) => inRange(row.starts_at, start, end)).length;
  const messageCount = safeData(messagesRes, []).filter((row) => inRange(row.created_at, start, end)).length;
  const reportCount = safeData(reportsRes, []).filter((row) => inRange(row.created_at, start, end)).length;

  // Optional recurring columns: query separately so missing migrations do not break metrics.
  let recurringJobsRes: {
    data: Array<Record<string, unknown>> | null;
    error: { message?: string } | null;
  } = await supabase
    .from('jobs')
    .select(
      'id, status, revenue_amount, expected_contractor_cost, expected_additional_expense, recurring_series_id, occurrence_date, is_skipped, scheduled_start, start_date'
    )
    .eq('organization_id', organizationId)
    .not('status', 'in', '(cancelled,canceled)');

  if (recurringJobsRes.error && /column|schema cache|does not exist/i.test(recurringJobsRes.error.message || '')) {
    recurringJobsRes = await supabase
      .from('jobs')
      .select('id, status, revenue_amount, recurring_series_id, occurrence_date, is_skipped, scheduled_start, start_date')
      .eq('organization_id', organizationId)
      .not('status', 'in', '(cancelled,canceled)');
  }

  const scheduleRows = recurringJobsRes.error
    ? (safeData(jobsRes, []) as Array<{
        id?: string | null;
        status?: string | null;
        revenue_amount?: unknown;
        scheduled_start?: string | null;
        start_date?: string | null;
      }>).map((row) => ({
        ...row,
        recurring_series_id: null,
        occurrence_date: String(row.scheduled_start || row.start_date || '').slice(0, 10) || null,
        is_skipped: false,
        expected_contractor_cost: null,
        expected_additional_expense: null
      }))
    : ((recurringJobsRes.data || []) as Array<{
        id?: string | null;
        status?: string | null;
        revenue_amount?: unknown;
        expected_contractor_cost?: unknown;
        expected_additional_expense?: unknown;
        recurring_series_id?: string | null;
        occurrence_date?: string | null;
        is_skipped?: boolean | null;
        scheduled_start?: string | null;
        start_date?: string | null;
      }>);

  // Jobs that already have labor records should not also contribute expected contractor
  // cost to scheduled forecasts (prevents $200 expected + $200 labor = $400).
  const jobIdsWithLabor = new Set(
    (safeData(laborRes, []) as Array<{ job_id?: string | null; total_cost?: unknown }>)
      .filter((row) => Number(row.total_cost || 0) > 0 && row.job_id)
      .map((row) => String(row.job_id))
  );

  const occurrenceFinanceRows = scheduleRows.map((row) => {
    const jobId = String((row as { id?: string | null }).id || '');
    const hasLabor = Boolean(jobId && jobIdsWithLabor.has(jobId));
    return {
      price: Number((row as { revenue_amount?: unknown }).revenue_amount || 0),
      expected_contractor_cost: hasLabor
        ? 0
        : Number((row as { expected_contractor_cost?: unknown }).expected_contractor_cost || 0),
      expected_additional_expense: Number(
        (row as { expected_additional_expense?: unknown }).expected_additional_expense || 0
      ),
      status: row.status,
      is_skipped: Boolean((row as { is_skipped?: boolean | null }).is_skipped),
      occurrence_date:
        (row as { occurrence_date?: string | null }).occurrence_date ||
        String(row.scheduled_start || row.start_date || '').slice(0, 10) ||
        null
    };
  });

  const scheduledFinance = calculateScheduledExpectedFinance(occurrenceFinanceRows, today, {
    periodStart: start,
    periodEnd: end
  });
  const scheduledRevenue = scheduledFinance.scheduledRevenue;

  const occurrenceDateFor = (row: (typeof scheduleRows)[number]) =>
    (row as { occurrence_date?: string | null }).occurrence_date ||
    String(row.scheduled_start || row.start_date || '').slice(0, 10) ||
    null;

  const inPeriodOccurrence = (row: (typeof scheduleRows)[number]) => {
    const date = occurrenceDateFor(row);
    if (!date) return false;
    return range === 'all_time' || inRange(date, start, end);
  };

  // Count generated occurrences in the selected period — never the series definition row.
  const recurringOccurrenceCount = scheduleRows.filter(
    (row) =>
      (row as { recurring_series_id?: string | null }).recurring_series_id &&
      !isCancelledOrSkippedStatus(row.status, (row as { is_skipped?: boolean | null }).is_skipped) &&
      !isCompletedLikeStatus(row.status) &&
      inPeriodOccurrence(row)
  ).length;
  const oneTimeJobCount = scheduleRows.filter(
    (row) =>
      !(row as { recurring_series_id?: string | null }).recurring_series_id &&
      !isCancelledOrSkippedStatus(row.status, (row as { is_skipped?: boolean | null }).is_skipped) &&
      inPeriodOccurrence(row)
  ).length;
  const completedRecurringOccurrenceCount = scheduleRows.filter(
    (row) =>
      (row as { recurring_series_id?: string | null }).recurring_series_id &&
      isCompletedLikeStatus(row.status) &&
      inPeriodOccurrence(row)
  ).length;
  let cancelledRecurringOccurrenceCount = 0;
  const cancelledRecurringRes = await supabase
    .from('jobs')
    .select('id, occurrence_date, scheduled_start, start_date, is_skipped, status')
    .eq('organization_id', organizationId)
    .not('recurring_series_id', 'is', null)
    .or('status.in.(cancelled,canceled),is_skipped.eq.true');
  if (!cancelledRecurringRes.error) {
    cancelledRecurringOccurrenceCount = ((cancelledRecurringRes.data || []) as Array<{
      occurrence_date?: string | null;
      scheduled_start?: string | null;
      start_date?: string | null;
      is_skipped?: boolean | null;
      status?: string | null;
    }>).filter((row) => {
      const date =
        row.occurrence_date || String(row.scheduled_start || row.start_date || '').slice(0, 10) || null;
      if (!date) return false;
      return range === 'all_time' || inRange(date, start, end);
    }).length;
  }

  let activeRecurringScheduleCount = 0;
  let pausedRecurringScheduleCount = 0;
  let recurringCustomerCount = 0;
  const seriesRes = await supabase
    .from('recurring_job_series')
    .select('id, status, customer_id')
    .eq('organization_id', organizationId)
    .in('status', ['active', 'paused']);
  if (!seriesRes.error) {
    const seriesRows = (seriesRes.data || []) as Array<{
      id?: string;
      status?: string | null;
      customer_id?: string | null;
    }>;
    activeRecurringScheduleCount = seriesRows.filter((row) => row.status === 'active').length;
    pausedRecurringScheduleCount = seriesRows.filter((row) => row.status === 'paused').length;
    recurringCustomerCount = new Set(
      seriesRows.map((row) => String(row.customer_id || '').trim()).filter(Boolean)
    ).size;
  }

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
    periodOutstanding: Number(periodOutstanding.toFixed(2)),
    overdueAmount: Number(late.amount.toFixed(2)),
    latePayments: Number(late.amount.toFixed(2)),
    averageDaysToPayment: averageDaysToPayment === null ? null : Number(averageDaysToPayment.toFixed(1)),
    outstandingInvoices: Number(stillOwed.toFixed(2)),
    outstandingInvoiceCount,
    overdueInvoiceCount: late.count,
    unpaidInvoiceTotal: Number(stillOwed.toFixed(2)),
    jobsCompleted: countCompletedJobsInPeriod(rangeJobsSource as JobCountRow[], 'all_time'),
    jobsCompletedThisMonth: completedInRangeCount,
    completedJobsMissingCompletedAt: missingCompletedAt.count,
    // IDs are retained for admin maintenance tooling only; dashboard never renders repair links.
    completedJobsMissingCompletedAtIds: missingCompletedAt.ids,
    activeCustomers: activeCustomerCount,
    customerCount: activeCustomerCount,
    upcomingJobs: safeCount(upcomingJobsRes),
    scheduledRevenue: Number(scheduledRevenue.toFixed(2)),
    scheduledExpectedContractorExpense: Number(scheduledFinance.expectedContractorExpense.toFixed(2)),
    scheduledExpectedAdditionalExpenses: Number(scheduledFinance.expectedAdditionalExpenses.toFixed(2)),
    scheduledExpectedProfit: Number(scheduledFinance.expectedProfit.toFixed(2)),
    recurringOccurrenceCount,
    oneTimeJobCount,
    activeRecurringScheduleCount,
    pausedRecurringScheduleCount,
    recurringCustomerCount,
    completedRecurringOccurrenceCount,
    cancelledRecurringOccurrenceCount,
    contractorPayThisMonth: Number(contractorPay.toFixed(2)),
    contractorPaymentsPaid: Number(contractorPaymentsPaid.toFixed(2)),
    periodUnpaidContractorPay: Number(periodUnpaidContractorPay.toFixed(2)),
    unpaidContractorPay: Number(unpaidContractorPay.toFixed(2)),
    pendingContractorPay: Number(pendingContractorPay.toFixed(2)),
    invoicePaymentsInPeriod: Number(invoicePayments.toFixed(2)),
    directJobPaymentsInPeriod: Number(directJobPayments.toFixed(2)),
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
    totalJobs: totalJobsInPeriod,
    financeDebug
  };
}

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat(undefined, {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0
  }).format(amount);
}
