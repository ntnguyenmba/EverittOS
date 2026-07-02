import type { SupabaseClient } from '@supabase/supabase-js';
import { calculateInvoicePaymentStatus } from '@/lib/outbound/invoice-payment';

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
  expenseTotalThisMonth: number;
  netEstimateThisMonth: number;
  bookingCountThisMonth: number;
  messageCount: number;
  reportCount: number;
  jobsByStatus: Record<string, number>;
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
    expenseTotalThisMonth: 0,
    netEstimateThisMonth: 0,
    bookingCountThisMonth: 0,
    messageCount: 0,
    reportCount: 0,
    jobsByStatus: {}
  };

  if (!organizationId) return empty;

  const [
    invoicesRes,
    completedJobsRes,
    completedThisMonthRes,
    customersRes,
    upcomingJobsRes,
    jobsRes,
    expensesRes,
    bookingsRes,
    messagesRes,
    reportsRes
  ] = await Promise.all([
    supabase
      .from('invoices')
      .select('amount, amount_paid, invoice_date, created_at, due_date, payment_status')
      .eq('organization_id', organizationId),
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
      .gte('scheduled_start', `${today}T00:00:00`),
    supabase.from('jobs').select('status').eq('organization_id', organizationId),
    supabase
      .from('expenses')
      .select('amount, date')
      .eq('organization_id', organizationId)
      .gte('date', monthStart),
    supabase
      .from('bookings')
      .select('id', { count: 'exact', head: true })
      .eq('organization_id', organizationId)
      .gte('starts_at', `${monthStart}T00:00:00`),
    supabase
      .from('customer_messages')
      .select('id', { count: 'exact', head: true })
      .eq('organization_id', organizationId),
    supabase
      .from('job_reports')
      .select('id', { count: 'exact', head: true })
      .eq('organization_id', organizationId)
  ]);

  const safeCount = (res: { count: number | null; error: unknown }) => (res.error ? 0 : res.count || 0);
  const safeData = <T,>(res: { data: T | null; error: unknown }, fallback: T): T => (res.error ? fallback : res.data || fallback);

  const invoices = safeData(invoicesRes, []);
  const revenueThisMonth = invoices.reduce((sum, inv) => {
    const date = (inv.invoice_date as string | null) || (inv.created_at as string | null)?.slice(0, 10);
    if (!date || date < monthStart) return sum;
    const paid = num(inv.amount_paid);
    return sum + (paid > 0 ? paid : num(inv.amount));
  }, 0);

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

  const expenseTotalThisMonth = safeData(expensesRes, []).reduce((sum, row) => sum + num(row.amount), 0);

  return {
    revenueThisMonth,
    outstandingInvoices,
    overdueInvoiceCount,
    unpaidInvoiceTotal,
    jobsCompleted: safeCount(completedJobsRes),
    jobsCompletedThisMonth: safeCount(completedThisMonthRes),
    activeCustomers: safeCount(customersRes),
    customerCount: safeCount(customersRes),
    upcomingJobs: safeCount(upcomingJobsRes),
    expenseTotalThisMonth: safeData(expensesRes, []).reduce((sum, row) => sum + num(row.amount), 0),
    netEstimateThisMonth: revenueThisMonth - safeData(expensesRes, []).reduce((sum, row) => sum + num(row.amount), 0),
    bookingCountThisMonth: safeCount(bookingsRes),
    messageCount: safeCount(messagesRes),
    reportCount: safeCount(reportsRes),
    jobsByStatus
  };
}

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat(undefined, {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0
  }).format(amount);
}
