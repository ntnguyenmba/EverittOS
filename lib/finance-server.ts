import type { SupabaseClient } from '@supabase/supabase-js';
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

export function computeJobProfitability(input: {
  invoiceTotal: number;
  paymentsReceived: number;
  laborCost: number;
  materialCost: number;
  otherExpenses: number;
  hasInvoice: boolean;
}): JobProfitability {
  const invoiceTotal = num(input.invoiceTotal);
  const paymentsReceived = num(input.paymentsReceived);
  const laborCost = num(input.laborCost);
  const materialCost = num(input.materialCost);
  const otherExpenses = num(input.otherExpenses);
  const outstanding = Math.max(0, invoiceTotal - paymentsReceived);
  const revenueBasis = paymentsReceived > 0 ? paymentsReceived : invoiceTotal;
  const estimatedProfit = revenueBasis - laborCost - materialCost - otherExpenses;

  return {
    hasInvoice: input.hasInvoice,
    invoiceTotal,
    paymentsReceived,
    outstanding,
    laborCost,
    materialCost,
    otherExpenses,
    estimatedProfit: Number(estimatedProfit.toFixed(2)),
    revenueBasis
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
};

type InvoiceRow = {
  id: string;
  job_id: string | null;
  customer_id: string | null;
  amount: number;
  amount_paid: number;
  invoice_date: string | null;
  created_at: string;
};

type AssignmentRow = { job_id: string; worker_id: string };

export async function fetchJobProfitability(
  supabase: SupabaseClient,
  organizationId: string,
  jobId: string
): Promise<JobProfitability> {
  const [invoiceRes, laborRes, expenseRes] = await Promise.all([
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

  return computeJobProfitability({
    hasInvoice: Boolean(invoice),
    invoiceTotal: num(invoice?.amount),
    paymentsReceived: num(invoice?.amount_paid),
    laborCost: Number(laborCost.toFixed(2)),
    materialCost,
    otherExpenses
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

  const [invoicesRes, expensesRes, jobsRes, laborRes, workersRes, customersRes, assignmentsRes] =
    await Promise.all([
      supabase
        .from('invoices')
        .select('id, job_id, customer_id, amount, amount_paid, invoice_date, created_at')
        .eq('organization_id', organizationId),
      supabase
        .from('expenses')
        .select('category, amount, date, job_id')
        .eq('organization_id', organizationId)
        .gte('date', start)
        .lte('date', end),
      supabase
        .from('jobs')
        .select('id, title, customer_id, customer_name, assigned_to')
        .eq('organization_id', organizationId),
      supabase.from('job_labor').select('job_id, total_cost').eq('organization_id', organizationId),
      supabase.from('workers').select('id, name').eq('organization_id', organizationId),
      supabase.from('customers').select('id, company_name').eq('organization_id', organizationId),
      supabase.from('job_assignments').select('job_id, worker_id').eq('organization_id', organizationId)
    ]);

  const invoices = (invoicesRes.data || []) as InvoiceRow[];
  const monthInvoices = invoices.filter((inv) => {
    const d = inv.invoice_date || inv.created_at?.slice(0, 10);
    return d && d >= start && d <= end;
  });

  const revenueThisMonth = monthInvoices.reduce((s, inv) => s + num(inv.amount), 0);
  const paymentsThisMonth = monthInvoices.reduce((s, inv) => s + num(inv.amount_paid), 0);
  const outstandingInvoices = invoices.reduce(
    (s, inv) => s + Math.max(0, num(inv.amount) - num(inv.amount_paid)),
    0
  );
  const expensesThisMonth = (expensesRes.data || []).reduce((s, row) => s + num(row.amount), 0);

  const jobs = (jobsRes.data || []) as JobRow[];
  const jobMap = new Map(jobs.map((j) => [j.id, j]));
  const workerMap = new Map((workersRes.data || []).map((w) => [w.id, w.name as string]));
  const customerMap = new Map((customersRes.data || []).map((c) => [c.id, c.company_name as string]));

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

  for (const inv of invoices) {
    const revenue = num(inv.amount_paid) > 0 ? num(inv.amount_paid) : num(inv.amount);
    const monthKey = (inv.invoice_date || inv.created_at || '').slice(0, 7);
    if (monthKey) {
      monthRevenue.set(monthKey, (monthRevenue.get(monthKey) || 0) + revenue);
    }

    const customerId = inv.customer_id || (inv.job_id ? jobMap.get(inv.job_id)?.customer_id : null);
    if (customerId) {
      customerRevenue.set(customerId, (customerRevenue.get(customerId) || 0) + revenue);
    }

    if (inv.job_id) {
      const job = jobMap.get(inv.job_id);
      const workerIds = assignmentsByJob.get(inv.job_id) || [];
      if (workerIds.length === 0 && job?.assigned_to) {
        workerIds.push(job.assigned_to);
      }
      if (workerIds.length > 0) {
        const share = revenue / workerIds.length;
        for (const workerId of workerIds) {
          workerRevenue.set(workerId, (workerRevenue.get(workerId) || 0) + share);
        }
      }
    }
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
    const inv = invoices.find((i) => i.job_id === job.id);
    const revenue = inv ? (num(inv.amount_paid) > 0 ? num(inv.amount_paid) : num(inv.amount)) : 0;
    const costs = (laborByJob.get(job.id) || 0) + (expenseByJob.get(job.id) || 0);
    const profit = revenue - costs;
    if (revenue > 0 || costs > 0) {
      profitByJob.push({ label: job.title, value: Number(profit.toFixed(2)), jobId: job.id });
    }
    const invDate = inv?.invoice_date || inv?.created_at?.slice(0, 10);
    if (invDate && invDate >= start && invDate <= end) {
      if (!mostProfitableJob || profit > mostProfitableJob.profit) {
        mostProfitableJob = { id: job.id, title: job.title, profit: Number(profit.toFixed(2)) };
      }
    }
  }

  profitByJob.sort((a, b) => b.value - a.value);

  const topCustomerEntry = Array.from(customerRevenue.entries()).sort((a, b) => b[1] - a[1])[0];
  const topWorkerEntry = Array.from(workerRevenue.entries()).sort((a, b) => b[1] - a[1])[0];

  const revenueByMonth: BusinessPerformanceSummary['revenueByMonth'] = [];
  for (let i = 0; i < 6; i++) {
    const d = new Date(sixMonthsAgo);
    d.setMonth(sixMonthsAgo.getMonth() + i);
    const key = d.toISOString().slice(0, 7);
    const label = d.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
    revenueByMonth.push({ label, value: Number((monthRevenue.get(key) || 0).toFixed(2)) });
  }

  const revenueByCustomer = Array.from(customerRevenue.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([id, value]) => ({
      label: customerMap.get(id) || jobMap.get(id)?.customer_name || 'Customer',
      value: Number(value.toFixed(2))
    }));

  const revenueByWorker = Array.from(workerRevenue.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([id, value]) => ({
      label: workerMap.get(id) || 'Team member',
      value: Number(value.toFixed(2))
    }));

  const expensesByCategory = Array.from(categoryExpenses.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([label, value]) => ({ label, value: Number(value.toFixed(2)) }));

  const estimatedProfitThisMonth = paymentsThisMonth - expensesThisMonth;

  return {
    revenueThisMonth: Number(revenueThisMonth.toFixed(2)),
    paymentsThisMonth: Number(paymentsThisMonth.toFixed(2)),
    outstandingInvoices: Number(outstandingInvoices.toFixed(2)),
    expensesThisMonth: Number(expensesThisMonth.toFixed(2)),
    estimatedProfitThisMonth: Number(estimatedProfitThisMonth.toFixed(2)),
    topCustomer: topCustomerEntry
      ? {
          name: customerMap.get(topCustomerEntry[0]) || 'Customer',
          revenue: Number(topCustomerEntry[1].toFixed(2))
        }
      : null,
    topWorker: topWorkerEntry
      ? {
          name: workerMap.get(topWorkerEntry[0]) || 'Team member',
          revenue: Number(topWorkerEntry[1].toFixed(2))
        }
      : null,
    mostProfitableJob,
    revenueByMonth,
    revenueByCustomer,
    revenueByWorker,
    expensesByCategory,
    profitByJob: profitByJob.slice(0, 8)
  };
}

export function buildLaborRow(input: {
  hours: number;
  hourlyCost: number;
}): { hours: number; hourly_cost: number; total_cost: number } {
  const hours = num(input.hours);
  const hourly_cost = num(input.hourlyCost);
  return {
    hours,
    hourly_cost,
    total_cost: laborTotal(hours, hourly_cost)
  };
}
