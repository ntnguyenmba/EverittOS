import type { SupabaseClient } from '@supabase/supabase-js';
import {
  calculateEstimatedProfit,
  fetchDashboardRevenueMetrics,
  remainingBalance
} from '@/lib/dashboard-metrics';
import {
  calculateJobPaymentStatus,
  calculateOutstandingBalance,
  fetchJobPaymentHistory,
  resolveExpectedJobAmount,
  sumJobCollectedPayments
} from '@/lib/finance/job-payments';
import {
  MATERIAL_EXPENSE_CATEGORIES,
  type BusinessPerformanceSummary,
  type ExpenseRecord,
  type JobProfitability
} from '@/lib/finance-types';
import { laborTotal } from '@/lib/finance-format';

function num(value: unknown): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

export function buildLaborRow(input: {
  hours?: unknown;
  hourlyCost?: unknown;
  paymentBasis?: unknown;
}): {
  hours: number;
  hourly_cost: number;
  total_cost: number;
  payment_basis: 'hourly' | 'flat' | 'visit';
} {
  const hours = Math.max(0, num(input.hours));
  const hourly_cost = Math.max(0, num(input.hourlyCost));
  const rawBasis = String(input.paymentBasis || '')
    .trim()
    .toLowerCase();
  const payment_basis =
    rawBasis === 'flat' || rawBasis === 'visit' || rawBasis === 'hourly'
      ? rawBasis
      : hours === 1
        ? 'flat'
        : 'hourly';

  return {
    hours: payment_basis === 'flat' ? Math.max(hours, 1) || 1 : hours,
    hourly_cost,
    total_cost: laborTotal(payment_basis === 'flat' ? Math.max(hours, 1) || 1 : hours, hourly_cost),
    payment_basis
  };
}

export function computeJobProfitability(input: {
  invoiceTotal: number;
  manualRevenue?: number;
  revenueNotes?: string | null;
  collectedAmount: number;
  laborCost: number;
  materialCost: number;
  otherExpenses: number;
  hasInvoice: boolean;
  payments?: JobProfitability['payments'];
}): JobProfitability {
  const invoiceTotal = num(input.invoiceTotal);
  const manualRevenue = num(input.manualRevenue);
  const collectedAmount = num(input.collectedAmount);
  const laborCost = num(input.laborCost);
  const materialCost = num(input.materialCost);
  const otherExpenses = num(input.otherExpenses);
  const totalExpenses = laborCost + materialCost + otherExpenses;
  const configuredExpectedAmount = resolveExpectedJobAmount({
    manualRevenue,
    invoiceTotal,
    hasInvoice: input.hasInvoice
  });
  // A recorded customer payment is confirmed revenue. When no invoice total or
  // expected job amount was entered, use collected revenue rather than zero.
  const expectedAmount = configuredExpectedAmount > 0 ? configuredExpectedAmount : collectedAmount;
  const outstanding =
    input.hasInvoice && invoiceTotal > 0
      ? remainingBalance(invoiceTotal, collectedAmount)
      : calculateOutstandingBalance(expectedAmount, collectedAmount);
  const paymentStatus = calculateJobPaymentStatus(expectedAmount, collectedAmount);
  const expectedProfit = expectedAmount - totalExpenses;
  const collectedProfit = collectedAmount - totalExpenses;
  const revenueBasis = collectedAmount > 0 ? collectedAmount : expectedAmount;
  const estimatedProfit = collectedAmount > 0 ? collectedProfit : expectedProfit;

  return {
    hasInvoice: input.hasInvoice,
    invoiceTotal,
    manualRevenue,
    revenueNotes: input.revenueNotes || null,
    expectedAmount,
    collectedAmount,
    paymentsReceived: collectedAmount,
    outstanding: Number(outstanding.toFixed(2)),
    paymentStatus,
    laborCost,
    materialCost,
    otherExpenses,
    totalExpenses: Number(totalExpenses.toFixed(2)),
    expectedProfit: Number(expectedProfit.toFixed(2)),
    collectedProfit: Number(collectedProfit.toFixed(2)),
    estimatedProfit: Number(estimatedProfit.toFixed(2)),
    revenueBasis,
    payments: input.payments || []
  };
}

export function monthStartIso(date = new Date()): string {
  const d = new Date(date);
  d.setDate(1);
  d.setHours(0, 0, 0, 0);
  return d.toISOString().slice(0, 10);
}

export function monthEndIso(date = new Date()): string {
  const d = new Date(date.getFullYear(), date.getMonth() + 1, 0);
  return d.toISOString().slice(0, 10);
}

export function splitExpenseCosts(expenses: Pick<ExpenseRecord, 'category' | 'amount'>[]): {
  materialCost: number;
  otherExpenses: number;
} {
  let materialCost = 0;
  let otherExpenses = 0;
  for (const row of expenses) {
    const amount = num(row.amount);
    if (MATERIAL_EXPENSE_CATEGORIES.includes(row.category)) {
      materialCost += amount;
    } else {
      otherExpenses += amount;
    }
  }
  return {
    materialCost: Number(materialCost.toFixed(2)),
    otherExpenses: Number(otherExpenses.toFixed(2))
  };
}

type JobRow = {
  id: string;
  title: string;
  customer_id: string | null;
  customer_name: string | null;
  assigned_to: string | null;
  revenue_amount: number | null;
};

type InvoiceRow = {
  id: string;
  job_id: string | null;
  customer_id: string | null;
  amount: number;
  amount_paid: number;
  invoice_date: string | null;
  created_at: string;
  payment_status?: string | null;
  status?: string | null;
};

type AssignmentRow = { job_id: string; worker_id: string };
type DirectPaymentRow = { job_id: string; amount: number; paid_at: string };

export async function fetchJobProfitability(
  supabase: SupabaseClient,
  organizationId: string,
  jobId: string
): Promise<JobProfitability> {
  const [jobRes, invoiceRes, laborRes, expenseRes] = await Promise.all([
    supabase
      .from('jobs')
      .select('revenue_amount, revenue_notes')
      .eq('organization_id', organizationId)
      .eq('id', jobId)
      .maybeSingle(),
    supabase
      .from('invoices')
      .select('amount, amount_paid')
      .eq('organization_id', organizationId)
      .eq('job_id', jobId)
      .order('created_at', { ascending: false })
      .limit(1),
    supabase.from('job_labor').select('total_cost').eq('organization_id', organizationId).eq('job_id', jobId),
    supabase.from('expenses').select('category, amount').eq('organization_id', organizationId).eq('job_id', jobId)
  ]);

  const invoice = invoiceRes.data?.[0];
  const laborCost = (laborRes.data || []).reduce((s, r) => s + num(r.total_cost), 0);
  const { materialCost, otherExpenses } = splitExpenseCosts((expenseRes.data || []) as ExpenseRecord[]);
  const hasInvoice = Boolean(invoice);
  const collectedAmount = hasInvoice
    ? num(invoice?.amount_paid)
    : await sumJobCollectedPayments(supabase, organizationId, jobId);
  const { payments } = await fetchJobPaymentHistory(supabase, organizationId, jobId);

  return computeJobProfitability({
    hasInvoice,
    invoiceTotal: num(invoice?.amount),
    manualRevenue: num(jobRes.data?.revenue_amount),
    revenueNotes: (jobRes.data?.revenue_notes as string | null) || null,
    collectedAmount,
    laborCost: Number(laborCost.toFixed(2)),
    materialCost,
    otherExpenses,
    payments
  });
}

export async function fetchBusinessPerformance(
  supabase: SupabaseClient,
  organizationId: string
): Promise<BusinessPerformanceSummary> {
  const start = monthStartIso();
  const end = monthEndIso();
  const sixMonthsAgo = new Date();
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 5);
  sixMonthsAgo.setDate(1);
  const rangeStart = sixMonthsAgo.toISOString().slice(0, 10);

  // Canonical month KPIs: same source as the dashboard Business overview.
  const dashboardMetrics = await fetchDashboardRevenueMetrics(supabase, organizationId, 'month');

  const [
    invoicesRes,
    expensesRes,
    jobsRes,
    laborRes,
    workersRes,
    customersRes,
    assignmentsRes,
    directPaymentsRes
  ] = await Promise.all([
    supabase
      .from('invoices')
      .select('id, job_id, customer_id, amount, amount_paid, invoice_date, created_at, payment_status, status')
      .eq('organization_id', organizationId),
    supabase
      .from('expenses')
      .select('category, amount, date, job_id')
      .eq('organization_id', organizationId)
      .gte('date', start)
      .lte('date', end),
    supabase
      .from('jobs')
      .select('id, title, customer_id, customer_name, assigned_to, revenue_amount')
      .eq('organization_id', organizationId),
    supabase.from('job_labor').select('job_id, total_cost').eq('organization_id', organizationId),
    supabase.from('workers').select('id, name').eq('organization_id', organizationId),
    supabase.from('customers').select('id, company_name').eq('organization_id', organizationId),
    supabase.from('job_assignments').select('job_id, worker_id').eq('organization_id', organizationId),
    supabase.from('job_payments').select('job_id, amount, paid_at').eq('organization_id', organizationId)
  ]);

  const invoices = (invoicesRes.data || []) as InvoiceRow[];
  const directPayments = (directPaymentsRes.data || []) as DirectPaymentRow[];
  const revenueThisMonth = dashboardMetrics.customerInvoices;
  const paymentsThisMonth = dashboardMetrics.paidToYou;
  const outstandingInvoices = dashboardMetrics.stillOwed;
  const expensesThisMonth = dashboardMetrics.otherExpensesThisMonth || 0;
  const estimatedProfitThisMonth = calculateEstimatedProfit({
    expectedRevenue:
      dashboardMetrics.expectedRevenue ??
      Number(
        ((dashboardMetrics.customerInvoices || 0) + (dashboardMetrics.uninvoicedCompletedWork || 0)).toFixed(2)
      ),
    contractorPay: dashboardMetrics.contractorPayThisMonth || 0,
    otherExpenses: expensesThisMonth
  });

  const jobs = (jobsRes.data || []) as JobRow[];
  const jobMap = new Map(jobs.map((j) => [j.id, j]));
  const workerMap = new Map((workersRes.data || []).map((w) => [w.id, w.name as string]));
  const customerMap = new Map((customersRes.data || []).map((c) => [c.id, c.company_name as string]));
  const invoicedJobIds = new Set(invoices.map((invoice) => invoice.job_id).filter(Boolean) as string[]);

  const directRevenueByJob = new Map<string, number>();
  const latestDirectPaymentDateByJob = new Map<string, string>();
  for (const payment of directPayments) {
    if (!payment.job_id || invoicedJobIds.has(payment.job_id)) continue;
    directRevenueByJob.set(
      payment.job_id,
      Number(((directRevenueByJob.get(payment.job_id) || 0) + num(payment.amount)).toFixed(2))
    );
    const paidDate = String(payment.paid_at || '').slice(0, 10);
    const current = latestDirectPaymentDateByJob.get(payment.job_id) || '';
    if (paidDate > current) latestDirectPaymentDateByJob.set(payment.job_id, paidDate);
  }

  const assignmentsByJob = new Map<string, string[]>();
  for (const row of (assignmentsRes.data || []) as AssignmentRow[]) {
    const list = assignmentsByJob.get(row.job_id) || [];
    list.push(row.worker_id);
    assignmentsByJob.set(row.job_id, list);
  }

  const customerRevenue = new Map<string, number>();
  const workerRevenue = new Map<string, number>();
  const monthRevenue = new Map<string, number>();
  const categoryExpenses = new Map<string, number>();

  const addRevenueAttribution = (job: JobRow | undefined, revenue: number, date: string) => {
    if (revenue <= 0) return;
    const monthKey = date.slice(0, 7);
    if (monthKey) monthRevenue.set(monthKey, (monthRevenue.get(monthKey) || 0) + revenue);
    if (job?.customer_id) {
      customerRevenue.set(job.customer_id, (customerRevenue.get(job.customer_id) || 0) + revenue);
    }
    const workerIds = job ? assignmentsByJob.get(job.id) || [] : [];
    if (workerIds.length === 0 && job?.assigned_to) workerIds.push(job.assigned_to);
    if (workerIds.length > 0) {
      const share = revenue / workerIds.length;
      for (const workerId of workerIds) {
        workerRevenue.set(workerId, (workerRevenue.get(workerId) || 0) + share);
      }
    }
  };

  for (const inv of invoices) {
    const statusHint = String(inv.payment_status || inv.status || '').toLowerCase();
    if (statusHint === 'cancelled' || statusHint === 'canceled') continue;
    const revenue = num(inv.amount);
    const job = inv.job_id ? jobMap.get(inv.job_id) : undefined;
    if (!job?.customer_id && inv.customer_id) {
      customerRevenue.set(inv.customer_id, (customerRevenue.get(inv.customer_id) || 0) + revenue);
    }
    addRevenueAttribution(job, revenue, inv.invoice_date || inv.created_at || '');
  }

  for (const job of jobs) {
    if (invoicedJobIds.has(job.id)) continue;
    const manualRevenue = num(job.revenue_amount);
    const directRevenue = directRevenueByJob.get(job.id) || 0;
    const revenue = manualRevenue > 0 ? manualRevenue : directRevenue;
    const revenueDate = latestDirectPaymentDateByJob.get(job.id) || '';
    addRevenueAttribution(job, revenue, revenueDate);
  }

  for (const row of expensesRes.data || []) {
    const cat = String(row.category || 'Other');
    categoryExpenses.set(cat, (categoryExpenses.get(cat) || 0) + num(row.amount));
  }

  const laborByJob = new Map<string, number>();
  for (const row of laborRes.data || []) {
    laborByJob.set(row.job_id, (laborByJob.get(row.job_id) || 0) + num(row.total_cost));
  }

  const expenseByJob = new Map<string, number>();
  const allExpensesRes = await supabase
    .from('expenses')
    .select('job_id, amount')
    .eq('organization_id', organizationId)
    .not('job_id', 'is', null);
  for (const row of allExpensesRes.data || []) {
    if (!row.job_id) continue;
    expenseByJob.set(row.job_id, (expenseByJob.get(row.job_id) || 0) + num(row.amount));
  }

  let mostProfitableJob: BusinessPerformanceSummary['mostProfitableJob'] = null;
  const profitByJob: BusinessPerformanceSummary['profitByJob'] = [];

  for (const job of jobs) {
    const inv = invoices.find((invoice) => invoice.job_id === job.id);
    const manualRevenue = num(job.revenue_amount);
    const directRevenue = directRevenueByJob.get(job.id) || 0;
    const revenue = inv ? num(inv.amount) : manualRevenue > 0 ? manualRevenue : directRevenue;
    const costs = (laborByJob.get(job.id) || 0) + (expenseByJob.get(job.id) || 0);
    const profit = revenue - costs;
    if (revenue > 0 || costs > 0) {
      profitByJob.push({ label: job.title, value: Number(profit.toFixed(2)), jobId: job.id });
    }
    const revenueDate = inv?.invoice_date || inv?.created_at?.slice(0, 10) || latestDirectPaymentDateByJob.get(job.id);
    if (revenueDate && revenueDate >= start && revenueDate <= end) {
      if (!mostProfitableJob || profit > mostProfitableJob.profit) {
        mostProfitableJob = { id: job.id, title: job.title, profit: Number(profit.toFixed(2)) };
      }
    }
  }

  profitByJob.sort((a, b) => b.value - a.value);

  const revenueByMonth = Array.from(monthRevenue.entries())
    .filter(([label]) => label >= rangeStart.slice(0, 7))
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([label, value]) => ({ label, value: Number(value.toFixed(2)) }));

  return {
    revenueThisMonth: Number(revenueThisMonth.toFixed(2)),
    paymentsThisMonth: Number(paymentsThisMonth.toFixed(2)),
    outstandingInvoices: Number(outstandingInvoices.toFixed(2)),
    expensesThisMonth: Number(expensesThisMonth.toFixed(2)),
    estimatedProfitThisMonth: Number(estimatedProfitThisMonth.toFixed(2)),
    topCustomer: Array.from(customerRevenue.entries()).sort((a, b) => b[1] - a[1]).map(([id, revenue]) => ({ name: customerMap.get(id) || 'Customer', revenue: Number(revenue.toFixed(2)) }))[0] || null,
    topWorker: Array.from(workerRevenue.entries()).sort((a, b) => b[1] - a[1]).map(([id, revenue]) => ({ name: workerMap.get(id) || 'Team member', revenue: Number(revenue.toFixed(2)) }))[0] || null,
    mostProfitableJob,
    revenueByMonth,
    revenueByCustomer: Array.from(customerRevenue.entries()).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([id, value]) => ({ label: customerMap.get(id) || 'Customer', value: Number(value.toFixed(2)) })),
    revenueByWorker: Array.from(workerRevenue.entries()).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([id, value]) => ({ label: workerMap.get(id) || 'Team member', value: Number(value.toFixed(2)) })),
    expensesByCategory: Array.from(categoryExpenses.entries()).sort((a, b) => b[1] - a[1]).map(([label, value]) => ({ label, value: Number(value.toFixed(2)) })),
    profitByJob: profitByJob.slice(0, 8)
  };
}
