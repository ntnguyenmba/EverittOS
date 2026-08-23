export type NaturalAskIntent =
  | 'next_job'
  | 'schedule_today'
  | 'schedule_tomorrow'
  | 'jobs_week'
  | 'overdue_jobs'
  | 'unpaid_invoices'
  | 'customers_owe'
  | 'revenue_month'
  | 'expenses_month'
  | 'leads_followup'
  | 'leads_month'
  | 'inactive_customers'
  | 'top_worker'
  | 'reviews'
  | 'photos'
  | 'documents'
  | 'customer_lookup'
  | 'worker_lookup'
  | 'job_lookup'
  | 'generic_records'
  | 'none';

export type NaturalAskQuery = {
  searchQuery: string;
  intent: NaturalAskIntent;
  hasRecordIntent: boolean;
  preferSearch: boolean;
};

function clean(text: string): string {
  return text
    .replace(/[’]/g, "'")
    .replace(/\b(can you|could you|would you|will you|please|pls|hey everitt|everitt|tell me|i want to know|i need to know|do you know)\b/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function canonicalizeLanguage(text: string): string {
  let q = text;

  const replacements: Array<[RegExp, string]> = [
    // Spanish
    [/\b(trabajos?|trabajo)\b/gi, 'jobs'],
    [/\b(clientes?|cliente)\b/gi, 'customers'],
    [/\b(trabajadores?|trabajador|equipo)\b/gi, 'workers'],
    [/\b(facturas?|factura)\b/gi, 'invoices'],
    [/\b(ingresos?|ventas)\b/gi, 'revenue'],
    [/\b(gastos?|gasto)\b/gi, 'expenses'],
    [/\b(prospectos?|prospecto|clientes potenciales)\b/gi, 'leads'],
    [/\b(hoy)\b/gi, 'today'],
    [/\b(mañana)\b/gi, 'tomorrow'],
    [/\b(esta semana)\b/gi, 'this week'],
    [/\b(este mes)\b/gi, 'this month'],
    [/\b(próximo|próxima|siguiente)\b/gi, 'next'],
    [/\b(vencid[oa]s?|atrasad[oa]s?)\b/gi, 'overdue'],
    [/\b(sin pagar|no pagad[oa]s?|pendientes? de pago)\b/gi, 'unpaid'],
    [/\b(deben|debe|adeudan|adeuda)\b/gi, 'owe'],
    [/\b(seguimiento)\b/gi, 'follow up'],

    // Vietnamese
    [/\b(công việc|việc làm)\b/gi, 'jobs'],
    [/\b(khách hàng)\b/gi, 'customers'],
    [/\b(nhân viên|người làm|đội ngũ)\b/gi, 'workers'],
    [/\b(hóa đơn)\b/gi, 'invoices'],
    [/\b(doanh thu|thu nhập)\b/gi, 'revenue'],
    [/\b(chi phí)\b/gi, 'expenses'],
    [/\b(khách tiềm năng)\b/gi, 'leads'],
    [/\b(hôm nay)\b/gi, 'today'],
    [/\b(ngày mai)\b/gi, 'tomorrow'],
    [/\b(tuần này)\b/gi, 'this week'],
    [/\b(tháng này)\b/gi, 'this month'],
    [/\b(tiếp theo|sắp tới)\b/gi, 'next'],
    [/\b(quá hạn|trễ hạn)\b/gi, 'overdue'],
    [/\b(chưa thanh toán|chưa trả)\b/gi, 'unpaid'],
    [/\b(nợ)\b/gi, 'owe'],
    [/\b(theo dõi)\b/gi, 'follow up']
  ];

  for (const [pattern, replacement] of replacements) q = q.replace(pattern, replacement);
  return q.replace(/\s+/g, ' ').trim();
}

function extractNamedLookup(q: string): { intent: NaturalAskIntent; query: string } | null {
  const patterns: Array<{ intent: NaturalAskIntent; re: RegExp }> = [
    { intent: 'customer_lookup', re: /^(?:find|show|open|lookup|look up|search for|where(?:'s| is))?\s*(?:customer|client)\s+(.+)$/i },
    { intent: 'worker_lookup', re: /^(?:find|show|open|lookup|look up|search for|where(?:'s| is))?\s*(?:worker|crew member|team member|employee)\s+(.+)$/i },
    { intent: 'job_lookup', re: /^(?:find|show|open|lookup|look up|search for|where(?:'s| is))?\s*(?:job|work order)\s+(.+)$/i }
  ];

  for (const item of patterns) {
    const match = q.match(item.re);
    const value = match?.[1]?.trim();
    if (value && !/^(today|tomorrow|this week|next|overdue|open|all)$/i.test(value)) {
      return { intent: item.intent, query: value };
    }
  }
  return null;
}

export function parseNaturalAskEverittQuery(input: string): NaturalAskQuery {
  const original = clean(input);
  const q = canonicalizeLanguage(original).toLowerCase();

  const make = (searchQuery: string, intent: NaturalAskIntent, hasRecordIntent = true): NaturalAskQuery => ({
    searchQuery,
    intent,
    hasRecordIntent,
    preferSearch: hasRecordIntent
  });

  if (/\b(next|upcoming)\b.*\b(job|jobs|work|appointment)\b|\bwhen(?:'s| is)\b.*\b(next|upcoming)\b.*\b(job|work)\b/.test(q)) {
    return make('next job', 'next_job');
  }

  if (/\b(what do i have|what(?:'s| is) on|anything|schedule|jobs?|work|appointments?)\b.*\btoday\b|\btoday\b.*\b(schedule|jobs?|work|appointments?)\b/.test(q)) {
    return make("today's schedule", 'schedule_today');
  }

  if (/\b(what do i have|what(?:'s| is) on|anything|schedule|jobs?|work|appointments?|who(?:'s| is) working)\b.*\btomorrow\b|\btomorrow\b.*\b(schedule|jobs?|work|appointments?)\b/.test(q)) {
    return make('jobs tomorrow', 'schedule_tomorrow');
  }

  if (/\b(this week|coming week|next few days|upcoming)\b.*\b(jobs?|work|schedule)\b|\b(jobs?|work|schedule)\b.*\b(this week|coming week|next few days)\b/.test(q)) {
    return make('upcoming jobs this week', 'jobs_week');
  }

  if (/\b(overdue|late|past due|behind)\b.*\b(jobs?|work)\b|\b(jobs?|work)\b.*\b(overdue|late|past due|behind)\b/.test(q)) {
    return make('overdue jobs', 'overdue_jobs');
  }

  if (/\b(unpaid|outstanding|past due|overdue|not paid)\b.*\b(invoices?|bills?)\b|\b(invoices?|bills?)\b.*\b(unpaid|outstanding|past due|overdue|not paid)\b/.test(q)) {
    return make('unpaid invoices', 'unpaid_invoices');
  }

  if (/\b(who|which customers?|customers?|clients?)\b.*\b(owe|owing|balance|outstanding|money due)\b|\bowe(?:s)? me\b/.test(q)) {
    return make('customers who owe money', 'customers_owe');
  }

  if (/\b(revenue|income|sales|money made|made|earned|earnings)\b.*\b(this month|month)\b|\b(this month|month)\b.*\b(revenue|income|sales|earned|made)\b/.test(q)) {
    return make('revenue this month', 'revenue_month');
  }

  if (/\b(expenses?|spend|spending|spent|costs?)\b.*\b(this month|month)\b|\b(this month|month)\b.*\b(expenses?|spend|spent|costs?)\b/.test(q)) {
    return make('expenses this month', 'expenses_month');
  }

  if (/\b(leads?)\b.*\b(follow up|follow-up|call|contact|need attention|review)\b|\b(follow up|follow-up)\b.*\b(leads?)\b/.test(q)) {
    return make('leads that need follow up', 'leads_followup');
  }

  if (/\b(new|recent|how many)\b.*\bleads?\b.*\b(this month|month)\b|\bleads?\b.*\b(this month|month)\b/.test(q)) {
    return make('leads this month', 'leads_month');
  }

  if (/\b(customers?|clients?)\b.*\b(inactive|not booked|haven't booked|have not booked|no booking)\b|\b(inactive)\b.*\b(customers?|clients?)\b/.test(q)) {
    return make('customers who have not booked in 90 days', 'inactive_customers');
  }

  if (/\b(top|best|most jobs|highest)\b.*\b(worker|crew|employee|team member)\b|\b(worker|crew|employee)\b.*\b(most|top|best)\b/.test(q)) {
    return make('top worker completed jobs this month', 'top_worker');
  }

  if (/\b(reviews?|ratings?|feedback)\b/.test(q) && !/\b(write|draft|reply|respond|summarize|analyse|analyze)\b/.test(q)) {
    return make('recent reviews', 'reviews');
  }

  if (/\b(photos?|pictures?|before and after|before-and-after)\b.*\b(jobs?|work)\b|\b(jobs?|work)\b.*\b(photos?|pictures?)\b/.test(q)) {
    return make('jobs with photos', 'photos');
  }

  if (/\b(sop|checklist|procedure|playbook|template|document|guide)\b/.test(q)) {
    return make(original, 'documents');
  }

  const named = extractNamedLookup(original);
  if (named) return make(named.query, named.intent);

  const recordWords = /\b(customer|client|job|work|lead|worker|crew|schedule|booking|appointment|invoice|expense|revenue|review|photo|form|template|sop|document|note)\b/i;
  if (recordWords.test(q)) return make(original, 'generic_records');

  return {
    searchQuery: original,
    intent: 'none',
    hasRecordIntent: false,
    preferSearch: false
  };
}
