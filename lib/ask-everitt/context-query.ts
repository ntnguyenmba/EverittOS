import type { SupabaseClient } from '@supabase/supabase-js';
import { buildRecord, response } from '@/lib/ask-everitt/search-helpers';
import { queryUnpaidInvoices } from '@/lib/ask-everitt/unpaid-invoices';
import type { AskEverittSearchResponse } from '@/lib/ask-everitt/types';

export type ContextAskLocale = 'en' | 'es' | 'vi';

type PageContext = {
  path: string;
  customerId?: string;
  jobId?: string;
};

function t(locale: ContextAskLocale, en: string, es: string, vi: string): string {
  if (locale === 'es') return es;
  if (locale === 'vi') return vi;
  return en;
}

function parsePageContext(value: string): PageContext {
  const match = value.match(/Current EverittOS page:\s*([^\.\s]+)/i);
  const path = match?.[1] || '';
  const customer = path.match(/^\/customers\/([^/?#]+)/);
  const job = path.match(/^\/jobs\/([^/?#]+)/);
  return {
    path,
    customerId: customer?.[1],
    jobId: job?.[1]
  };
}

function normalize(input: string): string {
  let q = input.replace(/[’]/g, "'").toLowerCase();
  const replacements: Array<[RegExp, string]> = [
    [/\beste cliente\b/g, 'this customer'],
    [/\bcliente actual\b/g, 'this customer'],
    [/\beste trabajo\b/g, 'this job'],
    [/\btrabajo actual\b/g, 'this job'],
    [/\btrabajos?\b/g, 'jobs'],
    [/\bfacturas?\b/g, 'invoices'],
    [/\bestimaciones?|presupuestos?|cotizaciones?\b/g, 'estimates'],
    [/\bpróximo|proximo|siguiente\b/g, 'next'],
    [/\beste cliente|khách hàng này\b/g, 'this customer'],
    [/\bcông việc này\b/g, 'this job'],
    [/\bcông việc\b/g, 'jobs'],
    [/\bhóa đơn\b/g, 'invoices'],
    [/\bước tính|báo giá\b/g, 'estimates'],
    [/\btiếp theo|sắp tới\b/g, 'next']
  ];
  for (const [pattern, replacement] of replacements) q = q.replace(pattern, replacement);
  return q.replace(/\s+/g, ' ').trim();
}

function jobRecord(job: any) {
  return buildRecord('jobs', {
    id: job.id,
    type: 'job',
    title: job.title || job.customer_name || 'Job',
    subtitle: job.customer_name || null,
    status: job.status || null,
    date: job.start_date || job.due_date || job.scheduled_start?.slice?.(0, 10) || null,
    owner: job.assigned_to ? 'Assigned crew' : null,
    href: `/jobs/${job.id}`
  });
}

async function customerJobs(
  supabase: SupabaseClient,
  orgId: string,
  customerId: string,
  locale: ContextAskLocale,
  nextOnly: boolean
): Promise<AskEverittSearchResponse | null> {
  const { data, error } = await supabase
    .from('jobs')
    .select('id, title, customer_name, status, start_date, due_date, scheduled_start, assigned_to, customer_id')
    .eq('organization_id', orgId)
    .eq('customer_id', customerId)
    .limit(300);
  if (error) return null;

  let rows = (data || []).filter((job) => !['cancelled', 'canceled', 'archived'].includes(String(job.status || '').toLowerCase()));
  if (nextOnly) {
    const now = Date.now();
    rows = rows
      .filter((job) => !['completed', 'complete', 'done', 'finished'].includes(String(job.status || '').toLowerCase()))
      .map((job) => {
        const raw = job.scheduled_start || (job.start_date ? `${job.start_date}T00:00:00` : job.due_date ? `${job.due_date}T00:00:00` : null);
        return { job, time: raw ? new Date(raw).getTime() : Number.POSITIVE_INFINITY };
      })
      .filter((entry) => Number.isFinite(entry.time) && entry.time >= now - 12 * 60 * 60 * 1000)
      .sort((a, b) => a.time - b.time)
      .slice(0, 1)
      .map((entry) => entry.job);
  } else {
    rows.sort((a, b) => String(b.scheduled_start || b.start_date || b.due_date || '').localeCompare(String(a.scheduled_start || a.start_date || a.due_date || '')));
  }

  const results = rows.map(jobRecord);
  return response(
    nextOnly
      ? results.length
        ? t(locale, `The next job for this customer is ${results[0].title}${results[0].date ? ` on ${results[0].date}` : ''}.`, `El próximo trabajo de este cliente es ${results[0].title}${results[0].date ? ` el ${results[0].date}` : ''}.`, `Công việc tiếp theo của khách hàng này là ${results[0].title}${results[0].date ? ` vào ${results[0].date}` : ''}.`)
        : t(locale, 'This customer has no upcoming jobs scheduled.', 'Este cliente no tiene próximos trabajos programados.', 'Khách hàng này không có công việc sắp tới đã được lên lịch.')
      : results.length
        ? t(locale, `${results.length} job${results.length === 1 ? '' : 's'} found for this customer.`, `Se encontraron ${results.length} trabajo${results.length === 1 ? '' : 's'} para este cliente.`, `Tìm thấy ${results.length} công việc cho khách hàng này.`)
        : t(locale, 'No jobs found for this customer.', 'No se encontraron trabajos para este cliente.', 'Không tìm thấy công việc cho khách hàng này.'),
    results,
    { sourcesUsed: ['jobs', 'customers'] }
  );
}

async function customerEstimates(
  supabase: SupabaseClient,
  orgId: string,
  customerId: string,
  locale: ContextAskLocale
): Promise<AskEverittSearchResponse | null> {
  const { data, error } = await supabase
    .from('outbound_documents')
    .select('id, subject, recipient_name, status, amount, sent_at, created_at, updated_at')
    .eq('organization_id', orgId)
    .eq('customer_id', customerId)
    .eq('doc_type', 'estimate')
    .in('status', ['draft', 'sent', 'scheduled'])
    .order('updated_at', { ascending: false })
    .limit(100);
  if (error) return null;

  const results = (data || []).map((doc) => buildRecord('documents', {
    id: doc.id,
    type: 'document',
    title: doc.subject || doc.recipient_name || 'Estimate',
    subtitle: doc.amount != null ? `$${Number(doc.amount).toFixed(2)}` : doc.recipient_name || null,
    status: doc.status || null,
    date: (doc.sent_at || doc.created_at || doc.updated_at)?.slice?.(0, 10) || null,
    href: '/estimates'
  }));

  return response(
    results.length
      ? t(locale, `${results.length} open estimate${results.length === 1 ? '' : 's'} for this customer.`, `${results.length} estimaci${results.length === 1 ? 'ón abierta' : 'ones abiertas'} para este cliente.`, `Có ${results.length} báo giá đang mở cho khách hàng này.`)
      : t(locale, 'No open estimates found for this customer.', 'No se encontraron estimaciones abiertas para este cliente.', 'Không tìm thấy báo giá đang mở cho khách hàng này.'),
    results,
    { sourcesUsed: ['documents', 'customers'] }
  );
}

async function currentJob(
  supabase: SupabaseClient,
  orgId: string,
  jobId: string,
  locale: ContextAskLocale
): Promise<AskEverittSearchResponse | null> {
  const { data: job, error } = await supabase
    .from('jobs')
    .select('id, title, customer_name, status, start_date, due_date, scheduled_start, assigned_to')
    .eq('organization_id', orgId)
    .eq('id', jobId)
    .maybeSingle();
  if (error || !job) return null;
  const record = jobRecord(job);
  return response(
    t(locale, `This job is ${record.title}${record.date ? ` on ${record.date}` : ''}${record.status ? ` and is ${record.status}` : ''}.`, `Este trabajo es ${record.title}${record.date ? ` el ${record.date}` : ''}${record.status ? ` y está ${record.status}` : ''}.`, `Công việc này là ${record.title}${record.date ? ` vào ${record.date}` : ''}${record.status ? ` và có trạng thái ${record.status}` : ''}.`),
    [record],
    { sourcesUsed: ['jobs'] }
  );
}

export async function runContextAwareAskQuery(
  supabase: SupabaseClient,
  orgId: string,
  rawQuery: string,
  locale: ContextAskLocale,
  pageContext: string
): Promise<AskEverittSearchResponse | null> {
  const context = parsePageContext(pageContext);
  const q = normalize(rawQuery);

  if (/\b(invoices?|bills?)\b/.test(q) && /\b(unpaid|outstanding|past due|overdue|not paid|owe)\b/.test(q) && !context.customerId) {
    return queryUnpaidInvoices(supabase, orgId);
  }

  if (context.customerId && /\b(this customer|customer)\b/.test(q)) {
    if (/\bnext\b.*\bjobs?\b|\bjobs?\b.*\bnext\b/.test(q)) return customerJobs(supabase, orgId, context.customerId, locale, true);
    if (/\bopen\b.*\bestimates?\b|\bestimates?\b.*\b(open|pending)\b/.test(q)) return customerEstimates(supabase, orgId, context.customerId, locale);
    if (/\binvoices?\b/.test(q)) return queryUnpaidInvoices(supabase, orgId);
    if (/\bjobs?\b/.test(q)) return customerJobs(supabase, orgId, context.customerId, locale, false);
  }

  if (context.jobId && /\b(this job|current job|job details|details for this job)\b/.test(q)) {
    return currentJob(supabase, orgId, context.jobId, locale);
  }

  return null;
}
