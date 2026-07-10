import type { SupabaseClient } from '@supabase/supabase-js';
import { calculateInvoicePaymentStatus } from '@/lib/outbound/invoice-payment';
import { countOrganizationJobs } from '@/lib/jobs-org-query';

const CANCELLED_JOB_STATUSES = ['cancelled', 'canceled'];
const CANCELLED_BOOKING_STATUSES = ['cancelled', 'canceled'];

export type DashboardRevenueMetrics = {
  revenueThisMonth: number;
  outstandingInvoices: number;
  overdueInvoiceCount: number;
  unpaidInvoiceTotal: number;
  jobsCompleted: number;
  jobsCompletedThisMonth: number;
  activeCustomers: number;
  customerCount: number;
  upcomingJobs: number;
  contractorPayThisMonth: number;
  otherExpensesThisMonth: number;
  expenseTotalThisMonth: number;
  netEstimateThisMonth: number;
  bookingCountThisMonth: number;
  messageCount: number;
  reportCount: number;
  jobsByStatus: Record<string, number>;
  totalJobs: number;
};

function monthStartDateIso(): string {
  const d = new Date();
  d.setDate(1);
  return d.toISOString().slice(0, 10);
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function num(value: unknown): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function invoiceDate(row: { invoice_date?: unknown; created_at?: unknown }): string {
  return String(row.invoice_date || row.created_at || '').slice(0, 10);
}

export async function fetchDashboardRevenueMetrics(
  supabase: SupabaseClient,
  organizationId: string | null
): Promise<DashboardRevenueMetrics> {
  const monthStart = monthStartDateIso();
  const today = todayIso();
  const empty: DashboardRevenueMetrics = {
    revenueThisMonth: 0,
    outstandingInvoices: 0,
    overdueInvoiceCount: 0,
    unpaidInvoiceTotal: 0,
    jobsCompleted: 0,
    jobsCompletedThisMonth: 0,
    activeCustomers: 0,
    customerCount: 0,
    upcomingJobs: 0,
    contractorPayThisMonth: 0,
    otherExpensesThisMonth: 0,
    expenseTotalThisMonth: 0,
    netEstimateThisMonth: 0,
    bookingCountThisMonth: 0,
    messageCount: 0,
    reportCount: 0,
    jobsByStatus: {},
    totalJobs: 0
  };

  if (!organizationId) return empty;

  const [
    invoicesRes,
    manualRevenueJobsRes,
    laborRes,
    completedJobsRes,
    completedThisMonthRes,
    customersRes,
    upcomingJobsRes,
    jobsRes,
    expensesRes,
    bookingsRes,
    messagesRes,
    reportsRes,
    totalJobsRes
  ] = await Promise.all([
    supabase
      .from('invoices')
      .select('amount, amount_paid, invoice_date, created_at, due_date, payment_status, job_id')
      .eq('organization_id', organizationId),
    supabase
      .from('jobs')
      .select('id, revenue_amount, created_at, start_date, scheduled_start')
      .eq('organization_id', organizationId)
      .not('revenue_amount', 'is', null),
    supabase
      .from('job_labor')
      .select('total_cost, created_at')
      .eq('organization_id', organizationId)
      .gte('created_at', `${monthStart}T00:00:00`),
    supabase
      .from('jobs')
      .select('id', { count: 'exact', head: true })
      .eq('organization_id', organizationId)
      .eq('status', 'completed'),
    supabase
      .from('jobs')
      .select('id', { count: 'exact', head: true })
      .eq('organization_id', organizationId)
      .eq('status', 'completed')
      .gte('completed_at', `${monthStart}T00:00:00`),
    supabase
      .from('customers')
      .select('id', { count: 'exact', head: true })
      .eq('organization_id', organizationId)
      .neq('pipeline_stage', 'archived'),
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
      .select('status')
      .eq('organization_id', organizationId)
      .neq('status', 'cancelled')
      .neq('status', 'canceled'),
    supabase
      .from('expenses')
      .select('amount, date')
      .eq('organization_id', organizationId)
      .gte('date', monthStart),
    supabase
      .from('bookings')
      .select('id', { count: 'exact', head: true })
      .eq('organization_id', organizationId)
      .not('status', 'in', `(${CANCELLED_BOOKING_STATUSES.join(',')})`)
      .gte('starts_at', `${monthStart}T00:00:00`),
    supabase
      .from('customer_messages')
      .select('id', { count: 'exact', head: true })
      .eq('organization_id', organizationId),
    supabase
      .from('job_reports')
      .select('id', { count: 'exact', head: true })
      .eq('organization_id', organizationId),
    countOrganizationJobs(supabase, organizationId, { excludeStatuses: CANCELLED_JOB_STATUSES })
  ]);

  const safeCount = (res: { count: number | null; error: unknown }) => (res.error ? 0 : res.count || 0);
  const safeData = <T,>(res: { data: T | null; error: unknown }, fallback: T): T => (res.error ? fallback : res.data || fallback);

  const invoices = safeData(invoicesRes, []);
  const invoicedJobIds = new Set<string>();
  const invoiceRevenueThisMonth = invoices.reduce((sum, inv) => {
    const date = invoiceDate(inv);
    if (!date || date < monthStart) return sum;
    if (inv.job_id) invoicedJobIds.add(String(inv.job_id));
    const paid = num(inv.amount_paid);
    return sum + (paid > 0 ? paid : num(inv.amount));
  }, 0);

  const manualRevenueThisMonth = safeData(manualRevenueJobsRes, []).reduce((sum, job) => {
    if (invoicedJobIds.has(String(job.id))) return sum;
    const date = String(job.start_date || job.scheduled_start || job.created_at || '').slice(0, 10);
    if (!date || date < monthStart) return sum;
    return sum + num(job.revenue_amount);
  }, 0);

  const revenueThisMonth = invoiceRevenueThisMonth + manualRevenueThisMonth;

  let outstandingInvoices = 0;
  let unpaidInvoiceTotal = 0;
  let overdueInvoiceCount = 0;

  for (const inv of invoices) {
    const amount = num(inv.amount);
    const paid = num(inv.amount_paid);
    const balance = Math.max(0, amount - paid);
    if (balance <= 0) continue;
    outstandingInvoices += balance;
    unpaidInvoiceTotal += balance;
    const status = calculateInvoicePaymentStatus({
      amount,
      amount_paid: paid,
      due_date: inv.due_date as string | null,
      payment_status: inv.payment_status as string | null
    });
    if (status === 'overdue') overdueInvoiceCount += 1;
  }

  const jobsByStatus: Record<string, number> = {};
  for (const job of safeData(jobsRes, [])) {
    const status = (job.status as string) || 'new';
    jobsByStatus[status] = (jobsByStatus[status] || 0) + 1;
  }

  const otherExpensesThisMonth = safeData(expensesRes, []).reduce((sum, row) => sum + num(row.amount), 0);
  const contractorPayThisMonth = safeData(laborRes, []).reduce((sum, row) => sum + num(row.total_cost), 0);
  const totalCostsThisMonth = otherExpensesThisMonth + contractorPayThisMonth;

  return {
    revenueThisMonth: Number(revenueThisMonth.toFixed(2)),
    outstandingInvoices: Number(outstandingInvoices.toFixed(2)),
    overdueInvoiceCount,
    unpaidInvoiceTotal: Number(unpaidInvoiceTotal.toFixed(2)),
    jobsCompleted: safeCount(completedJobsRes),
    jobsCompletedThisMonth: safeCount(completedThisMonthRes),
    activeCustomers: safeCount(customersRes),
    customerCount: safeCount(customersRes),
    upcomingJobs: safeCount(upcomingJobsRes),
    contractorPayThisMonth: Number(contractorPayThisMonth.toFixed(2)),
    otherExpensesThisMonth: Number(otherExpensesThisMonth.toFixed(2)),
    expenseTotalThisMonth: Number(totalCostsThisMonth.toFixed(2)),
    netEstimateThisMonth: Number((revenueThisMonth - totalCostsThisMonth).toFixed(2)),
    bookingCountThisMonth: safeCount(bookingsRes),
    messageCount: safeCount(messagesRes),
    reportCount: safeCount(reportsRes),
    jobsByStatus,
    totalJobs: totalJobsRes.error ? Object.values(jobsByStatus).reduce((sum, n) => sum + n, 0) : totalJobsRes.count
  };
}

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat(undefined, {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0
  }).format(amount);
}
