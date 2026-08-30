import type { SupabaseClient } from '@supabase/supabase-js';
import { CUSTOMER_LIST_SELECT, customerDisplayName } from '@/lib/customer-record';
import { buildRecord, response } from '@/lib/ask-everitt/search-helpers';
import type { AskEverittSearchResponse } from '@/lib/ask-everitt/types';

export type StructuredAskLocale = 'en' | 'es' | 'vi';
export type AskEntity = 'job' | 'customer' | 'lead' | 'estimate' | 'invoice' | 'worker' | 'schedule';
export type AskRelativeTime = 'today' | 'tomorrow' | 'this_week' | 'next_week' | 'last_week' | 'this_month' | 'last_month';

export type AskFilter = {
  entity: AskEntity;
  timeRange?: {
    relative?: AskRelativeTime;
    dayOfWeek?: number;
    startTime?: string;
    endTime?: string;
  };
  status?: string[];
  isEmergency?: boolean;
  isPaid?: boolean;
  isAssigned?: boolean;
  customerName?: string;
  workerName?: string;
  assignedToMe?: boolean;
  minAmount?: number;
  maxAmount?: number;
  sortBy?: 'start_time' | 'created_at' | 'due_date' | 'total' | 'name';
  sortDir?: 'asc' | 'desc';
  limit?: number;
  inactiveDays?: number;
  aggregation?: 'count' | 'sum';
  intent?: 'free_workers' | 'waiting_estimate' | 'customers_open_estimates' | 'generic';
  confidence: number;
};

type JobRow = {
  id: string;
  title?: string | null;
  customer_name?: string | null;
  status?: string | null;
  start_date?: string | null;
  due_date?: string | null;
  scheduled_start?: string | null;
  assigned_to?: string | null;
  notes?: string | null;
};

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

function rangeForRelative(relative: AskRelativeTime): { start: string; end: string } {
  const now = new Date();
  if (relative === 'today') return { start: isoDate(now), end: isoDate(now) };
  if (relative === 'tomorrow') {
    const d = addDays(now, 1);
    return { start: isoDate(d), end: isoDate(d) };
  }
  if (relative === 'this_week' || relative === 'next_week' || relative === 'last_week') {
    const offset = relative === 'next_week' ? 7 : relative === 'last_week' ? -7 : 0;
    const start = addDays(startOfWeek(), offset);
    return { start: isoDate(start), end: isoDate(addDays(start, 6)) };
  }
  const monthOffset = relative === 'last_month' ? -1 : 0;
  const start = new Date(now.getFullYear(), now.getMonth() + monthOffset, 1);
  const end = new Date(now.getFullYear(), now.getMonth() + monthOffset + 1, 0);
  return { start: isoDate(start), end: isoDate(end) };
}

function nextDayDate(day: number): string {
  const d = new Date();
  let diff = day - d.getDay();
  if (diff < 0) diff += 7;
  d.setDate(d.getDate() + diff);
  return isoDate(d);
}

function canonicalize(input: string): string {
  let q = input
    .replace(/[’]/g, "'")
    .toLowerCase()
    .replace(/\b(can you|could you|would you|please|pls|hey|tell me|show me|find me|give me|i need|i want|i'd like|list all|list the|do i have)\b/g, ' ');

  const replacements: Array<[RegExp, string]> = [
    // Spanish entities and intent words
    [/\btrabajos?|citas?|servicios?\b/g, ' jobs '],
    [/\bclientes?|propietarios?\b/g, ' customers '],
    [/\bsolicitudes?|prospectos?|consultas?\b/g, ' leads '],
    [/\bestimaciones?|presupuestos?|cotizaciones?\b/g, ' estimates '],
    [/\bfacturas?|pagos?\b/g, ' invoices '],
    [/\btrabajadores?|empleados?|técnicos?|tecnicos?|personal|equipo\b/g, ' workers '],
    [/\bagenda|calendario|disponibilidad\b/g, ' schedule '],
    [/\bhoy\b/g, ' today '], [/\bmañana\b/g, ' tomorrow '], [/\besta semana\b/g, ' this week '], [/\bpróxima semana|proxima semana\b/g, ' next week '], [/\bsemana pasada\b/g, ' last week '],
    [/\beste mes\b/g, ' this month '], [/\bmes pasado\b/g, ' last month '],
    [/\bsin pagar|no pagad[oa]s?|pendientes? de pago\b/g, ' unpaid '], [/\bvencid[oa]s?|atrasad[oa]s?\b/g, ' overdue '],
    [/\bsin asignar\b/g, ' unassigned '], [/\bcompletad[oa]s?|terminad[oa]s?\b/g, ' completed '], [/\blibre|disponible\b/g, ' free '],
    [/\blunes\b/g, ' monday '], [/\bmartes\b/g, ' tuesday '], [/\bmiércoles|miercoles\b/g, ' wednesday '], [/\bjueves\b/g, ' thursday '], [/\bviernes\b/g, ' friday '], [/\bsábado|sabado\b/g, ' saturday '], [/\bdomingo\b/g, ' sunday '],
    [/\bgrande|grandes\b/g, ' big '], [/\burgente|urgentes|emergencia\b/g, ' urgent '], [/\binactivo|inactivos|sin actividad\b/g, ' inactive '],
    // Vietnamese entities and intent words
    [/\bcông việc|việc làm|lịch hẹn|dịch vụ\b/g, ' jobs '],
    [/\bkhách hàng|chủ nhà\b/g, ' customers '],
    [/\bkhách tiềm năng|yêu cầu|truy vấn\b/g, ' leads '],
    [/\bước tính|báo giá\b/g, ' estimates '],
    [/\bhóa đơn|thanh toán\b/g, ' invoices '],
    [/\bnhân viên|kỹ thuật viên|đội ngũ|người làm\b/g, ' workers '],
    [/\blịch|lịch làm việc|khả dụng\b/g, ' schedule '],
    [/\bhôm nay\b/g, ' today '], [/\bngày mai\b/g, ' tomorrow '], [/\btuần này\b/g, ' this week '], [/\btuần sau\b/g, ' next week '], [/\btuần trước\b/g, ' last week '],
    [/\btháng này\b/g, ' this month '], [/\btháng trước\b/g, ' last month '],
    [/\bchưa thanh toán|chưa trả\b/g, ' unpaid '], [/\bquá hạn|trễ hạn\b/g, ' overdue '],
    [/\bchưa phân công\b/g, ' unassigned '], [/\bhoàn thành|đã xong\b/g, ' completed '], [/\brảnh\b/g, ' free '],
    [/\bthứ hai\b/g, ' monday '], [/\bthứ ba\b/g, ' tuesday '], [/\bthứ tư\b/g, ' wednesday '], [/\bthứ năm\b/g, ' thursday '], [/\bthứ sáu\b/g, ' friday '], [/\bthứ bảy\b/g, ' saturday '], [/\bchủ nhật\b/g, ' sunday '],
    [/\blớn\b/g, ' big '], [/\bkhẩn cấp|gấp\b/g, ' urgent '], [/\bkhông hoạt động|im lặng\b/g, ' inactive ']
  ];

  for (const [pattern, replacement] of replacements) q = q.replace(pattern, replacement);
  return q.replace(/[^a-z0-9$.'@\-\s]/g, ' ').replace(/\s+/g, ' ').trim();
}

function extractAmount(q: string): number | undefined {
  const match = q.match(/(?:\$|usd\s*)?([0-9][0-9,]*(?:\.[0-9]{1,2})?)/i);
  if (!match) return undefined;
  const value = Number(match[1].replace(/,/g, ''));
  return Number.isFinite(value) ? value : undefined;
}

function extractClock(q: string): { startTime?: string; endTime?: string } {
  const match = q.match(/\b(after|before)\s+(\d{1,2})(?::(\d{2}))?\s*(am|pm)?\b/i);
  if (!match) {
    if (/\bmorning\b/.test(q)) return { startTime: '06:00', endTime: '12:00' };
    if (/\bafternoon\b/.test(q)) return { startTime: '12:00', endTime: '17:00' };
    if (/\bevening\b/.test(q)) return { startTime: '17:00', endTime: '23:59' };
    return {};
  }
  let hour = Number(match[2]);
  const minute = Number(match[3] || 0);
  const ampm = (match[4] || '').toLowerCase();
  if (ampm === 'pm' && hour < 12) hour += 12;
  if (ampm === 'am' && hour === 12) hour = 0;
  if (!ampm && hour >= 1 && hour <= 7) hour += 12;
  const time = `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
  return match[1].toLowerCase() === 'after' ? { startTime: time } : { endTime: time };
}

function extractRelative(q: string): AskRelativeTime | undefined {
  if (/\blast month\b/.test(q)) return 'last_month';
  if (/\bthis month\b/.test(q)) return 'this_month';
  if (/\blast week\b/.test(q)) return 'last_week';
  if (/\bnext week\b/.test(q)) return 'next_week';
  if (/\bthis week\b/.test(q)) return 'this_week';
  if (/\btomorrow\b/.test(q)) return 'tomorrow';
  if (/\btoday\b/.test(q)) return 'today';
  return undefined;
}

function extractDayOfWeek(q: string): number | undefined {
  const names = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
  const index = names.findIndex((name) => new RegExp(`\\b${name}\\b`).test(q));
  return index >= 0 ? index : undefined;
}

function cleanupName(value: string): string {
  return value
    .replace(/\b(today|tomorrow|this week|next week|last week|this month|last month|open|unfinished|not done|completed|done|unpaid|overdue|family)\b.*$/i, '')
    .replace(/\b(the|a|an)\b/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function parseAskFilter(rawQuery: string): AskFilter | null {
  const q = canonicalize(rawQuery);
  if (!q) return null;

  let entity: AskEntity | undefined;
  if (/\bestimates?\b/.test(q)) entity = 'estimate';
  else if (/\binvoices?\b/.test(q)) entity = 'invoice';
  else if (/\bleads?\b/.test(q)) entity = 'lead';
  else if (/\bcustomers?\b/.test(q)) entity = 'customer';
  else if (/\bworkers?\b/.test(q) || /\bwho(?:'s| is)?\s+free\b/.test(q)) entity = 'worker';
  else if (/\bschedule|calendar\b/.test(q)) entity = 'schedule';
  else if (/\bjobs?|work order|work\b/.test(q)) entity = 'job';

  if (!entity && /\bnext\b.*\b(job|work|appointment)\b/.test(q)) entity = 'job';
  if (!entity) return null;

  const filter: AskFilter = { entity, confidence: 0.55, intent: 'generic' };
  const relative = extractRelative(q);
  const dayOfWeek = extractDayOfWeek(q);
  const clock = extractClock(q);
  if (relative || dayOfWeek != null || clock.startTime || clock.endTime) {
    filter.timeRange = { relative, dayOfWeek, ...clock };
    filter.confidence += 0.1;
  }

  if (/\b(next|upcoming|soonest|earliest)\b/.test(q)) {
    filter.sortBy = 'start_time';
    filter.sortDir = 'asc';
    filter.limit = /\bnext\b/.test(q) ? 1 : 10;
    filter.confidence += 0.1;
  }

  if (/\b(open|active|pending|unfinished|not done|what's left|what is left)\b/.test(q)) filter.status = ['open', 'active', 'pending', 'scheduled'];
  if (/\bcompleted|done|finished|closed\b/.test(q)) filter.status = ['completed', 'complete', 'done', 'finished', 'closed'];
  if (/\bcancelled|canceled\b/.test(q)) filter.status = ['cancelled', 'canceled'];
  if (/\bunscheduled|needs? scheduling|need to be scheduled|still need scheduling\b/.test(q)) {
    filter.status = ['unscheduled'];
    filter.isAssigned = undefined;
  }
  if (/\bunassigned|no one assigned|not assigned\b/.test(q)) filter.isAssigned = false;
  if (/\bassigned\b/.test(q) && filter.isAssigned !== false) filter.isAssigned = true;
  if (/\bmy jobs|my schedule|assigned to me|mine\b/.test(q)) filter.assignedToMe = true;
  if (/\bemergency|urgent|high priority\b/.test(q)) filter.isEmergency = true;
  if (/\bunpaid|not paid|outstanding|overdue\b/.test(q) && entity === 'invoice') filter.isPaid = false;
  if (/\bpaid\b/.test(q) && !/\bunpaid|not paid\b/.test(q) && entity === 'invoice') filter.isPaid = true;
  if (/\bhow many|count|number of\b/.test(q)) filter.aggregation = 'count';
  if (/\bhow much|sum|total amount|total invoiced|invoiced\b/.test(q) && entity === 'invoice') filter.aggregation = 'sum';

  const explicitAmount = extractAmount(q);
  if (/\b(over|above|more than|greater than)\b/.test(q) && explicitAmount != null) filter.minAmount = explicitAmount;
  else if (/\b(big|large)\b/.test(q) && (entity === 'invoice' || entity === 'estimate')) filter.minAmount = entity === 'invoice' ? 500 : 1000;

  if (/\bwho(?:'s| is)?\s+free|free workers?|free staff|availability\b/.test(q)) {
    filter.entity = 'worker';
    filter.intent = 'free_workers';
    filter.isAssigned = false;
    filter.confidence = 0.95;
  }

  if (/\brequests?|leads?\b.*\bwaiting for (?:an )?estimate|needs? (?:an )?estimate|pending estimate\b/.test(q)) {
    filter.entity = 'lead';
    filter.intent = 'waiting_estimate';
    filter.confidence = 0.95;
  }

  if (/\bcustomers?\b.*\bopen estimates?\b/.test(q)) {
    filter.entity = 'customer';
    filter.intent = 'customers_open_estimates';
    filter.confidence = 0.95;
  }

  const inactiveMatch = q.match(/\b(?:no jobs?|no activity|inactive|haven't booked|have not booked|quiet)\b(?:\s+in)?\s*(\d{1,3})?\s*days?/i);
  if (inactiveMatch && entity === 'customer') filter.inactiveDays = Number(inactiveMatch[1] || 90);
  else if (/\bquiet customers?|inactive customers?|haven't booked in a while|have not booked in a while\b/.test(q)) filter.inactiveDays = 60;

  const jobsFor = q.match(/\bjobs?\s+(?:for|with)\s+(?:the\s+)?(.+)$/i);
  if (jobsFor?.[1]) {
    filter.entity = 'job';
    filter.customerName = cleanupName(jobsFor[1]);
    filter.confidence = 0.95;
  }

  const assignedTo = q.match(/\bjobs?\s+assigned\s+to\s+(.+)$/i);
  if (assignedTo?.[1]) {
    filter.entity = 'job';
    filter.workerName = cleanupName(assignedTo[1]);
    filter.confidence = 0.95;
  }

  const possessiveWorker = q.match(/^(.+?)(?:'s|s)\s+(?:(unfinished|open|not done)\s+)?(?:schedule|jobs?)\b/i);
  if (possessiveWorker?.[1] && !/^(what|who|when|customer|client)$/i.test(possessiveWorker[1])) {
    filter.entity = 'job';
    filter.workerName = cleanupName(possessiveWorker[1]);
    if (possessiveWorker[2]) filter.status = ['open', 'active', 'pending', 'scheduled'];
    filter.confidence = 0.95;
  }

  if (/\bwho\b.*\bworked\b.*\bmost\b|\btop worker\b|\bmost jobs\b.*\bworker\b/.test(q)) {
    filter.entity = 'worker';
    filter.aggregation = 'count';
    filter.sortDir = 'desc';
    filter.confidence = 0.95;
  }

  if (/\bnew leads?\b/.test(q)) {
    filter.entity = 'lead';
    filter.sortBy = 'created_at';
    filter.sortDir = 'desc';
    filter.confidence = Math.max(filter.confidence, 0.9);
  }

  return filter;
}

function statusClosed(status: string | null | undefined): boolean {
  return ['completed', 'complete', 'done', 'finished', 'closed', 'cancelled', 'canceled', 'archived'].includes(String(status || '').toLowerCase());
}

function jobDate(job: JobRow): string | null {
  return job.scheduled_start || (job.start_date ? `${job.start_date}T00:00:00` : job.due_date ? `${job.due_date}T00:00:00` : null);
}

function mergeJobs(...sets: Array<JobRow[] | null | undefined>): JobRow[] {
  const byId = new Map<string, JobRow>();
  for (const set of sets) for (const row of set || []) byId.set(row.id, row);
  return Array.from(byId.values());
}

async function loadJobsForRange(supabase: SupabaseClient, orgId: string, start: string, end: string): Promise<JobRow[] | null> {
  const [dateRows, timedRows] = await Promise.all([
    supabase
      .from('jobs')
      .select('id, title, customer_name, status, start_date, due_date, scheduled_start, assigned_to, notes')
      .eq('organization_id', orgId)
      .or(`start_date.gte.${start},start_date.lte.${end},due_date.gte.${start},due_date.lte.${end}`)
      .limit(1000),
    supabase
      .from('jobs')
      .select('id, title, customer_name, status, start_date, due_date, scheduled_start, assigned_to, notes')
      .eq('organization_id', orgId)
      .gte('scheduled_start', `${start}T00:00:00`)
      .lte('scheduled_start', `${end}T23:59:59`)
      .limit(1000)
  ]);
  if (dateRows.error && timedRows.error) return null;
  return mergeJobs((dateRows.data || []) as JobRow[], (timedRows.data || []) as JobRow[]);
}

async function loadUpcomingJobs(supabase: SupabaseClient, orgId: string): Promise<JobRow[] | null> {
  const today = isoDate(new Date());
  const now = new Date().toISOString();
  const [dated, timed] = await Promise.all([
    supabase
      .from('jobs')
      .select('id, title, customer_name, status, start_date, due_date, scheduled_start, assigned_to, notes')
      .eq('organization_id', orgId)
      .or(`start_date.gte.${today},due_date.gte.${today}`)
      .limit(1000),
    supabase
      .from('jobs')
      .select('id, title, customer_name, status, start_date, due_date, scheduled_start, assigned_to, notes')
      .eq('organization_id', orgId)
      .gte('scheduled_start', now)
      .limit(1000)
  ]);
  if (dated.error && timed.error) return null;
  return mergeJobs((dated.data || []) as JobRow[], (timed.data || []) as JobRow[]);
}

function applyTimeFilter(rows: JobRow[], startTime?: string, endTime?: string): JobRow[] {
  if (!startTime && !endTime) return rows;
  const toMinutes = (value: string) => {
    const [h, m] = value.split(':').map(Number);
    return h * 60 + m;
  };
  const min = startTime ? toMinutes(startTime) : null;
  const max = endTime ? toMinutes(endTime) : null;
  return rows.filter((job) => {
    if (!job.scheduled_start) return false;
    const d = new Date(job.scheduled_start);
    const value = d.getHours() * 60 + d.getMinutes();
    return (min == null || value >= min) && (max == null || value <= max);
  });
}

async function resolveWorkerIds(supabase: SupabaseClient, orgId: string, name: string): Promise<Array<{ id: string; name: string }>> {
  const { data } = await supabase
    .from('workers')
    .select('id, name')
    .eq('organization_id', orgId)
    .ilike('name', `%${name}%`)
    .limit(10);
  return (data || []).map((w) => ({ id: w.id, name: w.name || name }));
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

async function runJobFilter(
  supabase: SupabaseClient,
  orgId: string,
  userId: string,
  filter: AskFilter,
  locale: StructuredAskLocale
): Promise<AskEverittSearchResponse | null> {
  let rows: JobRow[] | null;

  if (filter.limit === 1 && filter.sortBy === 'start_time' && !filter.timeRange?.relative && filter.timeRange?.dayOfWeek == null) {
    rows = await loadUpcomingJobs(supabase, orgId);
  } else {
    let range: { start: string; end: string } | null = null;
    if (filter.timeRange?.dayOfWeek != null) {
      const day = nextDayDate(filter.timeRange.dayOfWeek);
      range = { start: day, end: day };
    } else if (filter.timeRange?.relative) {
      range = rangeForRelative(filter.timeRange.relative);
    }

    if (range) rows = await loadJobsForRange(supabase, orgId, range.start, range.end);
    else {
      const { data, error } = await supabase
        .from('jobs')
        .select('id, title, customer_name, status, start_date, due_date, scheduled_start, assigned_to, notes')
        .eq('organization_id', orgId)
        .limit(1000);
      if (error) return null;
      rows = (data || []) as JobRow[];
    }
  }

  if (!rows) return null;

  if (filter.status?.includes('unscheduled')) {
    rows = rows.filter((job) => !job.start_date && !job.scheduled_start && !statusClosed(job.status));
  } else if (filter.status?.length) {
    const statuses = new Set(filter.status);
    rows = rows.filter((job) => statuses.has(String(job.status || '').toLowerCase()));
  }

  if (filter.isEmergency) {
    rows = rows.filter((job) => /\b(emergency|urgent|high priority)\b/i.test(`${job.title || ''} ${job.notes || ''}`));
  }

  if (filter.assignedToMe) rows = rows.filter((job) => job.assigned_to === userId);
  if (filter.isAssigned === false) rows = rows.filter((job) => !job.assigned_to);
  if (filter.isAssigned === true && !filter.workerName) rows = rows.filter((job) => Boolean(job.assigned_to));

  if (filter.customerName) {
    const needle = filter.customerName.toLowerCase();
    rows = rows.filter((job) => String(job.customer_name || '').toLowerCase().includes(needle));
  }

  if (filter.workerName) {
    const workers = await resolveWorkerIds(supabase, orgId, filter.workerName);
    const ids = new Set(workers.map((worker) => worker.id));
    rows = rows.filter((job) => job.assigned_to && ids.has(job.assigned_to));
  }

  rows = applyTimeFilter(rows, filter.timeRange?.startTime, filter.timeRange?.endTime);

  rows = rows
    .filter((job) => !['cancelled', 'canceled', 'archived'].includes(String(job.status || '').toLowerCase()) || filter.status?.some((s) => ['cancelled', 'canceled'].includes(s)))
    .sort((a, b) => String(jobDate(a) || '').localeCompare(String(jobDate(b) || '')));

  if (filter.sortDir === 'desc') rows.reverse();
  if (filter.limit) rows = rows.slice(0, filter.limit);

  const results = jobRecords(rows);
  if (filter.aggregation === 'count') {
    return response(
      t(locale, `${results.length} matching jobs.`, `${results.length} trabajos coincidentes.`, `Có ${results.length} công việc phù hợp.`),
      results.slice(0, 20),
      { sourcesUsed: ['jobs', 'schedule'], metrics: [{ label: 'Jobs', value: String(results.length), href: '/jobs' }] }
    );
  }

  if (filter.limit === 1 && filter.sortBy === 'start_time') {
    const first = results[0];
    return response(
      first
        ? t(locale, `Your next job is ${first.title}${first.subtitle ? ` · ${first.subtitle}` : ''} on ${first.date || 'the next scheduled date'}.`, `Su próximo trabajo es ${first.title}${first.subtitle ? ` · ${first.subtitle}` : ''} el ${first.date || 'próximo día programado'}.`, `Công việc tiếp theo là ${first.title}${first.subtitle ? ` · ${first.subtitle}` : ''} vào ${first.date || 'ngày được lên lịch tiếp theo'}.`)
        : t(locale, 'No upcoming jobs are scheduled.', 'No hay próximos trabajos programados.', 'Không có công việc sắp tới đã được lên lịch.'),
      first ? [first] : [],
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

async function runWorkerFilter(
  supabase: SupabaseClient,
  orgId: string,
  filter: AskFilter,
  locale: StructuredAskLocale
): Promise<AskEverittSearchResponse | null> {
  if (filter.intent === 'free_workers') {
    let date = isoDate(new Date());
    if (filter.timeRange?.dayOfWeek != null) date = nextDayDate(filter.timeRange.dayOfWeek);
    else if (filter.timeRange?.relative) date = rangeForRelative(filter.timeRange.relative).start;

    const [workersRes, jobs] = await Promise.all([
      supabase.from('workers').select('id, name, role, email').eq('organization_id', orgId).limit(300),
      loadJobsForRange(supabase, orgId, date, date)
    ]);
    if (workersRes.error || jobs == null) return null;

    const busy = new Set(jobs.filter((job) => !['cancelled', 'canceled'].includes(String(job.status || '').toLowerCase())).map((job) => job.assigned_to).filter(Boolean));
    const free = (workersRes.data || []).filter((worker) => !busy.has(worker.id));
    const results = free.map((worker) => buildRecord('workers', {
      id: worker.id,
      type: 'worker',
      title: worker.name || 'Worker',
      subtitle: worker.email || null,
      status: 'Available',
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
    const relative = filter.timeRange?.relative || 'this_month';
    const range = rangeForRelative(relative);
    const jobs = await loadJobsForRange(supabase, orgId, range.start, range.end);
    if (jobs == null) return null;
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
      return buildRecord('workers', {
        id,
        type: 'worker',
        title: worker?.name || 'Worker',
        subtitle: `${count} completed jobs`,
        status: worker?.role || null,
        owner: worker?.name || null,
        href: '/workers'
      });
    });
    return response(
      t(locale, `${results[0].title} completed the most jobs (${sorted[0][1]}).`, `${results[0].title} completó más trabajos (${sorted[0][1]}).`, `${results[0].title} hoàn thành nhiều công việc nhất (${sorted[0][1]}).`),
      results,
      { sourcesUsed: ['jobs', 'workers'] }
    );
  }

  return null;
}

async function runInvoiceFilter(
  supabase: SupabaseClient,
  orgId: string,
  filter: AskFilter,
  locale: StructuredAskLocale
): Promise<AskEverittSearchResponse | null> {
  let query = supabase
    .from('invoices')
    .select('id, description, amount, amount_paid, status, due_date, created_at')
    .eq('organization_id', orgId);

  if (filter.timeRange?.relative) {
    const range = rangeForRelative(filter.timeRange.relative);
    query = query.gte('created_at', `${range.start}T00:00:00`).lte('created_at', `${range.end}T23:59:59`);
  }

  if (/overdue/.test(filter.status?.join(' ') || '') || filter.timeRange?.relative === undefined && filter.isPaid === false) {
    // Keep all unpaid rows here; overdue is filtered below by due date when explicitly asked.
  }

  const { data, error } = await query.limit(500);
  if (error) return null;
  let rows = data || [];
  const rawStatus = filter.status || [];
  const asksOverdue = rawStatus.includes('overdue');

  if (filter.isPaid === false) {
    rows = rows.filter((invoice) => Math.max(0, Number(invoice.amount || 0) - Number(invoice.amount_paid || 0)) > 0 && !['paid', 'void', 'cancelled', 'canceled'].includes(String(invoice.status || '').toLowerCase()));
  }
  if (filter.isPaid === true) rows = rows.filter((invoice) => String(invoice.status || '').toLowerCase() === 'paid' || Number(invoice.amount_paid || 0) >= Number(invoice.amount || 0));
  if (asksOverdue) rows = rows.filter((invoice) => invoice.due_date && invoice.due_date < isoDate(new Date()) && Math.max(0, Number(invoice.amount || 0) - Number(invoice.amount_paid || 0)) > 0);
  if (filter.minAmount != null) rows = rows.filter((invoice) => Math.max(0, Number(invoice.amount || 0) - Number(invoice.amount_paid || 0)) >= filter.minAmount!);
  if (filter.maxAmount != null) rows = rows.filter((invoice) => Number(invoice.amount || 0) <= filter.maxAmount!);

  if (filter.aggregation === 'sum') {
    const total = rows.reduce((sum, invoice) => sum + Number(invoice.amount || 0), 0);
    return response(
      t(locale, `Invoice total: $${total.toFixed(2)}.`, `Total facturado: $${total.toFixed(2)}.`, `Tổng hóa đơn: $${total.toFixed(2)}.`),
      [],
      { sourcesUsed: ['invoices'], metrics: [{ label: 'Invoice total', value: `$${total.toFixed(2)}`, href: '/invoices' }] }
    );
  }

  const results = rows.map((invoice) => {
    const owed = Math.max(0, Number(invoice.amount || 0) - Number(invoice.amount_paid || 0));
    return buildRecord('invoices', {
      id: invoice.id,
      type: 'invoice',
      title: invoice.description || `Invoice $${Number(invoice.amount || 0).toFixed(2)}`,
      subtitle: owed > 0 ? `$${owed.toFixed(2)} outstanding` : null,
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

async function runEstimateFilter(
  supabase: SupabaseClient,
  orgId: string,
  filter: AskFilter,
  locale: StructuredAskLocale
): Promise<AskEverittSearchResponse | null> {
  let query = supabase
    .from('outbound_documents')
    .select('id, subject, recipient_name, recipient_email, status, amount, customer_id, sent_at, created_at, updated_at')
    .eq('organization_id', orgId)
    .eq('doc_type', 'estimate');

  const statusWords = new Set(filter.status || []);
  if (statusWords.has('sent')) query = query.eq('status', 'sent');
  else if (statusWords.has('open') || statusWords.has('pending')) query = query.in('status', ['draft', 'sent', 'scheduled']);

  if (filter.timeRange?.relative) {
    const range = rangeForRelative(filter.timeRange.relative);
    const field = statusWords.has('sent') ? 'sent_at' : 'created_at';
    query = query.gte(field, `${range.start}T00:00:00`).lte(field, `${range.end}T23:59:59`);
  }

  const { data, error } = await query.order('updated_at', { ascending: false }).limit(300);
  if (error) return null;
  let rows = data || [];
  if (filter.minAmount != null) rows = rows.filter((doc) => Number(doc.amount || 0) >= filter.minAmount!);

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
    results.length
      ? t(locale, `${results.length} matching estimate${results.length === 1 ? '' : 's'}.`, `${results.length} estimaci${results.length === 1 ? 'ón' : 'ones'} coincidente${results.length === 1 ? '' : 's'}.`, `Có ${results.length} báo giá phù hợp.`)
      : t(locale, 'No matching estimates found.', 'No se encontraron estimaciones coincidentes.', 'Không tìm thấy báo giá phù hợp.'),
    results,
    { sourcesUsed: ['documents'] }
  );
}

async function runCustomerFilter(
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
      .limit(500);
    if (error) return null;
    const ids = Array.from(new Set((docs || []).map((doc) => doc.customer_id).filter(Boolean)));
    if (!ids.length) return response(t(locale, 'No customers have open estimates.', 'Ningún cliente tiene estimaciones abiertas.', 'Không có khách hàng nào có báo giá đang mở.'), [], { sourcesUsed: ['customers', 'documents'] });
    const { data: customers } = await supabase.from('customers').select(CUSTOMER_LIST_SELECT).eq('organization_id', orgId).in('id', ids).limit(100);
    const results = (customers || []).map((customer) => buildRecord('customers', { id: customer.id, type: 'customer', title: customerDisplayName(customer), subtitle: customer.email || null, status: 'Open estimate', date: null, href: `/customers/${customer.id}` }));
    return response(t(locale, `${results.length} customer${results.length === 1 ? '' : 's'} with open estimates.`, `${results.length} cliente${results.length === 1 ? '' : 's'} con estimaciones abiertas.`, `Có ${results.length} khách hàng có báo giá đang mở.`), results, { sourcesUsed: ['customers', 'documents'] });
  }

  if (filter.inactiveDays) {
    const cutoff = isoDate(addDays(new Date(), -filter.inactiveDays));
    const [{ data: customers, error: customerError }, { data: recentJobs, error: jobError }] = await Promise.all([
      supabase.from('customers').select(CUSTOMER_LIST_SELECT).eq('organization_id', orgId).limit(500),
      supabase.from('jobs').select('customer_id, start_date, created_at').eq('organization_id', orgId).or(`start_date.gte.${cutoff},created_at.gte.${cutoff}T00:00:00`).limit(3000)
    ]);
    if (customerError || jobError) return null;
    const activeIds = new Set((recentJobs || []).map((job) => job.customer_id).filter(Boolean));
    const inactive = (customers || []).filter((customer) => !activeIds.has(customer.id)).slice(0, 100);
    const results = inactive.map((customer) => buildRecord('customers', { id: customer.id, type: 'customer', title: customerDisplayName(customer), subtitle: customer.email || null, status: `No booking in ${filter.inactiveDays} days`, date: customer.updated_at?.slice?.(0, 10) || null, href: `/customers/${customer.id}` }));
    return response(
      results.length
        ? t(locale, `${results.length} customer${results.length === 1 ? '' : 's'} with no jobs in the last ${filter.inactiveDays} days.`, `${results.length} cliente${results.length === 1 ? '' : 's'} sin trabajos en los últimos ${filter.inactiveDays} días.`, `Có ${results.length} khách hàng không có công việc trong ${filter.inactiveDays} ngày qua.`)
        : t(locale, `No inactive customers found for the last ${filter.inactiveDays} days.`, `No se encontraron clientes inactivos en los últimos ${filter.inactiveDays} días.`, `Không tìm thấy khách hàng không hoạt động trong ${filter.inactiveDays} ngày qua.`),
      results,
      { sourcesUsed: ['customers', 'jobs'] }
    );
  }

  return null;
}

async function runLeadFilter(
  supabase: SupabaseClient,
  orgId: string,
  filter: AskFilter,
  locale: StructuredAskLocale
): Promise<AskEverittSearchResponse | null> {
  let query = supabase
    .from('customers')
    .select(CUSTOMER_LIST_SELECT)
    .eq('organization_id', orgId)
    .in('pipeline_stage', ['lead', 'qualified']);

  if (filter.timeRange?.relative) {
    const range = rangeForRelative(filter.timeRange.relative);
    query = query.gte('created_at', `${range.start}T00:00:00`).lte('created_at', `${range.end}T23:59:59`);
  }

  const { data, error } = await query.order('created_at', { ascending: false }).limit(300);
  if (error) return null;
  let leads = data || [];

  if (filter.intent === 'waiting_estimate' && leads.length) {
    const ids = leads.map((lead) => lead.id);
    const { data: estimates } = await supabase
      .from('outbound_documents')
      .select('customer_id')
      .eq('organization_id', orgId)
      .eq('doc_type', 'estimate')
      .in('customer_id', ids)
      .limit(1000);
    const withEstimate = new Set((estimates || []).map((doc) => doc.customer_id).filter(Boolean));
    leads = leads.filter((lead) => !withEstimate.has(lead.id));
  }

  const results = leads.map((lead) => buildRecord('leads', {
    id: lead.id,
    type: 'lead',
    title: customerDisplayName(lead),
    subtitle: [lead.email, lead.phone].filter(Boolean).join(' · ') || null,
    status: lead.pipeline_stage || 'Lead',
    date: lead.created_at?.slice?.(0, 10) || null,
    href: `/customers/${lead.id}`
  }));

  return response(
    results.length
      ? t(locale, `${results.length} matching request${results.length === 1 ? '' : 's'}.`, `${results.length} solicitud${results.length === 1 ? '' : 'es'} coincidente${results.length === 1 ? '' : 's'}.`, `Có ${results.length} yêu cầu phù hợp.`)
      : t(locale, 'No matching requests found.', 'No se encontraron solicitudes coincidentes.', 'Không tìm thấy yêu cầu phù hợp.'),
    results,
    { sourcesUsed: ['leads', 'customers'] }
  );
}

export async function runStructuredNaturalQueryV2(
  supabase: SupabaseClient,
  orgId: string,
  userId: string,
  rawQuery: string,
  locale: StructuredAskLocale
): Promise<AskEverittSearchResponse | null> {
  const filter = parseAskFilter(rawQuery);
  if (!filter || filter.confidence < 0.55) return null;

  const normalized = canonicalize(rawQuery);
  if (filter.entity === 'invoice' && /\boverdue|past due|late\b/.test(normalized)) {
    filter.status = [...(filter.status || []), 'overdue'];
    filter.isPaid = false;
  }
  if (filter.entity === 'estimate') {
    if (/\bsent\b/.test(normalized)) filter.status = ['sent'];
    else if (/\bopen|pending|waiting\b/.test(normalized)) filter.status = ['open', 'pending'];
  }
  if ((filter.entity === 'job' || filter.entity === 'schedule') && /\bwhat's left|what is left\b/.test(normalized)) {
    filter.status = ['open', 'active', 'pending', 'scheduled'];
  }
  if (filter.entity === 'job' && /\bnext\b/.test(normalized) && !filter.limit) {
    filter.sortBy = 'start_time';
    filter.sortDir = 'asc';
    filter.limit = 1;
  }

  if (filter.entity === 'schedule') filter.entity = 'job';
  if (filter.entity === 'job') return runJobFilter(supabase, orgId, userId, filter, locale);
  if (filter.entity === 'worker') return runWorkerFilter(supabase, orgId, filter, locale);
  if (filter.entity === 'invoice') return runInvoiceFilter(supabase, orgId, filter, locale);
  if (filter.entity === 'estimate') return runEstimateFilter(supabase, orgId, filter, locale);
  if (filter.entity === 'customer') return runCustomerFilter(supabase, orgId, filter, locale);
  if (filter.entity === 'lead') return runLeadFilter(supabase, orgId, filter, locale);
  return null;
}
