import type { SupabaseClient } from '@supabase/supabase-js';
import { calculateInvoicePaymentStatus } from '@/lib/outbound/invoice-payment';
import { countOrganizationJobs } from '@/lib/jobs-org-query';

const CANCELLED_JOB_STATUSES = ['cancelled', 'canceled'];
const CANCELLED_BOOKING_STATUSES = ['cancelled', 'canceled'];

export type DashboardDateRange = 'month' | 'quarter' | 'year' | 'last_year' | 'all_time';

export type DashboardRevenueMetrics = {
  revenueThisMonth: number;
  cashCollected: number;
  bookedRevenue: number;
  pendingIncoming: number;
  overdueAmount: number;
  averageDaysToPayment: number | null;
  outstandingInvoices: number;
  overdueInvoiceCount: number;
  unpaidInvoiceTotal: number;
  jobsCompleted: number;
  jobsCompletedThisMonth: number;
  activeCustomers: number;
  customerCount: number;
  upcomingJobs: number;
  contractorPayThisMonth?: number;
  unpaidContractorPay?: number;
  pendingContractorPay?: number;
  otherExpensesThisMonth?: number;
  expenseTotalThisMonth: number;
  netEstimateThisMonth: number;
  netCashFlow: number;
  bookingCountThisMonth: number;
  messageCount: number;
  reportCount: number;
  jobsByStatus: Record<string, number>;
  totalJobs: number;
};

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function rangeBounds(range: DashboardDateRange): { start: string | null; end: string | null } {
  const now = new Date();
  const year = now.getFullYear();
  if (range === 'all_time') return { start: null, end: null };
  if (range === 'last_year') return { start: `${year - 1}-01-01`, end: `${year}-01-01` };
  if (range === 'year') return { start: `${year}-01-01`, end: `${year + 1}-01-01` };
  if (range === 'quarter') {
    const quarterStartMonth = Math.floor(now.getMonth() / 3) * 3;
    const start = new Date(year, quarterStartMonth, 1);
    const end = new Date(year, quarterStartMonth + 3, 1);
    return { start: start.toISOString().slice(0, 10), end: end.toISOString().slice(0, 10) };
  }
  const start = new Date(year, now.getMonth(), 1);
  const end = new Date(year, now.getMonth() + 1, 1);
  return { start: start.toISOString().slice(0, 10), end: end.toISOString().slice(0, 10) };
}

function inRange(value: unknown, start: string | null, end: string | null): boolean {
  const date = String(value || '').slice(0, 10);
  if (!date) return false;
  if (start && date < start) return false;
  if (end && date >= end) return false;
  return true;
}

function num(value: unknown): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function invoiceDate(row: { invoice_date?: unknown; created_at?: unknown }): string {
  return String(row.invoice_date || row.created_at || '').slice(0, 10);
}

function paymentDate(row: { paid_at?: unknown; last_payment_at?: unknown }): string {
  return String(row.paid_at || row.last_payment_at || '').slice(0, 10);
}

function daysBetween(startValue: unknown, endValue: unknown): number | null {
  const start = new Date(String(startValue || ''));
  const end = new Date(String(endValue || ''));
  if (!Number.isFinite(start.getTime()) || !Number.isFinite(end.getTime())) return null;
  return Math.max(0, Math.round((end.getTime() - start.getTime()) / 86400000));
}

export async function fetchDashboardRevenueMetrics(
  supabase: SupabaseClient,
  organizationId: string | null,
  range: DashboardDateRange = 'month'
): Promise<DashboardRevenueMetrics> {
  const { start, end } = rangeBounds(range);
  const today = todayIso();
  const empty: DashboardRevenueMetrics = {
    revenueThisMonth: 0,
    cashCollected: 0,
    bookedRevenue: 0,
    pendingIncoming: 0,
    overdueAmount: 0,
    averageDaysToPayment: null,
    outstandingInvoices: 0,
    overdueInvoiceCount: 0,
    unpaidInvoiceTotal: 0,
    jobsCompleted: 0,
    jobsCompletedThisMonth: 0,
    activeCustomers: 0,
    customerCount: 0,
    upcomingJobs: 0,
    contractorPayThisMonth: 0,
    unpaidContractorPay: 0,
    pendingContractorPay: 0,
    otherExpensesThisMonth: 0,
    expenseTotalThisMonth: 0,
    netEstimateThisMonth: 0,
    netCashFlow: 0,
    bookingCountThisMonth: 0,
    messageCount: 0,
    reportCount: 0,
    jobsByStatus: {},
    totalJobs: 0
  };

  if (!organizationId) return empty;

  const [invoicesRes, manualRevenueJobsRes, laborRes, completedJobsRes, customersRes, upcomingJobsRes, jobsRes, expensesRes, bookingsRes, messagesRes, reportsRes, totalJobsRes] = await Promise.all([
    supabase.from('invoices').select('amount, amount_paid, invoice_date, created_at, due_date, payment_status, paid_at, last_payment_at, job_id').eq('organization_id', organizationId),
    supabase.from('jobs').select('id, revenue_amount, created_at, start_date, scheduled_start, completed_at, status').eq('organization_id', organizationId).not('revenue_amount', 'is', null),
    supabase.from('job_labor').select('total_cost, created_at, payment_status').eq('organization_id', organizationId),
    supabase.from('jobs').select('id, completed_at').eq('organization_id', organizationId).eq('status', 'completed'),
    supabase.from('customers').select('id', { count: 'exact', head: true }).eq('organization_id', organizationId).neq('pipeline_stage', 'archived'),
    supabase.from('jobs').select('id', { count: 'exact', head: true }).eq('organization_id', organizationId).neq('status', 'completed').neq('status', 'cancelled').neq('status', 'canceled').gte('scheduled_start', `${today}T00:00:00`),
    supabase.from('jobs').select('status, created_at, start_date, scheduled_start').eq('organization_id', organizationId).neq('status', 'cancelled').neq('status', 'canceled'),
    supabase.from('expenses').select('amount, date').eq('organization_id', organizationId),
    supabase.from('bookings').select('id, starts_at').eq('organization_id', organizationId).not('status', 'in', `(${CANCELLED_BOOKING_STATUSES.join(',')})`),
    supabase.from('customer_messages').select('id, created_at').eq('organization_id', organizationId),
    supabase.from('job_reports').select('id, created_at').eq('organization_id', organizationId),
    countOrganizationJobs(supabase, organizationId, { excludeStatuses: CANCELLED_JOB_STATUSES })
  ]);

  const safeCount = (res: { count: number | null; error: unknown }) => (res.error ? 0 : res.count || 0);
  const safeData = <T,>(res: { data: T | null; error: unknown }, fallback: T): T => (res.error ? fallback : res.data || fallback);

  const invoices = safeData(invoicesRes, []);
  const invoicedJobIds = new Set<string>();
  let cashCollected = 0;
  let bookedInvoiceRevenue = 0;
  let pendingIncoming = 0;
  let overdueAmount = 0;
  let overdueInvoiceCount = 0;
  const paymentDurations: number[] = [];

  for (const inv of invoices) {
    const amount = num(inv.amount);
    const paid = Math.min(num(inv.amount_paid), amount);
    const balance = Math.max(0, amount - paid);
    const bookedDate = invoiceDate(inv);
    const paidDate = paymentDate(inv);

    if (inv.job_id) invoicedJobIds.add(String(inv.job_id));
    if (inRange(bookedDate, start, end)) bookedInvoiceRevenue += amount;
    if ((range === 'all_time' && paid > 0) || (paidDate && inRange(paidDate, start, end))) cashCollected += paid;

    if (balance > 0) {
      pendingIncoming += balance;
      const status = calculateInvoicePaymentStatus({ amount, amount_paid: paid, due_date: inv.due_date as string | null, payment_status: inv.payment_status as string | null });
      if (status === 'overdue') {
        overdueInvoiceCount += 1;
        overdueAmount += balance;
      }
    }

    if (paid > 0 && paidDate) {
      const duration = daysBetween(bookedDate, paidDate);
      if (duration !== null && inRange(paidDate, start, end)) paymentDurations.push(duration);
    }
  }

  const manualRevenue = safeData(manualRevenueJobsRes, []).reduce((sum, job) => {
    if (invoicedJobIds.has(String(job.id))) return sum;
    const bookedDate = job.completed_at || job.start_date || job.scheduled_start || job.created_at;
    return inRange(bookedDate, start, end) ? sum + num(job.revenue_amount) : sum;
  }, 0);

  const bookedRevenue = bookedInvoiceRevenue + manualRevenue;
  const averageDaysToPayment = paymentDurations.length
    ? paymentDurations.reduce((sum, days) => sum + days, 0) / paymentDurations.length
    : null;

  const rangeJobs = safeData(jobsRes, []).filter((job) => inRange(job.start_date || job.scheduled_start || job.created_at, start, end));
  const jobsByStatus: Record<string, number> = {};
  for (const job of rangeJobs) {
    const status = (job.status as string) || 'new';
    jobsByStatus[status] = (jobsByStatus[status] || 0) + 1;
  }

  const laborRows = safeData(laborRes, []);
  const contractorPay = laborRows.reduce((sum, row) => inRange(row.created_at, start, end) ? sum + num(row.total_cost) : sum, 0);
  const unpaidContractorPay = laborRows.reduce((sum, row) => String(row.payment_status || 'unpaid').toLowerCase() === 'unpaid' ? sum + num(row.total_cost) : sum, 0);
  const pendingContractorPay = laborRows.reduce((sum, row) => String(row.payment_status || '').toLowerCase() === 'pending' ? sum + num(row.total_cost) : sum, 0);
  const otherExpenses = safeData(expensesRes, []).reduce((sum, row) => inRange(row.date, start, end) ? sum + num(row.amount) : sum, 0);
  const totalCosts = contractorPay + otherExpenses;
  const completedRows = safeData(completedJobsRes, []);
  const completedInRange = completedRows.filter((row) => inRange(row.completed_at, start, end)).length;
  const bookingCount = safeData(bookingsRes, []).filter((row) => inRange(row.starts_at, start, end)).length;
  const messageCount = safeData(messagesRes, []).filter((row) => inRange(row.created_at, start, end)).length;
  const reportCount = safeData(reportsRes, []).filter((row) => inRange(row.created_at, start, end)).length;
  const netCashFlow = cashCollected - totalCosts;

  return {
    revenueThisMonth: Number(cashCollected.toFixed(2)),
    cashCollected: Number(cashCollected.toFixed(2)),
    bookedRevenue: Number(bookedRevenue.toFixed(2)),
    pendingIncoming: Number(pendingIncoming.toFixed(2)),
    overdueAmount: Number(overdueAmount.toFixed(2)),
    averageDaysToPayment: averageDaysToPayment === null ? null : Number(averageDaysToPayment.toFixed(1)),
    outstandingInvoices: Number(pendingIncoming.toFixed(2)),
    overdueInvoiceCount,
    unpaidInvoiceTotal: Number(pendingIncoming.toFixed(2)),
    jobsCompleted: completedRows.length,
    jobsCompletedThisMonth: completedInRange,
    activeCustomers: safeCount(customersRes),
    customerCount: safeCount(customersRes),
    upcomingJobs: safeCount(upcomingJobsRes),
    contractorPayThisMonth: Number(contractorPay.toFixed(2)),
    unpaidContractorPay: Number(unpaidContractorPay.toFixed(2)),
    pendingContractorPay: Number(pendingContractorPay.toFixed(2)),
    otherExpensesThisMonth: Number(otherExpenses.toFixed(2)),
    expenseTotalThisMonth: Number(totalCosts.toFixed(2)),
    netEstimateThisMonth: Number((bookedRevenue - totalCosts).toFixed(2)),
    netCashFlow: Number(netCashFlow.toFixed(2)),
    bookingCountThisMonth: bookingCount,
    messageCount,
    reportCount,
    jobsByStatus,
    totalJobs: range === 'all_time' ? (totalJobsRes.error ? rangeJobs.length : totalJobsRes.count) : rangeJobs.length
  };
}

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat(undefined, { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(amount);
}
