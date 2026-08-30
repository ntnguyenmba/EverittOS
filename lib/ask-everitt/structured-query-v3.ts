import type { SupabaseClient } from '@supabase/supabase-js';
import { CUSTOMER_LIST_SELECT, customerDisplayName } from '@/lib/customer-record';
import { buildRecord, response } from '@/lib/ask-everitt/search-helpers';
import type { AskEverittSearchResponse } from '@/lib/ask-everitt/types';
import { parseAskFilter, type AskFilter, type AskRelativeTime, type StructuredAskLocale } from '@/lib/ask-everitt/structured-query-v2';

type JobRow = {
  id: string;
  title?: string | null;
  customer_id?: string | null;
  customer_name?: string | null;
  status?: string | null;
  start_date?: string | null;
  due_date?: string | null;
  scheduled_start?: string | null;
  assigned_to?: string | null;
  notes?: string | null;
};

type DateRange = { start: string; end: string };

function t(locale: StructuredAskLocale, en: string, es: string, vi: string): string {
  if (locale === 'es') return es;
  if (locale === 'vi') return vi;
  return en;
}

function isoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function addDays(base: Date, days: number): Date {
  const d = new Date(base);
  d.setDate(d.getDate() + days);
  return d;
}

function startOfWeek(base = new Date()): Date {
  const d = new Date(base);
  const day = d.getDay();
  d.setDate(d.getDate() + (day === 0 ? -6 : 1 - day));
  d.setHours(0, 0, 0, 0);
  return d;
}

function rangeForRelative(relative: AskRelativeTime): DateRange {
  const now = new Date();
  if (relative === 'today') return { start: isoDate(now), end: isoDate(now) };
  if (relative === 'tomorrow') {
    const tomorrow = addDays(now, 1);
    return { start: isoDate(tomorrow), end: isoDate(tomorrow) };
  }
  if (relative === 'this_week' || relative === 'next_week' || relative === 'last_week') {
    const offset = relative === 'next_week' ? 7 : relative === 'last_week' ? -7 : 0;
    const start = addDays(startOfWeek(), offset);
    return { start: isoDate(start), end: isoDate(addDays(start, 6)) };
  }
  const offset = relative === 'last_month' ? -1 : 0;
  const start = new Date(now.getFullYear(), now.getMonth() + offset, 1);
  const end = new Date(now.getFullYear(), now.getMonth() + offset + 1, 0);
  return { start: isoDate(start), end: isoDate(end) };
}

function nextDayDate(day: number): string {
  const d = new Date();
  let diff = day - d.getDay();
  if (diff < 0) diff += 7;
  d.setDate(d.getDate() + diff);
  return isoDate(d);
}

function mergeJobs(...sets: Array<JobRow[] | null | undefined>): JobRow[] {
  const map = new Map<string, JobRow>();
  for (const rows of sets) for (const row of rows || []) map.set(row.id, row);
  return Array.from(map.values());
}

/** Date ranges must use AND bounds per field; never OR the lower and upper bounds separately. */
async function loadJobsForRange(
  supabase: SupabaseClient,
  orgId: string,
  range: DateRange
): Promise<JobRow[] | null> {
  const select = 'id, title, customer_id, customer_name, status, start_date, due_date, scheduled_start, assigned_to, notes';
  const [starts, dues, timed] = await Promise.all([
    supabase.from('jobs').select(select).eq('organization_id', orgId).gte('start_date', range.start).lte('start_date', range.end).limit(1000),
    supabase.from('jobs').select(select).eq('organization_id', orgId).gte('due_date', range.start).lte('due_date', range.end).limit(1000),
    supabase.from('jobs').select(select).eq('organization_id', orgId).gte('scheduled_start', `${range.start}T00:00:00`).lte('scheduled_start', `${range.end}T23:59:59`).limit(1000)
  ]);
  if (starts.error && dues.error && timed.error) return null;
  return mergeJobs(starts.data as JobRow[] | null, dues.data as JobRow[] | null, timed.data as JobRow[] | null);
}

async function loadAllJobs(supabase: SupabaseClient, orgId: string): Promise<JobRow[] | null> {
  const { data, error } = await supabase
    .from('jobs')
    .select('id, title, customer_id, customer_name, status, start_date, due_date, scheduled_start, assigned_to, notes')
    .eq('organization_id', orgId)
    .limit(2000);
  return error ? null : (data || []) as JobRow[];
}

async function loadUpcomingJobs(supabase: SupabaseClient, orgId: string): Promise<JobRow[] | null> {
  const today = isoDate(new Date());
  const future = new Date();
  future.setFullYear(future.getFullYear() + 2);
  return loadJobsForRange(supabase, orgId, { start: today, end: isoDate(future) });
}

function jobMoment(job: JobRow): number {
  const raw = job.scheduled_start || (job.start_date ? `${job.start_date}T00:00:00` : job.due_date ? `${job.due_date}T00:00:00` : null);
  if (!raw) return Number.POSITIVE_INFINITY;
  const value = new Date(raw).getTime();
  return Number.isFinite(value) ? value : Number.POSITIVE_INFINITY;
}

function statusIsClosed(status?: string | null): boolean {
  return ['completed', 'complete', 'done', 'finished', 'closed', 'cancelled', 'canceled', 'archived'].includes(String(status || '').toLowerCase());
}

function applyClockFilter(rows: JobRow[], filter: AskFilter): JobRow[] {
  const startTime = filter.timeRange?.startTime;
  const endTime = filter.timeRange?.endTime;
  if (!startTime && !endTime) return rows;
  const minutes = (value: string) => {
    const [h, m] = value.split(':').map(Number);
    return h * 60 + m;
  };
  const min = startTime ? minutes(startTime) : null;
  const max = endTime ? minutes(endTime) : null;
  return rows.filter((job) => {
    if (!job.scheduled_start) return false;
    const date = new Date(job.scheduled_start);
    const value = date.getHours() * 60 + date.getMinutes();
    return (min == null || value >= min) && (max == null || value <= max);
  });
}

async function resolveCustomers(supabase: SupabaseClient, orgId: string, name: string) {
  const pattern = `%${name.trim()}%`;
  const quoted = `"${pattern}"`;
  const { data, error } = await supabase
    .from('customers')
    .select(CUSTOMER_LIST_SELECT)
    .eq('organization_id', orgId)
    .or(`company_name.ilike.${quoted},contact_name.ilike.${quoted},email.ilike.${quoted},phone.ilike.${quoted}`)
    .limit(25);
  return error ? [] : data || [];
}

async function resolveWorkers(supabase: SupabaseClient, orgId: string, name: string) {
  const { data, error } = await supabase
    .from('workers')
    .select('id, name, role, email')
    .eq('organization_id', orgId)
    .ilike('name', `%${name.trim()}%`)
    .limit(25);
  return error ? [] : data || [];
}

function extractForName(raw: string, entityWord: RegExp): string | null {
  const normalized = raw.replace(/[’]/g, "'").trim();
  const match = normalized.match(new RegExp(`${entityWord.source}[^\\n]*?\\bfor\\s+(?:the\\s+)?(.+?)(?:\\s+family)?[?.!]*$`, 'i'));
  return match?.[1]?.replace(/[?.!]+$/g, '').trim() || null;
}

function extractSimpleCustomerLookup(raw: string): string | null {
  const match = raw.trim().match(/^(?:please\s+)?(?:show|find|lookup|look up|search for)\s+(?:me\s+)?(?:the\s+)?([A-Za-zÀ-ỹ][A-Za-zÀ-ỹ .'-]{1,60}?)(?:\s+family)?[?.!]*$/i);
  const name = match?.[1]?.trim();
  if (!name || /^(jobs?|invoices?|estimates?|workers?|schedule|calendar|customers?|leads?)$/i.test(name)) return null;
  return name;
}

function localizedRecordStatus(locale: StructuredAskLocale, status: 'available' | 'open_estimate' | 'inactive'): string {
  if (status === 'available') return t(locale, 'Available', 'Disponible', 'Có thể làm');
  if (status === 'open_estimate') return t(locale, 'Open estimate', 'Estimación abierta', 'Báo giá đang mở');
  return t(locale, 'Inactive', 'Inactivo', 'Không hoạt động');
}

function jobRecords(rows: JobRow[]) {
  return rows.map((job) => buildRecord('jobs', {
    id: job.id,
    type: 'job',
    title: job.title || job.customer_name || 'Job',
    subtitle: job.customer_name || null,
    status: job.status || null,
    date: job.start_date || job.due_date || job.scheduled_start?.slice(0, 10) || null,
    owner: job.assigned_to ? 'Assigned crew' : null,
    href: `/jobs/${job.id}`
  }));
}

async function runJob(
  supabase: SupabaseClient,
  orgId: string,
  userId: string,
  filter: AskFilter,
  locale: StructuredAskLocale
): Promise<AskEverittSearchResponse | null> {
  let rows: JobRow[] | null;
  if (filter.limit === 1 && filter.sortBy === 'start_time' && !filter.timeRange?.relative && filter.timeRange?.dayOfWeek == null) {
    rows = await loadUpcomingJobs(supabase, orgId);
  } else if (filter.timeRange?.dayOfWeek != null) {
    const date = nextDayDate(filter.timeRange.dayOfWeek);
    rows = await loadJobsForRange(supabase, orgId, { start: date, end: date });
  } else if (filter.timeRange?.relative) {
    rows = await loadJobsForRange(supabase, orgId, rangeForRelative(filter.timeRange.relative));
  } else {
    rows = await loadAllJobs(supabase, orgId);
  }
  if (!rows) return null;

  if (filter.status?.includes('unscheduled')) {
    rows = rows.filter((job) => !job.start_date && !job.scheduled_start && !statusIsClosed(job.status));
  } else if (filter.status?.length) {
    const allowed = new Set(filter.status.map((status) => status.toLowerCase()));
    rows = rows.filter((job) => allowed.has(String(job.status || '').toLowerCase()));
  }

  if (!filter.status?.some((status) => ['cancelled', 'canceled'].includes(status))) {
    rows = rows.filter((job) => !['cancelled', 'canceled', 'archived'].includes(String(job.status || '').toLowerCase()));
  }
  if (filter.isEmergency) rows = rows.filter((job) => /\b(emergency|urgent|high priority)\b/i.test(`${job.title || ''} ${job.notes || ''}`));
  if (filter.assignedToMe) rows = rows.filter((job) => job.assigned_to === userId);
  if (filter.isAssigned === false) rows = rows.filter((job) => !job.assigned_to);
  if (filter.isAssigned === true && !filter.workerName) rows = rows.filter((job) => Boolean(job.assigned_to));

  if (filter.customerName) {
    const customers = await resolveCustomers(supabase, orgId, filter.customerName);
    const ids = new Set(customers.map((customer) => customer.id));
    const name = filter.customerName.toLowerCase();
    rows = rows.filter((job) => (job.customer_id && ids.has(job.customer_id)) || String(job.customer_name || '').toLowerCase().includes(name));
  }

  if (filter.workerName) {
    const workers = await resolveWorkers(supabase, orgId, filter.workerName);
    const ids = new Set(workers.map((worker) => worker.id));
    rows = rows.filter((job) => job.assigned_to && ids.has(job.assigned_to));
  }

  rows = applyClockFilter(rows, filter).sort((a, b) => jobMoment(a) - jobMoment(b));
  if (filter.sortDir === 'desc') rows.reverse();
  if (filter.limit) rows = rows.slice(0, filter.limit);

  const results = jobRecords(rows);
  if (filter.aggregation === 'count') {
    return response(
      t(locale, `${results.length} matching jobs.`, `${results.length} trabajos coincidentes.`, `Có ${results.length} công việc phù hợp.`),
      results.slice(0, 20),
      { sourcesUsed: ['jobs', 'schedule'], metrics: [{ label: t(locale, 'Jobs', 'Trabajos', 'Công việc'), value: String(results.length), href: '/jobs' }] }
    );
  }

  if (filter.limit === 1 && filter.sortBy === 'start_time') {
    const next = results[0];
    return response(
      next
        ? t(locale, `Your next job is ${next.title}${next.subtitle ? ` · ${next.subtitle}` : ''} on ${next.date || 'the next scheduled date'}.`, `Su próximo trabajo es ${next.title}${next.subtitle ? ` · ${next.subtitle}` : ''} el ${next.date || 'próximo día programado'}.`, `Công việc tiếp theo là ${next.title}${next.subtitle ? ` · ${next.subtitle}` : ''} vào ${next.date || 'ngày được lên lịch tiếp theo'}.`)
        : t(locale, 'No upcoming jobs are scheduled.', 'No hay próximos trabajos programados.', 'Không có công việc sắp tới đã được lên lịch.'),
      next ? [next] : [],
      { sourcesUsed: ['jobs', 'schedule'] }
    );
  }

  return response(
    results.length
      ? t(locale, `${results.length} matching job${results.length === 1 ? '' : 's'}.`, `${results.length} trabajo${results.length === 1 ? '' : 's'} coincidente${results.length === 1 ? '' : 's'}.`, `Có ${results.length} công việc phù hợp.`)
      : t(locale, 'No matching jobs found.', 'No se encontraron trabajos coincidentes.', 'Không tìm thấy công việc phù hợp.'),
    results,
    { sourcesUsed: ['jobs', 'schedule'] }
  );
}

async function runCustomerLookup(
  supabase: SupabaseClient,
  orgId: string,
  name: string,
  locale: StructuredAskLocale
): Promise<AskEverittSearchResponse> {
  const customers = await resolveCustomers(supabase, orgId, name);
  const results = customers.map((customer) => buildRecord('customers', {
    id: customer.id,
    type: 'customer',
    title: customerDisplayName(customer),
    subtitle: [customer.email, customer.phone].filter(Boolean).join(' · ') || null,
    status: customer.pipeline_stage || null,
    date: customer.updated_at?.slice?.(0, 10) || null,
    href: `/customers/${customer.id}`
  }));
  return response(
    results.length
      ? t(locale, `${results.length} customer match${results.length === 1 ? '' : 'es'} for ${name}.`, `${results.length} coincidencia${results.length === 1 ? '' : 's'} de cliente para ${name}.`, `Tìm thấy ${results.length} khách hàng khớp với ${name}.`)
      : t(locale, `No customers found matching ${name}.`, `No se encontraron clientes que coincidan con ${name}.`, `Không tìm thấy khách hàng khớp với ${name}.`),
    results,
    { sourcesUsed: ['customers'] }
  );
}

async function runCustomer(
  supabase: SupabaseClient,
  orgId: string,
  filter: AskFilter,
  locale: StructuredAskLocale
): Promise<AskEverittSearchResponse | null> {
  if (filter.intent === 'customers_open_estimates') {
    const { data: docs, error } = await supabase
      .from('outbound_documents')
      .select('customer_id')
      .eq('organization_id', orgId)
      .eq('doc_type', 'estimate')
      .in('status', ['draft', 'sent', 'scheduled'])
      .not('customer_id', 'is', null)
      .limit(1000);
    if (error) return null;
    const ids = Array.from(new Set((docs || []).map((doc) => doc.customer_id).filter(Boolean))) as string[];
    if (!ids.length) return response(t(locale, 'No customers have open estimates.', 'Ningún cliente tiene estimaciones abiertas.', 'Không có khách hàng nào có báo giá đang mở.'), [], { sourcesUsed: ['customers', 'documents'] });
    const { data: customers } = await supabase.from('customers').select(CUSTOMER_LIST_SELECT).eq('organization_id', orgId).in('id', ids).limit(200);
    const results = (customers || []).map((customer) => buildRecord('customers', {
      id: customer.id,
      type: 'customer',
      title: customerDisplayName(customer),
      subtitle: customer.email || null,
      status: localizedRecordStatus(locale, 'open_estimate'),
      date: customer.updated_at?.slice?.(0, 10) || null,
      href: `/customers/${customer.id}`
    }));
    return response(t(locale, `${results.length} customer${results.length === 1 ? '' : 's'} with open estimates.`, `${results.length} cliente${results.length === 1 ? '' : 's'} con estimaciones abiertas.`, `Có ${results.length} khách hàng có báo giá đang mở.`), results, { sourcesUsed: ['customers', 'documents'] });
  }

  if (filter.inactiveDays) {
    const cutoff = isoDate(addDays(new Date(), -filter.inactiveDays));
    const [{ data: customers, error: customerError }, recentByStart, recentByCreated] = await Promise.all([
      supabase.from('customers').select(CUSTOMER_LIST_SELECT).eq('organization_id', orgId).limit(1000),
      supabase.from('jobs').select('customer_id').eq('organization_id', orgId).gte('start_date', cutoff).limit(5000),
      supabase.from('jobs').select('customer_id').eq('organization_id', orgId).gte('created_at', `${cutoff}T00:00:00`).limit(5000)
    ]);
    if (customerError || (recentByStart.error && recentByCreated.error)) return null;
    const active = new Set([...(recentByStart.data || []), ...(recentByCreated.data || [])].map((job) => job.customer_id).filter(Boolean));
    const inactive = (customers || []).filter((customer) => !active.has(customer.id)).slice(0, 200);
    const results = inactive.map((customer) => buildRecord('customers', {
      id: customer.id,
      type: 'customer',
      title: customerDisplayName(customer),
      subtitle: customer.email || null,
      status: localizedRecordStatus(locale, 'inactive'),
      date: customer.updated_at?.slice?.(0, 10) || null,
      href: `/customers/${customer.id}`
    }));
    return response(
      results.length
        ? t(locale, `${results.length} customer${results.length === 1 ? '' : 's'} with no jobs in the last ${filter.inactiveDays} days.`, `${results.length} cliente${results.length === 1 ? '' : 's'} sin trabajos en los últimos ${filter.inactiveDays} días.`, `Có ${results.length} khách hàng không có công việc trong ${filter.inactiveDays} ngày qua.`)
        : t(locale, `No inactive customers found for the last ${filter.inactiveDays} days.`, `No se encontraron clientes inactivos en los últimos ${filter.inactiveDays} días.`, `Không tìm thấy khách hàng không hoạt động trong ${filter.inactiveDays} ngày qua.`),
      results,
      { sourcesUsed: ['customers', 'jobs'] }
    );
  }

  if (filter.customerName) return runCustomerLookup(supabase, orgId, filter.customerName, locale);
  return null;
}

async function runInvoice(
  supabase: SupabaseClient,
  orgId: string,
  filter: AskFilter,
  raw: string,
  locale: StructuredAskLocale
): Promise<AskEverittSearchResponse | null> {
  let query = supabase
    .from('invoices')
    .select('id, customer_id, description, amount, amount_paid, status, due_date, created_at')
    .eq('organization_id', orgId);

  if (filter.timeRange?.relative) {
    const range = rangeForRelative(filter.timeRange.relative);
    query = query.gte('created_at', `${range.start}T00:00:00`).lte('created_at', `${range.end}T23:59:59`);
  }

  const { data, error } = await query.limit(1000);
  if (error) return null;
  let invoices = data || [];

  const customerName = filter.customerName || extractForName(raw, /invoices?|bills?|payments?/i);
  if (customerName) {
    const customers = await resolveCustomers(supabase, orgId, customerName);
    const ids = new Set(customers.map((customer) => customer.id));
    invoices = invoices.filter((invoice) => invoice.customer_id && ids.has(invoice.customer_id));
  }

  const normalized = raw.toLowerCase();
  const overdue = /\b(overdue|past due|late|vencid|atrasad|quá hạn|trễ hạn)\b/i.test(normalized);
  if (filter.isPaid === false || overdue) {
    invoices = invoices.filter((invoice) => Math.max(0, Number(invoice.amount || 0) - Number(invoice.amount_paid || 0)) > 0 && !['paid', 'void', 'cancelled', 'canceled'].includes(String(invoice.status || '').toLowerCase()));
  }
  if (filter.isPaid === true) invoices = invoices.filter((invoice) => String(invoice.status || '').toLowerCase() === 'paid' || Number(invoice.amount_paid || 0) >= Number(invoice.amount || 0));
  if (overdue) invoices = invoices.filter((invoice) => invoice.due_date && invoice.due_date < isoDate(new Date()));
  if (filter.minAmount != null) invoices = invoices.filter((invoice) => Math.max(0, Number(invoice.amount || 0) - Number(invoice.amount_paid || 0)) >= filter.minAmount!);
  if (filter.maxAmount != null) invoices = invoices.filter((invoice) => Number(invoice.amount || 0) <= filter.maxAmount!);

  if (filter.aggregation === 'sum') {
    const total = invoices.reduce((sum, invoice) => sum + Number(invoice.amount || 0), 0);
    return response(
      t(locale, `Invoice total: $${total.toFixed(2)}.`, `Total facturado: $${total.toFixed(2)}.`, `Tổng hóa đơn: $${total.toFixed(2)}.`),
      [],
      { sourcesUsed: ['invoices'], metrics: [{ label: t(locale, 'Invoice total', 'Total facturado', 'Tổng hóa đơn'), value: `$${total.toFixed(2)}`, href: '/invoices' }] }
    );
  }

  const results = invoices.map((invoice) => {
    const owed = Math.max(0, Number(invoice.amount || 0) - Number(invoice.amount_paid || 0));
    return buildRecord('invoices', {
      id: invoice.id,
      type: 'invoice',
      title: invoice.description || `Invoice $${Number(invoice.amount || 0).toFixed(2)}`,
      subtitle: owed > 0 ? t(locale, `$${owed.toFixed(2)} outstanding`, `$${owed.toFixed(2)} pendiente`, `Còn thiếu $${owed.toFixed(2)}`) : null,
      status: invoice.status || null,
      date: invoice.due_date || invoice.created_at?.slice?.(0, 10) || null,
      href: '/invoices'
    });
  });
  return response(
    results.length
      ? t(locale, `${results.length} matching invoice${results.length === 1 ? '' : 's'}.`, `${results.length} factura${results.length === 1 ? '' : 's'} coincidente${results.length === 1 ? '' : 's'}.`, `Có ${results.length} hóa đơn phù hợp.`)
      : t(locale, 'No matching invoices found.', 'No se encontraron facturas coincidentes.', 'Không tìm thấy hóa đơn phù hợp.'),
    results,
    { sourcesUsed: ['invoices'] }
  );
}

async function runEstimate(
  supabase: SupabaseClient,
  orgId: string,
  filter: AskFilter,
  raw: string,
  locale: StructuredAskLocale
): Promise<AskEverittSearchResponse | null> {
  let query = supabase
    .from('outbound_documents')
    .select('id, subject, recipient_name, recipient_email, status, amount, customer_id, sent_at, created_at, updated_at')
    .eq('organization_id', orgId)
    .eq('doc_type', 'estimate');

  const normalized = raw.toLowerCase();
  if (/\b(sent|enviad|đã gửi)\b/i.test(normalized)) query = query.eq('status', 'sent');
  else if (/\b(open|pending|waiting|abiert|pendiente|đang mở|chờ)\b/i.test(normalized)) query = query.in('status', ['draft', 'sent', 'scheduled']);

  if (filter.timeRange?.relative) {
    const range = rangeForRelative(filter.timeRange.relative);
    const field = /\b(sent|enviad|đã gửi)\b/i.test(normalized) ? 'sent_at' : 'created_at';
    query = query.gte(field, `${range.start}T00:00:00`).lte(field, `${range.end}T23:59:59`);
  }

  const { data, error } = await query.order('updated_at', { ascending: false }).limit(500);
  if (error) return null;
  let estimates = data || [];
  const customerName = filter.customerName || extractForName(raw, /estimates?|quotes?|proposals?/i);
  if (customerName) {
    const customers = await resolveCustomers(supabase, orgId, customerName);
    const ids = new Set(customers.map((customer) => customer.id));
    estimates = estimates.filter((estimate) => estimate.customer_id && ids.has(estimate.customer_id));
  }
  if (filter.minAmount != null) estimates = estimates.filter((estimate) => Number(estimate.amount || 0) >= filter.minAmount!);

  const results = estimates.map((estimate) => buildRecord('documents', {
    id: estimate.id,
    type: 'document',
    title: estimate.subject || estimate.recipient_name || t(locale, 'Estimate', 'Estimación', 'Báo giá'),
    subtitle: [estimate.recipient_name, estimate.amount != null ? `$${Number(estimate.amount).toFixed(2)}` : null].filter(Boolean).join(' · ') || null,
    status: estimate.status || null,
    date: (estimate.sent_at || estimate.created_at || estimate.updated_at)?.slice?.(0, 10) || null,
    href: '/estimates'
  }));
  return response(
    results.length
      ? t(locale, `${results.length} matching estimate${results.length === 1 ? '' : 's'}.`, `${results.length} estimaci${results.length === 1 ? 'ón' : 'ones'} coincidente${results.length === 1 ? '' : 's'}.`, `Có ${results.length} báo giá phù hợp.`)
      : t(locale, 'No matching estimates found.', 'No se encontraron estimaciones coincidentes.', 'Không tìm thấy báo giá phù hợp.'),
    results,
    { sourcesUsed: ['documents'] }
  );
}

async function runWorker(
  supabase: SupabaseClient,
  orgId: string,
  filter: AskFilter,
  locale: StructuredAskLocale
): Promise<AskEverittSearchResponse | null> {
  if (filter.intent === 'free_workers') {
    let date = isoDate(new Date());
    if (filter.timeRange?.dayOfWeek != null) date = nextDayDate(filter.timeRange.dayOfWeek);
    else if (filter.timeRange?.relative) date = rangeForRelative(filter.timeRange.relative).start;
    const [workers, jobs] = await Promise.all([
      resolveWorkers(supabase, orgId, ''),
      loadJobsForRange(supabase, orgId, { start: date, end: date })
    ]);
    if (!jobs) return null;
    const busy = new Set(jobs.filter((job) => !['cancelled', 'canceled'].includes(String(job.status || '').toLowerCase())).map((job) => job.assigned_to).filter(Boolean));
    const free = workers.filter((worker) => !busy.has(worker.id));
    const results = free.map((worker) => buildRecord('workers', {
      id: worker.id,
      type: 'worker',
      title: worker.name || 'Worker',
      subtitle: worker.email || null,
      status: localizedRecordStatus(locale, 'available'),
      owner: worker.name || null,
      href: '/workers'
    }));
    return response(
      results.length
        ? t(locale, `${results.length} worker${results.length === 1 ? '' : 's'} appear free on ${date}.`, `${results.length} persona${results.length === 1 ? '' : 's'} parece${results.length === 1 ? '' : 'n'} libre${results.length === 1 ? '' : 's'} el ${date}.`, `Có ${results.length} nhân viên có vẻ rảnh vào ${date}.`)
        : t(locale, `No workers appear free on ${date}.`, `No parece haber personal libre el ${date}.`, `Không có nhân viên nào có vẻ rảnh vào ${date}.`),
      results,
      { sourcesUsed: ['workers', 'jobs', 'schedule'] }
    );
  }

  if (filter.aggregation === 'count' && filter.sortDir === 'desc') {
    const range = rangeForRelative(filter.timeRange?.relative || 'this_month');
    const jobs = await loadJobsForRange(supabase, orgId, range);
    if (!jobs) return null;
    const counts = new Map<string, number>();
    for (const job of jobs) {
      if (!job.assigned_to || !['completed', 'complete', 'done', 'finished'].includes(String(job.status || '').toLowerCase())) continue;
      counts.set(job.assigned_to, (counts.get(job.assigned_to) || 0) + 1);
    }
    const sorted = Array.from(counts.entries()).sort((a, b) => b[1] - a[1]).slice(0, 10);
    if (!sorted.length) return response(t(locale, 'No completed assigned jobs were found for that period.', 'No se encontraron trabajos completados y asignados en ese período.', 'Không tìm thấy công việc đã hoàn thành và được phân công trong khoảng thời gian đó.'), [], { sourcesUsed: ['jobs', 'workers'] });
    const ids = sorted.map(([id]) => id);
    const { data: workers } = await supabase.from('workers').select('id, name, role').eq('organization_id', orgId).in('id', ids);
    const byId = new Map((workers || []).map((worker) => [worker.id, worker]));
    const results = sorted.map(([id, count]) => {
      const worker = byId.get(id);
      return buildRecord('workers', { id, type: 'worker', title: worker?.name || 'Worker', subtitle: t(locale, `${count} completed jobs`, `${count} trabajos completados`, `${count} công việc đã hoàn thành`), status: worker?.role || null, owner: worker?.name || null, href: '/workers' });
    });
    return response(t(locale, `${results[0].title} completed the most jobs (${sorted[0][1]}).`, `${results[0].title} completó más trabajos (${sorted[0][1]}).`, `${results[0].title} hoàn thành nhiều công việc nhất (${sorted[0][1]}).`), results, { sourcesUsed: ['jobs', 'workers'] });
  }

  return null;
}

async function runLead(
  supabase: SupabaseClient,
  orgId: string,
  filter: AskFilter,
  locale: StructuredAskLocale
): Promise<AskEverittSearchResponse | null> {
  let query = supabase.from('customers').select(CUSTOMER_LIST_SELECT).eq('organization_id', orgId).in('pipeline_stage', ['lead', 'qualified']);
  if (filter.timeRange?.relative) {
    const range = rangeForRelative(filter.timeRange.relative);
    query = query.gte('created_at', `${range.start}T00:00:00`).lte('created_at', `${range.end}T23:59:59`);
  }
  const { data, error } = await query.order('created_at', { ascending: false }).limit(500);
  if (error) return null;
  let leads = data || [];
  if (filter.intent === 'waiting_estimate' && leads.length) {
    const ids = leads.map((lead) => lead.id);
    const { data: estimates } = await supabase.from('outbound_documents').select('customer_id').eq('organization_id', orgId).eq('doc_type', 'estimate').in('customer_id', ids).limit(2000);
    const withEstimate = new Set((estimates || []).map((estimate) => estimate.customer_id).filter(Boolean));
    leads = leads.filter((lead) => !withEstimate.has(lead.id));
  }
  const results = leads.map((lead) => buildRecord('leads', { id: lead.id, type: 'lead', title: customerDisplayName(lead), subtitle: [lead.email, lead.phone].filter(Boolean).join(' · ') || null, status: lead.pipeline_stage || null, date: lead.created_at?.slice?.(0, 10) || null, href: `/customers/${lead.id}` }));
  return response(
    results.length ? t(locale, `${results.length} matching request${results.length === 1 ? '' : 's'}.`, `${results.length} solicitud${results.length === 1 ? '' : 'es'} coincidente${results.length === 1 ? '' : 's'}.`, `Có ${results.length} yêu cầu phù hợp.`) : t(locale, 'No matching requests found.', 'No se encontraron solicitudes coincidentes.', 'Không tìm thấy yêu cầu phù hợp.'),
    results,
    { sourcesUsed: ['leads', 'customers'] }
  );
}

function enrichFilter(raw: string, filter: AskFilter): AskFilter {
  const normalized = raw.replace(/[’]/g, "'").toLowerCase();
  if (filter.entity === 'invoice') {
    if (/\b(overdue|past due|late|vencid|atrasad|quá hạn|trễ hạn)\b/i.test(normalized)) {
      filter.status = [...(filter.status || []), 'overdue'];
      filter.isPaid = false;
    }
    const customer = extractForName(raw, /invoices?|bills?|payments?/i);
    if (customer) filter.customerName = customer;
  }
  if (filter.entity === 'estimate') {
    const customer = extractForName(raw, /estimates?|quotes?|proposals?/i);
    if (customer) filter.customerName = customer;
  }
  if ((filter.entity === 'job' || filter.entity === 'schedule') && /\bwhat(?:'s| is) left\b/i.test(normalized)) {
    filter.status = ['open', 'active', 'pending', 'scheduled'];
  }
  if (filter.entity === 'job' && /\bnext\b/i.test(normalized) && !filter.limit) {
    filter.sortBy = 'start_time';
    filter.sortDir = 'asc';
    filter.limit = 1;
  }
  return filter;
}

export async function runStructuredNaturalQueryV3(
  supabase: SupabaseClient,
  orgId: string,
  userId: string,
  rawQuery: string,
  locale: StructuredAskLocale
): Promise<AskEverittSearchResponse | null> {
  const simpleCustomer = extractSimpleCustomerLookup(rawQuery);
  if (simpleCustomer) return runCustomerLookup(supabase, orgId, simpleCustomer, locale);

  let filter = parseAskFilter(rawQuery);
  if (!filter && /\b(this week|today|tomorrow|next week|last week)\b/i.test(rawQuery) && /\b(everything|anything|what(?:'s| is) on)\b/i.test(rawQuery)) {
    const relative: AskRelativeTime = /\btomorrow\b/i.test(rawQuery) ? 'tomorrow' : /\btoday\b/i.test(rawQuery) ? 'today' : /\bnext week\b/i.test(rawQuery) ? 'next_week' : /\blast week\b/i.test(rawQuery) ? 'last_week' : 'this_week';
    filter = { entity: 'job', timeRange: { relative }, confidence: 0.9, intent: 'generic' };
  }
  if (!filter || filter.confidence < 0.55) return null;
  filter = enrichFilter(rawQuery, filter);
  if (filter.entity === 'schedule') filter.entity = 'job';

  if (filter.entity === 'job') return runJob(supabase, orgId, userId, filter, locale);
  if (filter.entity === 'customer') return runCustomer(supabase, orgId, filter, locale);
  if (filter.entity === 'invoice') return runInvoice(supabase, orgId, filter, rawQuery, locale);
  if (filter.entity === 'estimate') return runEstimate(supabase, orgId, filter, rawQuery, locale);
  if (filter.entity === 'worker') return runWorker(supabase, orgId, filter, locale);
  if (filter.entity === 'lead') return runLead(supabase, orgId, filter, locale);
  return null;
}
