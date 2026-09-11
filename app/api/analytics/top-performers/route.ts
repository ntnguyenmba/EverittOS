import { NextResponse } from 'next/server';
import { requireFinanceApiAccess } from '@/lib/finance-api-auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type RangeKey = 'month' | '90d' | 'year' | 'all_time';

type JobRow = {
  id: string;
  title: string | null;
  customer_id: string | null;
  customer_name: string | null;
  assigned_to: string | null;
  status: string | null;
  completed_at: string | null;
  revenue_amount: number | null;
  expected_contractor_cost: number | null;
};

type AssignmentRow = { job_id: string; worker_id: string };
type WorkerRow = { id: string; name: string | null; email: string | null };
type ExpenseRow = { job_id: string | null; amount: number | null };

function num(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function startDateFor(range: RangeKey): string | null {
  const now = new Date();
  if (range === 'all_time') return null;
  if (range === 'month') return new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
  if (range === 'year') return new Date(now.getFullYear(), 0, 1).toISOString();
  const d = new Date(now);
  d.setDate(d.getDate() - 89);
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}

function isCompleted(status: string | null | undefined) {
  return ['completed', 'complete', 'done', 'closed'].includes(String(status || '').toLowerCase());
}

export async function GET(request: Request) {
  const ctx = await requireFinanceApiAccess();
  if (!ctx.ok) return NextResponse.json({ error: ctx.error }, { status: ctx.status });

  const rawRange = new URL(request.url).searchParams.get('range');
  const range: RangeKey = rawRange === '90d' || rawRange === 'year' || rawRange === 'all_time' ? rawRange : 'month';
  const startDate = startDateFor(range);

  let jobsQuery = ctx.supabase
    .from('jobs')
    .select('id, title, customer_id, customer_name, assigned_to, status, completed_at, revenue_amount, expected_contractor_cost')
    .eq('organization_id', ctx.organizationId);

  if (startDate) jobsQuery = jobsQuery.gte('completed_at', startDate);

  const [jobsRes, assignmentsRes, workersRes, expensesRes] = await Promise.all([
    jobsQuery,
    ctx.supabase.from('job_assignments').select('job_id, worker_id').eq('organization_id', ctx.organizationId),
    ctx.supabase.from('workers').select('id, name, email').eq('organization_id', ctx.organizationId),
    ctx.supabase.from('expenses').select('job_id, amount').eq('organization_id', ctx.organizationId)
  ]);

  if (jobsRes.error) return NextResponse.json({ error: jobsRes.error.message }, { status: 400 });

  const jobs = ((jobsRes.data || []) as JobRow[]).filter((job) => isCompleted(job.status) && job.completed_at);
  const assignments = (assignmentsRes.data || []) as AssignmentRow[];
  const workers = (workersRes.data || []) as WorkerRow[];
  const expenses = (expensesRes.data || []) as ExpenseRow[];

  const workerNames = new Map(workers.map((worker) => [worker.id, worker.name?.trim() || worker.email?.trim() || 'Worker']));
  const assignmentsByJob = new Map<string, string[]>();
  for (const row of assignments) {
    const current = assignmentsByJob.get(row.job_id) || [];
    current.push(row.worker_id);
    assignmentsByJob.set(row.job_id, current);
  }

  const expenseByJob = new Map<string, number>();
  for (const row of expenses) {
    if (!row.job_id) continue;
    expenseByJob.set(row.job_id, (expenseByJob.get(row.job_id) || 0) + num(row.amount));
  }

  const customerStats = new Map<string, { name: string; revenue: number; profit: number; jobs: number }>();
  const workerStats = new Map<string, { name: string; revenue: number; pay: number; profit: number; jobs: number }>();
  const serviceStats = new Map<string, { name: string; revenue: number; profit: number; jobs: number }>();

  let totalRevenue = 0;
  let totalProfit = 0;

  for (const job of jobs) {
    const revenue = num(job.revenue_amount);
    const contractorPay = num(job.expected_contractor_cost);
    const otherExpenses = expenseByJob.get(job.id) || 0;
    const profit = revenue - contractorPay - otherExpenses;
    totalRevenue += revenue;
    totalProfit += profit;

    const customerKey = job.customer_id || job.customer_name || 'unknown';
    const customerName = job.customer_name?.trim() || 'Customer';
    const customer = customerStats.get(customerKey) || { name: customerName, revenue: 0, profit: 0, jobs: 0 };
    customer.revenue += revenue;
    customer.profit += profit;
    customer.jobs += 1;
    customerStats.set(customerKey, customer);

    const serviceName = job.title?.trim() || 'Untitled job';
    const service = serviceStats.get(serviceName) || { name: serviceName, revenue: 0, profit: 0, jobs: 0 };
    service.revenue += revenue;
    service.profit += profit;
    service.jobs += 1;
    serviceStats.set(serviceName, service);

    const workerIds = assignmentsByJob.get(job.id)?.length ? assignmentsByJob.get(job.id)! : job.assigned_to ? [job.assigned_to] : [];
    const shareRevenue = workerIds.length ? revenue / workerIds.length : 0;
    const sharePay = workerIds.length ? contractorPay / workerIds.length : 0;
    const shareProfit = workerIds.length ? profit / workerIds.length : 0;
    for (const workerId of workerIds) {
      const worker = workerStats.get(workerId) || { name: workerNames.get(workerId) || 'Worker', revenue: 0, pay: 0, profit: 0, jobs: 0 };
      worker.revenue += shareRevenue;
      worker.pay += sharePay;
      worker.profit += shareProfit;
      worker.jobs += 1;
      workerStats.set(workerId, worker);
    }
  }

  const topCustomer = [...customerStats.values()].sort((a, b) => b.revenue - a.revenue)[0] || null;
  const topCleaner = [...workerStats.values()].sort((a, b) => b.jobs - a.jobs || b.revenue - a.revenue)[0] || null;
  const mostProfitableCustomer = [...customerStats.values()].sort((a, b) => b.profit - a.profit)[0] || null;
  const mostProfitableService = [...serviceStats.values()].sort((a, b) => b.profit - a.profit)[0] || null;
  const completedJobs = jobs.length;

  return NextResponse.json({
    range,
    completedJobs,
    topCustomer,
    topCleaner,
    mostProfitableCustomer,
    mostProfitableService,
    averageJobValue: completedJobs ? Number((totalRevenue / completedJobs).toFixed(2)) : 0,
    averageProfitPerJob: completedJobs ? Number((totalProfit / completedJobs).toFixed(2)) : 0
  });
}
