import type { SupabaseClient } from '@supabase/supabase-js';
import {
  calculateOutstandingBreakdown,
  formatCurrency,
  type InvoiceMetricRow,
  type InvoicePaymentRow,
  type JobPaymentMetricRow,
  type JobRevenueRow
} from '@/lib/dashboard-metrics';
import type { AskEverittSearchResponse } from '@/lib/ask-everitt/types';
import {
  ASK_EVERITT_QUERY_HANDLERS,
  buildRecord,
  groupResults,
  response,
  runMatchedQueryHandler as runLegacyMatchedQueryHandler
} from './query-handlers';

export type { QueryHandler } from './query-handlers';
export { ASK_EVERITT_QUERY_HANDLERS, buildRecord, groupResults, response };

async function queryCanonicalOutstandingCustomers(
  supabase: SupabaseClient,
  orgId: string
): Promise<AskEverittSearchResponse | null> {
  const [invoicesRes, jobsRes, jobPaymentsRes, invoicePaymentsRes] = await Promise.all([
    supabase
      .from('invoices')
      .select('id, job_id, amount, amount_paid, due_date, payment_status, status')
      .eq('organization_id', orgId),
    supabase
      .from('jobs')
      .select('id, title, customer_name, revenue_amount, status')
      .eq('organization_id', orgId),
    supabase
      .from('job_payments')
      .select('amount, paid_at, job_id')
      .eq('organization_id', orgId),
    supabase
      .from('invoice_payments')
      .select('amount, paid_at, invoice_id')
      .eq('organization_id', orgId)
  ]);

  if (invoicesRes.error || jobsRes.error || jobPaymentsRes.error) return null;

  const jobs = (jobsRes.data || []) as JobRevenueRow[];
  const jobLookup = new Map(
    jobs.map((job) => [
      String(job.id || ''),
      { title: job.title, customer_name: job.customer_name }
    ])
  );

  const breakdown = calculateOutstandingBreakdown({
    invoices: (invoicesRes.data || []) as InvoiceMetricRow[],
    jobs,
    jobPayments: (jobPaymentsRes.data || []) as JobPaymentMetricRow[],
    invoicePayments: invoicePaymentsRes.error
      ? undefined
      : ((invoicePaymentsRes.data || []) as InvoicePaymentRow[]),
    jobLookup
  });

  const grouped = new Map<
    string,
    { name: string; amount: number; href: string; sources: Set<'invoice' | 'job'> }
  >();

  for (const row of breakdown.rows) {
    const name = row.customerName || row.title || 'Customer';
    const key = name.trim().toLowerCase();
    const current = grouped.get(key) || {
      name,
      amount: 0,
      href: row.href,
      sources: new Set<'invoice' | 'job'>()
    };
    current.amount = Number((current.amount + row.amountOwed).toFixed(2));
    current.sources.add(row.sourceType);
    grouped.set(key, current);
  }

  const balances = Array.from(grouped.values())
    .filter((entry) => entry.amount > 0)
    .sort((a, b) => b.amount - a.amount)
    .slice(0, 20);

  if (balances.length === 0) {
    return response('No customers with outstanding balances.', [], {
      sourcesUsed: ['customers', 'invoices', 'jobs', 'payments'],
      metrics: [{ label: 'Still owed', value: formatCurrency(0), href: '/dashboard?detail=outstanding' }]
    });
  }

  const results = balances.map((entry, index) => {
    const sourceLabel =
      entry.sources.size > 1
        ? 'Invoices and jobs'
        : entry.sources.has('invoice')
          ? 'Invoice balance'
          : 'Job balance';

    return buildRecord('customers', {
      id: `outstanding-${index + 1}`,
      title: entry.name,
      subtitle: `${formatCurrency(entry.amount)} owed`,
      status: sourceLabel,
      date: null,
      href: entry.href
    });
  });

  return response(
    `${results.length} customer${results.length === 1 ? '' : 's'} with ${formatCurrency(breakdown.total)} outstanding.`,
    results,
    {
      sourcesUsed: ['customers', 'invoices', 'jobs', 'payments'],
      metrics: [
        { label: 'Still owed', value: formatCurrency(breakdown.total), href: '/dashboard?detail=outstanding' },
        { label: 'Invoice balances', value: formatCurrency(breakdown.invoiceTotal), href: '/invoices' },
        { label: 'Uninvoiced job balances', value: formatCurrency(breakdown.jobTotal), href: '/jobs' }
      ]
    }
  );
}

export async function runMatchedQueryHandler(
  supabase: SupabaseClient,
  orgId: string,
  query: string
): Promise<AskEverittSearchResponse | null> {
  const normalized = query.trim().toLowerCase();
  const asksWhoOwes =
    /\b(customers?|clients?)\b.*\b(owe|owing|outstanding|balance|money)\b|\bwho\b.*\bowe\b/.test(normalized);

  if (asksWhoOwes) {
    const canonical = await queryCanonicalOutstandingCustomers(supabase, orgId);
    if (canonical) return canonical;
  }

  return runLegacyMatchedQueryHandler(supabase, orgId, query);
}
