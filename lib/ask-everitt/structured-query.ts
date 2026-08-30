import type { SupabaseClient } from '@supabase/supabase-js';
import { buildRecord, response } from '@/lib/ask-everitt/search-helpers';
import type { AskEverittSearchResponse } from '@/lib/ask-everitt/types';

export type StructuredAskLocale = 'en' | 'es' | 'vi';

type DateRange = { start: string; end: string };

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
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

function weekRange(offsetWeeks = 0): DateRange {
  const start = addDays(startOfWeek(), offsetWeeks * 7);
  const end = addDays(start, 6);
  return { start: isoDate(start), end: isoDate(end) };
}

function monthRange(offsetMonths = 0): DateRange {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth() + offsetMonths, 1);
  const end = new Date(now.getFullYear(), now.getMonth() + offsetMonths + 1, 0);
  return { start: isoDate(start), end: isoDate(end) };
}

const DAY_NAMES = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'] as const;

function nextDayDate(day: number): string {
  const d = new Date();
  let diff = day - d.getDay();
  if (diff < 0) diff += 7;
  d.setDate(d.getDate() + diff);
  return isoDate(d);
}

function extractDay(query: string): number | null {
  const q = query.toLowerCase();
  for (let i = 0; i < DAY_NAMES.length; i++) {
    if (new RegExp(`\\b${DAY_NAMES[i]}\\b`).test(q)) return i;
  }
  return null;
}

function extractAmount(query: string): number | null {
  const match = query.match(/(?:\$|usd\s*)?([0-9][0-9,]*(?:\.[0-9]{1,2})?)/i);
  if (!match) return null;
  const value = Number(match[1].replace(/,/g, ''));
  return Number.isFinite(value) ? value : null;
}

function extractTime(query: string): { hour: number; minute: number; direction: 'after' | 'before' } | null {
  const match = query.match(/\b(after|before)\s+(\d{1,2})(?::(\d{2}))?\s*(am|pm)?\b/i);
  if (!match) return null;
  let hour = Number(match[2]);
  const minute = Number(match[3] || 0);
  const ampm = (match[4] || '').toLowerCase();
  if (ampm === 'pm' && hour < 12) hour += 12;
  if (ampm === 'am' && hour === 12) hour = 0;
  if (!ampm && hour >= 1 && hour <= 7) hour += 12;
  if (hour > 23 || minute > 59) return null;
  return { hour, minute, direction: match[1].toLowerCase() as 'after' | 'before' };
}

function canonicalize(query: string): string {
  let q = query
    .replace(/[’]/g, "'")
    .toLowerCase()
    .replace(/\b(can you|could you|would you|please|pls|show me|tell me|find me|i need|i want|give me|list all|list the)\b/g, ' ');

  const replacements: Array<[RegExp, string]> = [
    // Spanish
    [/\btrabajos?\b/g, 'jobs'], [/\bclientes?\b/g, 'customers'], [/\btrabajadores?|empleados?|personal\b/g, 'workers'],
    [/\bfacturas?\b/g, 'invoices'], [/\bestimaciones?|presupuestos?|cotizaciones?\b/g, 'estimates'], [/\bsolicitudes?|prospectos?\b/g, 'leads'],
    [/\bhoy\b/g, 'today'], [/\bmañana\b/g, 'tomorrow'], [/\besta semana\b/g, 'this week'], [/\bsemana pasada\b/g, 'last week'],
    [/\beste mes\b/g, 'this month'], [/\bmes pasado\b/g, 'last month'], [/\bsin pagar|no pagad[oa]s?\b/g, 'unpaid'],
    [/\bvencid[oa]s?|atrasad[oa]s?\b/g, 'overdue'], [/\bsin asignar\b/g, 'unassigned'], [/\bcompletad[oa]s?|terminad[oa]s?\b/g, 'completed'],
    [/\blunes\b/g, 'monday'], [/\bmartes\b/g, 'tuesday'], [/\bmiércoles|miercoles\b/g, 'wednesday'], [/\bjueves\b/g, 'thursday'],
    [/\bviernes\b/g, 'friday'], [/\bsábado|sabado\b/g, 'saturday'], [/\bdomingo\b/g, 'sunday'], [/\blibre|disponible\b/g, 'free'],
    // Vietnamese
    [/\bcông việc|việc làm\b/g, 'jobs'], [/\bkhách hàng\b/g, 'customers'], [/\bnhân viên|đội ngũ|người làm\b/g, 'workers'],
    [/\bhóa đơn\b/g, 'invoices'], [/\bước tính|báo giá\b/g, 'estimates'], [/\bkhách tiềm năng|yêu cầu\b/g, 'leads'],
    [/\bhôm nay\b/g, 'today'], [/\bngày mai\b/g, 'tomorrow'], [/\btuần này\b/g, 'this week'], [/\btuần trước\b/g, 'last week'],
    [/\btháng này\b/g, 'this month'], [/\btháng trước\b/g, 'last month'], [/\bchưa thanh toán|chưa trả\b/g, 'unpaid'],
    [/\bquá hạn|trễ hạn\b/g, 'overdue'], [/\bchưa phân công\b/g, 'unassigned'], [/\bhoàn thành|đã xong\b/g, 'completed'],
    [/\bthứ hai\b/g, 'monday'], [/\bthứ ba\b/g, 'tuesday'], [/\bthứ tư\b/g, 'wednesday'], [/\bthứ năm\b/g, 'thursday'],
    [/\bthứ sáu\b/g, 'friday'], [/\bthứ bảy\b/g, 'saturday'], [/\bchủ nhật\b/g, 'sunday'], [/\brảnh\b/g, 'free']
  ];
  for (const [pattern, replacement] of replacements) q = q.replace(pattern, replacement);
  return q.replace(/[^a-z0-9$.'@\-\s]/g, ' ').replace(/\s+/g, ' ').trim();
}

function t(locale: StructuredAskLocale, en: string, es: string, vi: string): string {
  if (locale === 'es') return es;
  if (locale === 'vi') return vi;
  return en;
}

function jobRecords(rows: any[]) {
  return rows.map((job) => buildRecord('jobs', {
    id: job.id,
    type: 'job',
    title: job.title || job.customer_name || 'Job',
    subtitle: job.customer_name || null,
    status: job.status || null,
    date: job.start_date || job.due_date || job.scheduled_start?.slice?.(0, 10) || null,
    owner: job.assigned_to ? 'Assigned crew' : null,
    href: `/jobs/${job.id}`
  }));
}

async function queryJobsOnDate(
  supabase: SupabaseClient,
  orgId: string,
  date: string,
  locale: StructuredAskLocale,
  timeFilter?: { hour: number; minute: number; direction: 'after' | 'before' }
): Promise<AskEverittSearchResponse | null> {
  const { data, error } = await supabase
    .from('jobs')
    .select('id, title, customer_name, status, start_date, due_date, scheduled_start, assigned_to')
    .eq('organization_id', orgId)
    .or(`start_date.eq.${date},due_date.eq.${date},scheduled_start.gte.${date}T00:00:00,scheduled_start.lte.${date}T23:59:59`)
    .limit(100);
  if (error) return null;

  let rows = (data || []).filter((j) => !['cancelled', 'canceled', 'archived'].includes(String(j.status || '').toLowerCase()));
  if (timeFilter) {
    const cutoff = timeFilter.hour * 60 + timeFilter.minute;
    rows = rows.filter((j) => {
      if (!j.scheduled_start) return false;
      const d = new Date(j.scheduled_start);
      const minutes = d.getHours() * 60 + d.getMinutes();
      return timeFilter.direction === 'after' ? minutes > cutoff : minutes < cutoff;
    });
  }
  rows.sort((a, b) => String(a.scheduled_start || a.start_date || a.due_date || '').localeCompare(String(b.scheduled_start || b.start_date || b.due_date || '')));
  const results = jobRecords(rows);
  const summary = results.length
    ? t(locale, `${results.length} job${results.length === 1 ? '' : 's'} scheduled for ${date}.`, `${results.length} trabajo${results.length === 1 ? '' : 's'} programado${results.length === 1 ? '' : 's'} para ${date}.`, `${results.length} công việc được lên lịch vào ${date}.`)
    : t(locale, `No jobs are scheduled for ${date}.`, `No hay trabajos programados para ${date}.`, `Không có công việc nào được lên lịch vào ${date}.`);
  return response(summary, results, { sourcesUsed: ['jobs', 'schedule'] });
}

async function queryJobsRange(
  supabase: SupabaseClient,
  orgId: string,
  range: DateRange,
  locale: StructuredAskLocale,
  opts?: { statuses?: string[]; unassigned?: boolean; mine?: string; label?: string }
): Promise<AskEverittSearchResponse | null> {
  const { data, error } = await supabase
    .from('jobs')
    .select('id, title, customer_name, status, start_date, due_date, scheduled_start, assigned_to, completed_at')
    .eq('organization_id', orgId)
    .gte('start_date', range.start)
    .lte('start_date', range.end)
    .limit(300);
  if (error) return null;
  let rows = data || [];
  if (opts?.statuses?.length) rows = rows.filter((j) => opts.statuses!.includes(String(j.status || '').toLowerCase()));
  if (opts?.unassigned) rows = rows.filter((j) => !j.assigned_to);
  if (opts?.mine) rows = rows.filter((j) => j.assigned_to === opts.mine);
  const results = jobRecords(rows);
  const label = opts?.label || `${range.start} to ${range.end}`;
  return response(
    results.length
      ? t(locale, `${results.length} matching job${results.length === 1 ? '' : 's'} for ${label}.`, `${results.length} trabajo${results.length === 1 ? '' : 's'} coincidente${results.length === 1 ? '' : 's'} para ${label}.`, `${results.length} công việc phù hợp trong ${label}.`)
      : t(locale, `No matching jobs for ${label}.`, `No hay trabajos coincidentes para ${label}.`, `Không có công việc phù hợp trong ${label}.`),
    results,
    { sourcesUsed: ['jobs', 'schedule'] }
  );
}

async function queryUnscheduledJobs(supabase: SupabaseClient, orgId: string, locale: StructuredAskLocale) {
  const { data, error } = await supabase
    .from('jobs')
    .select('id, title, customer_name, status, start_date, due_date, scheduled_start, assigned_to')
    .eq('organization_id', orgId)
    .limit(300);
  if (error) return null;
  const rows = (data || []).filter((j) => !j.start_date && !j.scheduled_start && !['completed', 'complete', 'cancelled', 'canceled', 'archived'].includes(String(j.status || '').toLowerCase()));
  const results = jobRecords(rows);
  return response(
    results.length ? t(locale, `${results.length} job${results.length === 1 ? '' : 's'} still need scheduling.`, `${results.length} trabajo${results.length === 1 ? '' : 's'} todavía necesita${results.length === 1 ? '' : 'n'} fecha.`, `${results.length} công việc vẫn cần được lên lịch.`) : t(locale, 'No jobs need scheduling.', 'No hay trabajos que necesiten programación.', 'Không có công việc nào cần lên lịch.'),
    results,
    { sourcesUsed: ['jobs', 'schedule'] }
  );
}

function extractTailName(q: string, marker: RegExp): string | null {
  const match = q.match(marker);
  const raw = match?.[1]?.trim();
  if (!raw) return null;
  return raw.replace(/\b(today|tomorrow|this week|last week|this month|last month|open|unfinished|completed|done|unpaid|overdue)\b.*$/i, '').trim() || null;
}

async function queryJobsForCustomer(supabase: SupabaseClient, orgId: string, name: string, locale: StructuredAskLocale) {
  const quoted = `"%${name}%"`;
  const { data, error } = await supabase
    .from('jobs')
    .select('id, title, customer_name, status, start_date, due_date, scheduled_start, assigned_to')
    .eq('organization_id', orgId)
    .ilike('customer_name', `%${name}%`)
    .order('start_date', { ascending: false })
    .limit(50);
  if (error) return null;
  const results = jobRecords(data || []);
  return response(
    results.length ? t(locale, `${results.length} job${results.length === 1 ? '' : 's'} found for ${name}.`, `${results.length} trabajo${results.length === 1 ? '' : 's'} encontrado${results.length === 1 ? '' : 's'} para ${name}.`, `Tìm thấy ${results.length} công việc cho ${name}.`) : t(locale, `No jobs found for ${name}.`, `No se encontraron trabajos para ${name}.`, `Không tìm thấy công việc cho ${name}.`),
    results,
    { sourcesUsed: ['jobs', 'customers'] }
  );
}

async function findWorkerIds(supabase: SupabaseClient, orgId: string, name: string): Promise<Array<{ id: string; name: string }>> {
  const { data } = await supabase
    .from('workers')
    .select('id, name')
    .eq('organization_id', orgId)
    .ilike('name', `%${name}%`)
    .limit(10);
  return (data || []).map((w) => ({ id: w.id, name: w.name || name }));
}

async function queryWorkerJobs(
  supabase: SupabaseClient,
  orgId: string,
  workerName: string,
  locale: StructuredAskLocale,
  range?: DateRange,
  unfinishedOnly = false
) {
  const workers = await findWorkerIds(supabase, orgId, workerName);
  if (!workers.length) return response(t(locale, `No worker found matching ${workerName}.`, `No se encontró una persona que coincida con ${workerName}.`, `Không tìm thấy nhân viên phù hợp với ${workerName}.`), [], { sourcesUsed: ['workers'] });
  let query = supabase
    .from('jobs')
    .select('id, title, customer_name, status, start_date, due_date, scheduled_start, assigned_to')
    .eq('organization_id', orgId)
    .in('assigned_to', workers.map((w) => w.id));
  if (range) query = query.gte('start_date', range.start).lte('start_date', range.end);
  const { data, error } = await query.order('start_date', { ascending: true }).limit(100);
  if (error) return null;
  let rows = data || [];
  if (unfinishedOnly) rows = rows.filter((j) => !['completed', 'complete', 'done', 'finished', 'cancelled', 'canceled', 'archived'].includes(String(j.status || '').toLowerCase()));
  const results = jobRecords(rows);
  return response(
    results.length ? t(locale, `${results.length} job${results.length === 1 ? '' : 's'} found for ${workers[0].name}.`, `${results.length} trabajo${results.length === 1 ? '' : 's'} encontrado${results.length === 1 ? '' : 's'} para ${workers[0].name}.`, `Tìm thấy ${results.length} công việc cho ${workers[0].name}.`) : t(locale, `No matching jobs for ${workers[0].name}.`, `No hay trabajos coincidentes para ${workers[0].name}.`, `Không có công việc phù hợp cho ${workers[0].name}.`),
    results,
    { sourcesUsed: ['jobs', 'workers'] }
  );
}

async function queryFreeWorkers(supabase: SupabaseClient, orgId: string, date: string, locale: StructuredAskLocale) {
  const [{ data: workers, error: workerError }, { data: jobs, error: jobError }] = await Promise.all([
    supabase.from('workers').select('id, name, role, email').eq('organization_id', orgId).limit(200),
    supabase.from('jobs').select('assigned_to, start_date, scheduled_start, status').eq('organization_id', orgId).or(`start_date.eq.${date},scheduled_start.gte.${date}T00:00:00,scheduled_start.lte.${date}T23:59:59`).limit(500)
  ]);
  if (workerError || jobError) return null;
  const busy = new Set((jobs || []).filter((j) => !['cancelled', 'canceled'].includes(String(j.status || '').toLowerCase())).map((j) => j.assigned_to).filter(Boolean));
  const free = (workers || []).filter((w) => !busy.has(w.id));
  const results = free.map((w) => buildRecord('workers', {
    id: w.id,
    type: 'worker',
    title: w.name || 'Worker',
    subtitle: w.email || null,
    status: 'Available',
    owner: w.name || null,
    href: '/workers'
  }));
  return response(
    results.length ? t(locale, `${results.length} worker${results.length === 1 ? '' : 's'} appear free on ${date}.`, `${results.length} persona${results.length === 1 ? '' : 's'} parece${results.length === 1 ? '' : 'n'} libre${results.length === 1 ? '' : 's'} el ${date}.`, `Có ${results.length} nhân viên có vẻ rảnh vào ${date}.`) : t(locale, `No workers appear free on ${date}.`, `No parece haber personal libre el ${date}.`, `Không có nhân viên nào có vẻ rảnh vào ${date}.`),
    results,
    { sourcesUsed: ['workers', 'jobs', 'schedule'] }
  );
}

async function queryInvoices(
  supabase: SupabaseClient,
  orgId: string,
  locale: StructuredAskLocale,
  opts: { overdue?: boolean; unpaid?: boolean; minAmount?: number; range?: DateRange; sum?: boolean }
) {
  let query = supabase
    .from('invoices')
    .select('id, description, amount, amount_paid, status, due_date, created_at')
    .eq('organization_id', orgId);
  if (opts.range) query = query.gte('created_at', `${opts.range.start}T00:00:00`).lte('created_at', `${opts.range.end}T23:59:59`);
  if (opts.overdue) query = query.lt('due_date', isoDate(new Date()));
  const { data, error } = await query.limit(300);
  if (error) return null;
  let rows = data || [];
  if (opts.unpaid || opts.overdue) rows = rows.filter((inv) => Math.max(0, Number(inv.amount || 0) - Number(inv.amount_paid || 0)) > 0 && !['paid', 'void', 'cancelled', 'canceled'].includes(String(inv.status || '').toLowerCase()));
  if (opts.minAmount != null) rows = rows.filter((inv) => Math.max(0, Number(inv.amount || 0) - Number(inv.amount_paid || 0)) >= opts.minAmount!);
  if (opts.sum) {
    const total = rows.reduce((sum, inv) => sum + Number(inv.amount || 0), 0);
    return response(t(locale, `Invoice total: $${total.toFixed(2)}.`, `Total facturado: $${total.toFixed(2)}.`, `Tổng hóa đơn: $${total.toFixed(2)}.`), [], { sourcesUsed: ['invoices'], metrics: [{ label: 'Invoice total', value: `$${total.toFixed(2)}`, href: '/invoices' }] });
  }
  const results = rows.map((inv) => {
    const owed = Math.max(0, Number(inv.amount || 0) - Number(inv.amount_paid || 0));
    return buildRecord('invoices', {
      id: inv.id,
      type: 'invoice',
      title: inv.description || `Invoice $${Number(inv.amount || 0).toFixed(2)}`,
      subtitle: owed > 0 ? `$${owed.toFixed(2)} outstanding` : null,
      status: inv.status || null,
      date: inv.due_date || inv.created_at?.slice?.(0, 10) || null,
      href: '/invoices'
    });
  });
  return response(
    results.length ? t(locale, `${results.length} matching invoice${results.length === 1 ? '' : 's'}.`, `${results.length} factura${results.length === 1 ? '' : 's'} coincidente${results.length === 1 ? '' : 's'}.`, `Có ${results.length} hóa đơn phù hợp.`) : t(locale, 'No matching invoices found.', 'No se encontraron facturas coincidentes.', 'Không tìm thấy hóa đơn phù hợp.'),
    results,
    { sourcesUsed: ['invoices'] }
  );
}

async function queryEstimates(
  supabase: SupabaseClient,
  orgId: string,
  locale: StructuredAskLocale,
  opts: { open?: boolean; sent?: boolean; range?: DateRange; minAmount?: number }
) {
  let query = supabase
    .from('outbound_documents')
    .select('id, subject, recipient_name, recipient_email, status, amount, sent_at, created_at, updated_at')
    .eq('organization_id', orgId)
    .eq('doc_type', 'estimate');
  if (opts.sent) query = query.eq('status', 'sent');
  if (opts.open) query = query.in('status', ['draft', 'sent', 'scheduled']);
  if (opts.range) {
    const field = opts.sent ? 'sent_at' : 'created_at';
    query = query.gte(field, `${opts.range.start}T00:00:00`).lte(field, `${opts.range.end}T23:59:59`);
  }
  const { data, error } = await query.order('updated_at', { ascending: false }).limit(200);
  if (error) return null;
  let rows = data || [];
  if (opts.minAmount != null) rows = rows.filter((doc) => Number(doc.amount || 0) >= opts.minAmount!);
  const results = rows.map((doc) => buildRecord('documents', {
    id: doc.id,
    type: 'document',
    title: doc.subject || doc.recipient_name || 'Estimate',
    subtitle: [doc.recipient_name, doc.amount != null ? `$${Number(doc.amount).toFixed(2)}` : null].filter(Boolean).join(' · ') || null,
    status: doc.status || null,
    date: (doc.sent_at || doc.created_at || doc.updated_at)?.slice?.(0, 10) || null,
    href: '/estimates'
  }));
  return response(
    results.length ? t(locale, `${results.length} matching estimate${results.length === 1 ? '' : 's'}.`, `${results.length} estimaci${results.length === 1 ? 'ón' : 'ones'} coincidente${results.length === 1 ? '' : 's'}.`, `Có ${results.length} báo giá phù hợp.`) : t(locale, 'No matching estimates found.', 'No se encontraron estimaciones coincidentes.', 'Không tìm thấy báo giá phù hợp.'),
    results,
    { sourcesUsed: ['documents'] }
  );
}

async function queryTopWorkerLastMonth(supabase: SupabaseClient, orgId: string, locale: StructuredAskLocale) {
  const range = monthRange(-1);
  const { data, error } = await supabase
    .from('jobs')
    .select('assigned_to, status, completed_at, start_date')
    .eq('organization_id', orgId)
    .gte('start_date', range.start)
    .lte('start_date', range.end)
    .limit(2000);
  if (error) return null;
  const counts = new Map<string, number>();
  for (const job of data || []) {
    const status = String(job.status || '').toLowerCase();
    if (!job.assigned_to || !['completed', 'complete', 'done', 'finished'].includes(status)) continue;
    counts.set(job.assigned_to, (counts.get(job.assigned_to) || 0) + 1);
  }
  const sorted = Array.from(counts.entries()).sort((a, b) => b[1] - a[1]);
  if (!sorted.length) return response(t(locale, 'No completed assigned jobs were found last month.', 'No se encontraron trabajos completados y asignados el mes pasado.', 'Không tìm thấy công việc đã hoàn thành và được phân công trong tháng trước.'), [], { sourcesUsed: ['jobs', 'workers'] });
  const ids = sorted.slice(0, 10).map(([id]) => id);
  const { data: workers } = await supabase.from('workers').select('id, name, role').eq('organization_id', orgId).in('id', ids);
  const byId = new Map((workers || []).map((w) => [w.id, w]));
  const results = sorted.slice(0, 10).map(([id, count]) => {
    const worker = byId.get(id);
    return buildRecord('workers', { id, type: 'worker', title: worker?.name || 'Worker', subtitle: `${count} completed jobs`, status: worker?.role || null, owner: worker?.name || null, href: '/workers' });
  });
  const top = results[0];
  return response(t(locale, `${top.title} completed the most jobs last month (${sorted[0][1]}).`, `${top.title} completó más trabajos el mes pasado (${sorted[0][1]}).`, `${top.title} hoàn thành nhiều công việc nhất tháng trước (${sorted[0][1]}).`), results, { sourcesUsed: ['jobs', 'workers'] });
}

export async function runStructuredNaturalQuery(
  supabase: SupabaseClient,
  orgId: string,
  userId: string,
  rawQuery: string,
  locale: StructuredAskLocale
): Promise<AskEverittSearchResponse | null> {
  const q = canonicalize(rawQuery);
  if (!q) return null;

  const day = extractDay(q);
  const time = extractTime(q);
  const amount = extractAmount(q);

  if (/\bwho(?:'s| is)?\s+free\b|\bfree\s+(?:workers?|staff|team)\b/.test(q)) {
    const date = /\btomorrow\b/.test(q) ? isoDate(addDays(new Date(), 1)) : day != null ? nextDayDate(day) : isoDate(new Date());
    return queryFreeWorkers(supabase, orgId, date, locale);
  }

  if (/\bjobs?\b/.test(q) && day != null) {
    return queryJobsOnDate(supabase, orgId, nextDayDate(day), locale, time || undefined);
  }

  if (/\bjobs?\b/.test(q) && /\btoday\b/.test(q) && time) {
    return queryJobsOnDate(supabase, orgId, isoDate(new Date()), locale, time);
  }

  if (/\bjobs?\b/.test(q) && /\btomorrow\b/.test(q) && /\bmorning\b/.test(q)) {
    return queryJobsOnDate(supabase, orgId, isoDate(addDays(new Date(), 1)), locale, { hour: 12, minute: 0, direction: 'before' });
  }

  if (/\b(?:unscheduled|needs? scheduling|need to be scheduled|still need scheduling)\b/.test(q) && /\bjobs?\b/.test(q)) {
    return queryUnscheduledJobs(supabase, orgId, locale);
  }

  if (/\bjobs?\b/.test(q) && /\bopen\b/.test(q) && /\bthis month\b/.test(q)) {
    return queryJobsRange(supabase, orgId, monthRange(0), locale, { statuses: ['open', 'active', 'pending', 'scheduled'], label: t(locale, 'this month', 'este mes', 'tháng này') });
  }

  if (/\bjobs?\b/.test(q) && /\bcompleted\b/.test(q) && /\blast week\b/.test(q)) {
    return queryJobsRange(supabase, orgId, weekRange(-1), locale, { statuses: ['completed', 'complete', 'done', 'finished'], label: t(locale, 'last week', 'la semana pasada', 'tuần trước') });
  }

  if (/\bmy jobs?\b/.test(q)) {
    const range = /\btoday\b/.test(q) ? { start: isoDate(new Date()), end: isoDate(new Date()) } : /\bthis week\b/.test(q) ? weekRange(0) : monthRange(0);
    return queryJobsRange(supabase, orgId, range, locale, { mine: userId, label: /\btoday\b/.test(q) ? t(locale, 'today', 'hoy', 'hôm nay') : /\bthis week\b/.test(q) ? t(locale, 'this week', 'esta semana', 'tuần này') : t(locale, 'this month', 'este mes', 'tháng này') });
  }

  const customerName = extractTailName(q, /\bjobs?\s+(?:for|with)\s+(?:the\s+)?(.+)$/i);
  if (customerName) return queryJobsForCustomer(supabase, orgId, customerName.replace(/\bfamily\b/i, '').trim(), locale);

  const workerSchedule = q.match(/^(.+?)(?:'s|s)\s+(?:schedule|jobs?)\s*(.*)$/i);
  if (workerSchedule && workerSchedule[1] && !/^(what|who|when|job|jobs|customer|client)$/i.test(workerSchedule[1])) {
    const range = /\bthis week\b/.test(q) ? weekRange(0) : /\blast week\b/.test(q) ? weekRange(-1) : undefined;
    return queryWorkerJobs(supabase, orgId, workerSchedule[1].trim(), locale, range, /\b(unfinished|not done|open)\b/.test(q));
  }

  const assignedWorker = extractTailName(q, /\bjobs?\s+assigned\s+to\s+(.+)$/i);
  if (assignedWorker) return queryWorkerJobs(supabase, orgId, assignedWorker, locale, /\bthis week\b/.test(q) ? weekRange(0) : undefined, /\b(unfinished|not done|open)\b/.test(q));

  if (/\bwho\b.*\bworked\b.*\bmost\b.*\blast month\b|\btop worker\b.*\blast month\b/.test(q)) {
    return queryTopWorkerLastMonth(supabase, orgId, locale);
  }

  if (/\binvoices?\b/.test(q) && /\b(overdue|past due|late)\b/.test(q)) {
    return queryInvoices(supabase, orgId, locale, { overdue: true, unpaid: true, minAmount: /\b(over|above|more than|bigger than)\b/.test(q) ? amount || undefined : undefined });
  }

  if (/\binvoices?\b/.test(q) && /\bunpaid\b/.test(q)) {
    return queryInvoices(supabase, orgId, locale, { unpaid: true, minAmount: amount || undefined });
  }

  if (/\bhow much\b.*\b(invoice|invoiced|invoices)\b.*\blast month\b|\b(invoice|invoiced)\b.*\blast month\b.*\b(total|how much)\b/.test(q)) {
    return queryInvoices(supabase, orgId, locale, { range: monthRange(-1), sum: true });
  }

  if (/\bestimates?\b/.test(q) && /\b(sent)\b/.test(q) && /\bthis month\b/.test(q)) {
    return queryEstimates(supabase, orgId, locale, { sent: true, range: monthRange(0) });
  }

  if (/\bestimates?\b/.test(q) && /\b(open|pending|waiting)\b/.test(q)) {
    return queryEstimates(supabase, orgId, locale, { open: true, minAmount: /\b(big|large|over|above|more than)\b/.test(q) ? amount || 1000 : undefined });
  }

  if (/\bnew leads?\b/.test(q) && /\bthis week\b/.test(q)) {
    const range = weekRange(0);
    const { data, error } = await supabase.from('customers').select('id, company_name, email, phone, pipeline_stage, created_at').eq('organization_id', orgId).in('pipeline_stage', ['lead', 'qualified']).gte('created_at', `${range.start}T00:00:00`).lte('created_at', `${range.end}T23:59:59`).order('created_at', { ascending: false }).limit(100);
    if (error) return null;
    const results = (data || []).map((c) => buildRecord('leads', { id: c.id, type: 'lead', title: c.company_name || c.email || c.phone || 'Lead', subtitle: [c.email, c.phone].filter(Boolean).join(' · ') || null, status: c.pipeline_stage || null, date: c.created_at?.slice?.(0, 10) || null, href: `/customers/${c.id}` }));
    return response(results.length ? t(locale, `${results.length} new lead${results.length === 1 ? '' : 's'} this week.`, `${results.length} solicitud${results.length === 1 ? '' : 'es'} nueva${results.length === 1 ? '' : 's'} esta semana.`, `Có ${results.length} khách tiềm năng mới tuần này.`) : t(locale, 'No new leads this week.', 'No hay solicitudes nuevas esta semana.', 'Không có khách tiềm năng mới tuần này.'), results, { sourcesUsed: ['leads', 'customers'] });
  }

  return null;
}
