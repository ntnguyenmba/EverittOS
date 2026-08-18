import type { SupabaseClient } from '@supabase/supabase-js';
import type { AskEverittAiPrefetchedContext } from '@/lib/ask-everitt/types';
import { runAskEverittSearchEngine } from '@/lib/ask-everitt/search-engine';

function money(value: unknown): number {
  const parsed = Number(value || 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function moneyLabel(value: number): string {
  return `$${value.toFixed(2)}`;
}

function wantsFinancialContext(prompt: string): boolean {
  return /\b(profit|revenue|customer pay|customer price|worker pay|worker price|worker cost|contractor pay|contractor cost|labor|expense|expenses|owed|owe|paid|payment|money|made|make|earn|earned|margin|cost|income)\b/i.test(
    prompt
  );
}

function promptTokens(prompt: string): string[] {
  return Array.from(
    new Set(
      prompt
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, ' ')
        .split(/\s+/)
        .filter((token) => token.length >= 3 && !['the', 'this', 'that', 'what', 'how', 'much', 'job', 'jobs'].includes(token))
    )
  ).slice(0, 12);
}

async function buildJobFinanceContext(
  supabase: SupabaseClient,
  organizationId: string,
  prompt: string
): Promise<string> {
  if (!wantsFinancialContext(prompt)) return '';

  const jobsRes = await supabase
    .from('jobs')
    .select(
      'id, title, customer_name, address, status, start_date, scheduled_start, revenue_amount, expected_contractor_cost, expected_additional_expense'
    )
    .eq('organization_id', organizationId)
    .order('created_at', { ascending: false })
    .limit(40);

  if (jobsRes.error || !jobsRes.data?.length) return '';

  const tokens = promptTokens(prompt);
  const scored = jobsRes.data
    .map((job) => {
      const haystack = [job.title, job.customer_name, job.address, job.start_date]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      const score = tokens.reduce((sum, token) => sum + (haystack.includes(token) ? 1 : 0), 0);
      return { job, score };
    })
    .sort((a, b) => b.score - a.score);

  const bestScore = scored[0]?.score || 0;
  const selected = (bestScore > 0 ? scored.filter((entry) => entry.score === bestScore) : scored).slice(0, bestScore > 0 ? 8 : 12);
  const jobIds = selected.map((entry) => entry.job.id);
  if (!jobIds.length) return '';

  const [laborRes, expensesRes, jobPaymentsRes, invoicesRes] = await Promise.all([
    supabase
      .from('job_labor')
      .select('job_id, total_cost, payment_status, worker_name')
      .eq('organization_id', organizationId)
      .in('job_id', jobIds),
    supabase
      .from('expenses')
      .select('job_id, amount')
      .eq('organization_id', organizationId)
      .in('job_id', jobIds),
    supabase
      .from('job_payments')
      .select('job_id, amount')
      .eq('organization_id', organizationId)
      .in('job_id', jobIds),
    supabase
      .from('invoices')
      .select('job_id, amount, amount_paid, status, payment_status')
      .eq('organization_id', organizationId)
      .in('job_id', jobIds)
  ]);

  const laborByJob = new Map<string, { total: number; paid: number; workers: string[] }>();
  for (const row of laborRes.data || []) {
    if (!row.job_id) continue;
    const current = laborByJob.get(row.job_id) || { total: 0, paid: 0, workers: [] };
    const amount = money(row.total_cost);
    current.total += amount;
    if (String(row.payment_status || '').toLowerCase() === 'paid') current.paid += amount;
    if (row.worker_name && !current.workers.includes(row.worker_name)) current.workers.push(row.worker_name);
    laborByJob.set(row.job_id, current);
  }

  const expensesByJob = new Map<string, number>();
  for (const row of expensesRes.data || []) {
    if (!row.job_id) continue;
    expensesByJob.set(row.job_id, (expensesByJob.get(row.job_id) || 0) + money(row.amount));
  }

  const directPaidByJob = new Map<string, number>();
  for (const row of jobPaymentsRes.data || []) {
    if (!row.job_id) continue;
    directPaidByJob.set(row.job_id, (directPaidByJob.get(row.job_id) || 0) + money(row.amount));
  }

  const invoiceByJob = new Map<string, { invoiced: number; paid: number }>();
  for (const row of invoicesRes.data || []) {
    if (!row.job_id) continue;
    const status = String(row.status || row.payment_status || '').toLowerCase();
    if (['cancelled', 'canceled', 'void', 'draft'].includes(status)) continue;
    const current = invoiceByJob.get(row.job_id) || { invoiced: 0, paid: 0 };
    current.invoiced += money(row.amount);
    current.paid += Math.min(money(row.amount), money(row.amount_paid));
    invoiceByJob.set(row.job_id, current);
  }

  const lines = selected.map(({ job }) => {
    const labor = laborByJob.get(job.id) || { total: 0, paid: 0, workers: [] };
    const expectedWorker = money(job.expected_contractor_cost);
    // job_labor is authoritative once labor exists. expected_contractor_cost is only a fallback.
    const workerCost = labor.total > 0 ? labor.total : expectedWorker;
    const linkedExpenses = expensesByJob.get(job.id) || 0;
    const expectedOther = money(job.expected_additional_expense);
    const otherExpenses = linkedExpenses > 0 ? linkedExpenses : expectedOther;
    const customerPrice = money(job.revenue_amount);
    const invoice = invoiceByJob.get(job.id) || { invoiced: 0, paid: 0 };
    const directPaid = directPaidByJob.get(job.id) || 0;
    const paid = Math.max(invoice.paid, directPaid);
    const expected = customerPrice || invoice.invoiced;
    const owed = Math.max(0, expected - paid);
    const expectedProfit = expected - workerCost - otherExpenses;
    const collectedProfit = paid - labor.paid - linkedExpenses;
    const date = job.start_date || (job.scheduled_start ? String(job.scheduled_start).slice(0, 10) : null);

    return [
      `- Job: ${job.title || 'Untitled job'}`,
      job.customer_name ? `customer=${job.customer_name}` : '',
      date ? `date=${date}` : '',
      job.status ? `status=${job.status}` : '',
      `customer price=${moneyLabel(expected)}`,
      `customer paid=${moneyLabel(paid)}`,
      `customer owed=${moneyLabel(owed)}`,
      `worker cost=${moneyLabel(workerCost)}`,
      `worker paid=${moneyLabel(labor.paid)}`,
      `business expenses=${moneyLabel(otherExpenses)}`,
      `expected profit=${moneyLabel(expectedProfit)}`,
      `collected profit=${moneyLabel(collectedProfit)}`,
      labor.workers.length ? `workers=${labor.workers.join(', ')}` : '',
      `open=/jobs/${job.id}`
    ]
      .filter(Boolean)
      .join(' | ');
  });

  return lines.length
    ? `Job finance facts:\n${lines.join('\n')}\n\nFinance rules: use job_labor as the worker-cost source when labor exists; do not add expected_contractor_cost on top of job_labor. Customer price is jobs.revenue_amount. Expected profit = customer price - worker cost - business expenses. Customer owed = expected customer amount - recorded customer payments, never below zero.`
    : '';
}

/**
 * Before calling an AI model, gather relevant workspace records from Supabase.
 * Keeps AI prompts small and grounded in real business data.
 */
export async function prefetchAskEverittContextForAi(
  supabase: SupabaseClient,
  organizationId: string,
  prompt: string
): Promise<AskEverittAiPrefetchedContext> {
  const [search, jobFinanceContext] = await Promise.all([
    runAskEverittSearchEngine(supabase, organizationId, prompt),
    buildJobFinanceContext(supabase, organizationId, prompt)
  ]);

  const recordLines = search.results.slice(0, 12).map((r) => {
    const parts = [`- [${r.type}] ${r.title}`];
    if (r.subtitle) parts.push(`(${r.subtitle})`);
    if (r.status) parts.push(`status: ${r.status}`);
    if (r.date) parts.push(`date: ${r.date}`);
    if (r.href) parts.push(`open: ${r.href}`);
    return parts.join(' ');
  });

  const metricLines = (search.metrics || []).map((m) => `- ${m.label}: ${m.value}`);

  const contextBlock = [
    search.summary,
    metricLines.length ? `Metrics:\n${metricLines.join('\n')}` : '',
    jobFinanceContext,
    recordLines.length ? `Matching records:\n${recordLines.join('\n')}` : search.noResultsHint || ''
  ]
    .filter(Boolean)
    .join('\n\n');

  return {
    summary: search.summary,
    records: search.results,
    metrics: search.metrics,
    ...(contextBlock ? { _contextBlock: contextBlock } : {})
  } as AskEverittAiPrefetchedContext & { _contextBlock?: string };
}

export function formatPrefetchedContextForAi(
  prefetched: AskEverittAiPrefetchedContext & { _contextBlock?: string }
): string {
  if (prefetched._contextBlock) return prefetched._contextBlock;
  return prefetched.summary;
}
