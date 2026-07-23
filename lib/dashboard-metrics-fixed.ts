import type { SupabaseClient } from '@supabase/supabase-js';
import { getJobOperationalDate, type JobDateFields } from '@/lib/job-operational-date';
import * as base from './dashboard-metrics';

export * from './dashboard-metrics';

export type JobPeriodRow = JobDateFields & { id?: string | null };
export type LaborPeriodRow = base.LaborCostRow & { job_id?: unknown };

export function buildJobOperationalDateMap(jobs: JobPeriodRow[]): Map<string, string> {
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
  invoice: base.InvoiceMetricRow,
  jobDates: Map<string, string>
): string {
  const jobId = String(invoice.job_id || '');
  if (jobId) return jobDates.get(jobId) || base.invoiceDate(invoice);
  return base.invoiceDate(invoice);
}

export function calculateCustomerInvoices(
  invoices: base.InvoiceMetricRow[],
  start: string | null,
  end: string | null,
  jobDates: Map<string, string> = new Map()
): number {
  return Number(
    invoices.reduce((sum, invoice) => {
      if (!base.isCollectibleInvoice(invoice)) return sum;
      const periodDate = dashboardInvoicePeriodDate(invoice, jobDates);
      return base.inRange(periodDate, start, end) ? sum + base.num(invoice.amount) : sum;
    }, 0).toFixed(2)
  );
}

export function calculateContractorAccruedCost(
  laborRows: LaborPeriodRow[],
  start: string | null,
  end: string | null,
  jobDates: Map<string, string> = new Map()
): number {
  return Number(
    laborRows.reduce((sum, row) => {
      const jobId = String(row.job_id || '');
      if (jobId) {
        const jobDate = jobDates.get(jobId);
        if (!jobDate) return start === null && end === null ? sum + base.num(row.total_cost) : sum;
        return base.inRange(jobDate, start, end) ? sum + base.num(row.total_cost) : sum;
      }
      // Legacy labor rows without a job use created_at as the only available period fallback.
      return base.inRange(row.created_at, start, end) ? sum + base.num(row.total_cost) : sum;
    }, 0).toFixed(2)
  );
}

export function calculateUninvoicedExpectedRevenue(
  jobs: Array<JobPeriodRow & { revenue_amount?: unknown }>,
  invoicedJobIds: Set<string>,
  start: string | null,
  end: string | null,
  jobDates: Map<string, string> = buildJobOperationalDateMap(jobs)
): number {
  return Number(
    jobs.reduce((sum, job) => {
      const jobId = String(job.id || '');
      if (!jobId || invoicedJobIds.has(jobId)) return sum;
      const status = String(job.status || '').toLowerCase();
      if (status === 'cancelled' || status === 'canceled') return sum;
      const amount = base.num(job.revenue_amount);
      if (amount <= 0) return sum;
      const periodDate = jobDates.get(jobId);
      return periodDate && base.inRange(periodDate, start, end) ? sum + amount : sum;
    }, 0).toFixed(2)
  );
}

export function buildPrimaryDashboardMetrics(
  input: Parameters<typeof base.buildPrimaryDashboardMetrics>[0]
): ReturnType<typeof base.buildPrimaryDashboardMetrics> {
  return base.buildPrimaryDashboardMetrics({
    ...input,
    helps: {
      ...input.helps,
      contractorCost: input.helps?.contractorCost || 'Contractor labor for jobs in this period.',
      expectedProfit:
        input.helps?.expectedProfit ||
        'Expected revenue minus contractor labor for the same jobs and other expenses.'
    }
  });
}

export async function fetchDashboardRevenueMetrics(
  supabase: SupabaseClient,
  organizationId: string | null,
  range: base.DashboardDateRange = 'month'
): Promise<base.DashboardRevenueMetrics> {
  const metrics = await base.fetchDashboardRevenueMetrics(supabase, organizationId, range);
  if (!organizationId) return metrics;

  const { start, end } = base.rangeBounds(range);
  const [invoicesRes, jobsRes, visitsRes, laborRes, expensesRes] = await Promise.all([
    supabase
      .from('invoices')
      .select('id, amount, amount_paid, invoice_date, created_at, due_date, payment_status, status, paid_at, last_payment_at, job_id')
      .eq('organization_id', organizationId),
    supabase
      .from('jobs')
      .select('id, revenue_amount, created_at, start_date, scheduled_start, completed_at, due_date, status')
      .eq('organization_id', organizationId),
    supabase.from('job_visits').select('job_id, visit_date').eq('organization_id', organizationId),
    supabase
      .from('job_labor')
      .select('job_id, total_cost, created_at, payment_status, paid_at')
      .eq('organization_id', organizationId),
    supabase.from('expenses').select('amount, date').eq('organization_id', organizationId)
  ]);

  if (invoicesRes.error || jobsRes.error || laborRes.error || expensesRes.error) {
    return { ...metrics, loadFailed: true };
  }

  const latestVisitByJob = new Map<string, string>();
  if (!visitsRes.error) {
    for (const visit of visitsRes.data || []) {
      const jobId = String(visit.job_id || '');
      const date = String(visit.visit_date || '').slice(0, 10);
      if (!jobId || !date) continue;
      const current = latestVisitByJob.get(jobId);
      if (!current || date > current) latestVisitByJob.set(jobId, date);
    }
  }

  const jobs = ((jobsRes.data || []) as Array<JobPeriodRow & { revenue_amount?: unknown }>).map((job) => ({
    ...job,
    latest_completed_visit_date: latestVisitByJob.get(String(job.id || '')) || null
  }));
  const jobDates = buildJobOperationalDateMap(jobs);
  const invoices = (invoicesRes.data || []) as base.InvoiceMetricRow[];
  const labor = (laborRes.data || []) as LaborPeriodRow[];
  const invoicedJobIds = base.collectibleInvoicedJobIds(invoices);

  const customerInvoices = calculateCustomerInvoices(invoices, start, end, jobDates);
  const uninvoicedCompletedWork = calculateUninvoicedExpectedRevenue(
    jobs,
    invoicedJobIds,
    start,
    end,
    jobDates
  );
  const expectedRevenue = base.calculateExpectedRevenue(customerInvoices, uninvoicedCompletedWork);
  const contractorPay = calculateContractorAccruedCost(labor, start, end, jobDates);
  const contractorPaymentsPaid = base.calculateContractorCashPaid(labor, start, end, range);
  const otherExpenses = Number(
    ((expensesRes.data || []) as Array<{ amount?: unknown; date?: unknown }>).reduce(
      (sum, expense) => (base.inRange(expense.date, start, end) ? sum + base.num(expense.amount) : sum),
      0
    ).toFixed(2)
  );
  const estimatedProfit = base.calculateEstimatedProfit({ expectedRevenue, contractorPay, otherExpenses });
  const cashAfterPaidCosts = base.calculateCashAfterPaidCosts({
    cashCollected: metrics.paidToYou,
    contractorCashPaid: contractorPaymentsPaid,
    otherCashExpenses: otherExpenses
  });

  return {
    ...metrics,
    customerInvoices,
    bookedRevenue: customerInvoices,
    uninvoicedCompletedWork,
    expectedRevenue,
    contractorPayThisMonth: contractorPay,
    contractorPaymentsPaid,
    otherExpensesThisMonth: otherExpenses,
    expenseTotalThisMonth: Number((contractorPay + otherExpenses).toFixed(2)),
    netEstimateThisMonth: estimatedProfit,
    estimatedProfit,
    netCashFlow: cashAfterPaidCosts,
    cashAfterExpenses: cashAfterPaidCosts,
    cashAfterPaidCosts
  };
}
