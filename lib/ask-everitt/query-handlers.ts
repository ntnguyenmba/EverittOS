import type { SupabaseClient } from '@supabase/supabase-js';
import { fetchDashboardRevenueMetrics, formatCurrency } from '@/lib/dashboard-metrics';
import { CUSTOMER_LIST_SELECT, customerDisplayName } from '@/lib/customer-record';
import type {
  AskEverittSearchRecord,
  AskEverittSearchResponse
} from '@/lib/ask-everitt/types';
import { ASK_EVERITT_BOOKING_QUERY_HANDLERS } from '@/lib/ask-everitt/booking-query-handlers';
import { buildRecord, groupResults, response, type QueryHandler } from '@/lib/ask-everitt/search-helpers';
import { isMissingSchemaError } from '@/lib/supabase-schema-errors';

export type { QueryHandler } from '@/lib/ask-everitt/search-helpers';

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function addDays(base: Date, days: number): Date {
  const d = new Date(base);
  d.setDate(d.getDate() + days);
  return d;
}

function startOfWeek(d: Date): Date {
  const copy = new Date(d);
  const day = copy.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  copy.setDate(copy.getDate() + diff);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

function monthStartIso(): string {
  const d = new Date();
  d.setDate(1);
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}

function monthStartDate(): string {
  return isoDate(new Date(new Date().getFullYear(), new Date().getMonth(), 1));
}

function extractCity(query: string): string | null {
  const match = query.match(/\b(?:in|near|around)\s+([A-Za-z][A-Za-z\s.-]{1,40})/i);
  return match?.[1]?.trim() || null;
}

async function queryJobsTomorrow(supabase: SupabaseClient, orgId: string): Promise<AskEverittSearchResponse | null> {
  const tomorrow = isoDate(addDays(new Date(), 1));
  const { data, error } = await supabase
    .from('jobs')
    .select('id, title, customer_name, status, start_date, due_date, assigned_to')
    .eq('organization_id', orgId)
    .or(`start_date.eq.${tomorrow},due_date.eq.${tomorrow}`)
    .order('start_date', { ascending: true })
    .limit(20);

  if (error) return null;

  const results = (data || []).map((j) =>
    buildRecord('schedule', {
      id: j.id,
      title: j.title,
      subtitle: j.customer_name,
      status: j.status,
      date: j.start_date || j.due_date,
      owner: j.assigned_to ? 'Assigned crew' : null,
      href: `/jobs/${j.id}`
    })
  );

  return response(
    results.length > 0
      ? `${results.length} job${results.length === 1 ? '' : 's'} scheduled for tomorrow (${tomorrow}).`
      : `No jobs scheduled for tomorrow (${tomorrow}).`,
    results,
    { sourcesUsed: ['schedule'], noResultsHint: results.length === 0 ? 'Add jobs with start or due dates.' : undefined }
  );
}

async function queryJobsThisWeek(supabase: SupabaseClient, orgId: string): Promise<AskEverittSearchResponse | null> {
  const start = isoDate(startOfWeek(new Date()));
  const end = isoDate(addDays(startOfWeek(new Date()), 6));
  const { data, error } = await supabase
    .from('jobs')
    .select('id, title, customer_name, status, start_date, due_date')
    .eq('organization_id', orgId)
    .gte('start_date', start)
    .lte('start_date', end)
    .order('start_date', { ascending: true })
    .limit(25);

  if (error) return null;

  const results = (data || []).map((j) =>
    buildRecord('schedule', {
      id: j.id,
      title: j.title,
      subtitle: j.customer_name,
      status: j.status,
      date: j.start_date || j.due_date,
      href: `/jobs/${j.id}`
    })
  );

  return response(
    results.length > 0
      ? `${results.length} upcoming job${results.length === 1 ? '' : 's'} this week.`
      : 'No jobs scheduled this week.',
    results,
    { sourcesUsed: ['schedule'] }
  );
}

async function queryUnpaidInvoices(supabase: SupabaseClient, orgId: string): Promise<AskEverittSearchResponse | null> {
  const { data, error } = await supabase
    .from('invoices')
    .select('id, amount, amount_paid, status, due_date, description')
    .eq('organization_id', orgId)
    .in('status', ['sent', 'open', 'overdue', 'unpaid', 'past_due'])
    .order('due_date', { ascending: true })
    .limit(20);

  if (error) {
    if (isMissingSchemaError(error)) return null;
    return null;
  }

  const results = (data || []).map((inv) => {
    const owed = Number(inv.amount || 0) - Number(inv.amount_paid || 0);
    return buildRecord('invoices', {
      id: inv.id,
      title: inv.description || `Invoice ${formatCurrency(Number(inv.amount || 0))}`,
      subtitle: owed > 0 ? `${formatCurrency(owed)} outstanding` : null,
      status: inv.status,
      date: inv.due_date,
      href: '/invoices'
    });
  });

  return response(
    results.length > 0
      ? `${results.length} unpaid or outstanding invoice${results.length === 1 ? '' : 's'}.`
      : 'No unpaid invoices found.',
    results,
    { sourcesUsed: ['invoices'] }
  );
}

async function queryLeadsThisMonth(supabase: SupabaseClient, orgId: string): Promise<AskEverittSearchResponse | null> {
  const { data, error } = await supabase
    .from('customers')
    .select(CUSTOMER_LIST_SELECT)
    .eq('organization_id', orgId)
    .in('pipeline_stage', ['lead', 'qualified'])
    .gte('created_at', monthStartIso())
    .order('created_at', { ascending: false })
    .limit(20);

  if (error) return null;

  const results = (data || []).map((c) =>
    buildRecord('leads', {
      id: c.id,
      title: customerDisplayName(c),
      subtitle: c.email,
      status: c.pipeline_stage,
      date: c.created_at?.slice(0, 10) || null
    })
  );

  return response(
    results.length > 0
      ? `${results.length} lead${results.length === 1 ? '' : 's'} added this month.`
      : 'No new leads recorded this month.',
    results,
    { sourcesUsed: ['leads'] }
  );
}

async function queryRecentReviews(supabase: SupabaseClient, orgId: string): Promise<AskEverittSearchResponse | null> {
  const { data, error } = await supabase
    .from('customer_reviews')
    .select('id, rating, body, status, created_at')
    .eq('organization_id', orgId)
    .order('created_at', { ascending: false })
    .limit(15);

  if (error) {
    if (isMissingSchemaError(error)) return null;
    return null;
  }

  const results = (data || []).map((r) =>
    buildRecord('reviews', {
      id: r.id,
      title: r.rating != null ? `${r.rating}★ review` : 'Customer review',
      subtitle: r.body?.slice(0, 120) || null,
      status: r.status,
      date: r.created_at?.slice(0, 10) || null,
      href: '/reviews'
    })
  );

  return response(
    results.length > 0
      ? `${results.length} recent review${results.length === 1 ? '' : 's'}.`
      : 'No reviews found yet.',
    results,
    { sourcesUsed: ['reviews'] }
  );
}

async function queryJobsWithPhotos(supabase: SupabaseClient, orgId: string): Promise<AskEverittSearchResponse | null> {
  const { data: photos, error } = await supabase
    .from('job_photos')
    .select('job_id, photo_type')
    .eq('organization_id', orgId)
    .limit(150);

  if (error) return null;

  const jobIds = Array.from(new Set((photos || []).map((p) => p.job_id).filter(Boolean))).slice(0, 20);
  if (jobIds.length === 0) {
    return response('No jobs with photos found.', [], {
      sourcesUsed: ['photos'],
      noResultsHint: 'Upload before-and-after photos on job pages.'
    });
  }

  const { data: jobs } = await supabase
    .from('jobs')
    .select('id, title, customer_name, status, start_date')
    .eq('organization_id', orgId)
    .in('id', jobIds);

  const results = (jobs || []).map((j) =>
    buildRecord('photos', {
      id: j.id,
      type: 'job',
      title: j.title,
      subtitle: j.customer_name,
      status: j.status,
      date: j.start_date,
      href: `/jobs/${j.id}`
    })
  );

  return response(`${results.length} job${results.length === 1 ? '' : 's'} with photos.`, results, {
    sourcesUsed: ['photos', 'jobs']
  });
}

async function queryCustomersByCity(
  supabase: SupabaseClient,
  orgId: string,
  city: string
): Promise<AskEverittSearchResponse | null> {
  const pattern = `%${city}%`;
  const quoted = `"${pattern}"`;
  const { data, error } = await supabase
    .from('customers')
    .select(CUSTOMER_LIST_SELECT)
    .eq('organization_id', orgId)
    .or(
      `city.ilike.${quoted},address_line1.ilike.${quoted},service_address.ilike.${quoted},property_address.ilike.${quoted}`
    )
    .limit(20);

  if (error) return null;

  const results = (data || []).map((c) =>
    buildRecord('customers', {
      id: c.id,
      title: customerDisplayName(c),
      subtitle: [c.city, c.email].filter(Boolean).join(' · ') || null,
      status: c.pipeline_stage,
      date: null
    })
  );

  return response(
    results.length > 0
      ? `${results.length} customer${results.length === 1 ? '' : 's'} in or near ${city}.`
      : `No customers found in ${city}.`,
    results,
    { sourcesUsed: ['customers'] }
  );
}

async function queryInactiveCustomers90Days(
  supabase: SupabaseClient,
  orgId: string
): Promise<AskEverittSearchResponse | null> {
  const cutoff = isoDate(addDays(new Date(), -90));

  const { data: customers, error: custErr } = await supabase
    .from('customers')
    .select(CUSTOMER_LIST_SELECT)
    .eq('organization_id', orgId)
    .not('pipeline_stage', 'in', '("lead","qualified","archived")')
    .limit(200);

  if (custErr || !customers?.length) {
    return response('No customers found to analyze.', [], { sourcesUsed: ['customers'] });
  }

  const { data: recentJobs } = await supabase
    .from('jobs')
    .select('customer_id, start_date, created_at')
    .eq('organization_id', orgId)
    .gte('created_at', `${cutoff}T00:00:00`)
    .not('status', 'eq', 'cancelled');

  const activeCustomerIds = new Set(
    (recentJobs || []).map((j) => j.customer_id).filter(Boolean) as string[]
  );

  const inactive = customers.filter((c) => !activeCustomerIds.has(c.id)).slice(0, 20);

  const results = inactive.map((c) =>
    buildRecord('customers', {
      id: c.id,
      title: customerDisplayName(c),
      subtitle: c.email,
      status: 'No booking in 90 days',
      date: c.updated_at?.slice(0, 10) || null
    })
  );

  return response(
    results.length > 0
      ? `${results.length} customer${results.length === 1 ? '' : 's'} with no jobs in the last 90 days.`
      : 'All active customers have had a job in the last 90 days.',
    results,
    {
      sourcesUsed: ['customers', 'jobs'],
      noResultsHint: results.length === 0 ? undefined : 'These customers may need a follow-up or reactivation campaign.'
    }
  );
}

async function queryTopWorkerThisMonth(
  supabase: SupabaseClient,
  orgId: string
): Promise<AskEverittSearchResponse | null> {
  const monthStart = monthStartDate();

  const { data: jobs, error } = await supabase
    .from('jobs')
    .select('id, assigned_to, status, start_date, updated_at')
    .eq('organization_id', orgId)
    .eq('status', 'completed')
    .gte('updated_at', `${monthStart}T00:00:00`)
    .limit(500);

  if (error) return null;

  const counts = new Map<string, number>();
  for (const j of jobs || []) {
    if (!j.assigned_to) continue;
    counts.set(j.assigned_to, (counts.get(j.assigned_to) || 0) + 1);
  }

  if (counts.size === 0) {
    return response('No completed jobs with assigned workers this month.', [], {
      sourcesUsed: ['workers', 'jobs'],
      noResultsHint: 'Assign workers to jobs and mark jobs completed to track performance.'
    });
  }

  const sorted = Array.from(counts.entries()).sort((a, b) => b[1] - a[1]);
  const topId = sorted[0][0];
  const topCount = sorted[0][1];

  const { data: worker } = await supabase
    .from('workers')
    .select('id, name, role')
    .eq('organization_id', orgId)
    .eq('id', topId)
    .maybeSingle();

  const results: AskEverittSearchRecord[] = [];
  if (worker) {
    results.push(
      buildRecord('workers', {
        id: worker.id,
        title: worker.name || 'Worker',
        subtitle: `${topCount} completed job${topCount === 1 ? '' : 's'} this month`,
        status: worker.role,
        date: monthStart,
        owner: worker.name,
        href: '/workers'
      })
    );
  }

  for (const [workerId, count] of sorted.slice(1, 5)) {
    const { data: w } = await supabase
      .from('workers')
      .select('id, name, role')
      .eq('id', workerId)
      .maybeSingle();
    if (w) {
      results.push(
        buildRecord('workers', {
          id: w.id,
          title: w.name || 'Worker',
          subtitle: `${count} completed jobs`,
          status: w.role,
          date: null,
          href: '/workers'
        })
      );
    }
  }

  return response(
    worker
      ? `${worker.name || 'Worker'} completed the most jobs this month (${topCount}).`
      : `Top team member completed ${topCount} jobs this month.`,
    results,
    { sourcesUsed: ['workers', 'jobs'] }
  );
}

async function queryRevenueThisMonth(
  supabase: SupabaseClient,
  orgId: string
): Promise<AskEverittSearchResponse | null> {
  const metrics = await fetchDashboardRevenueMetrics(supabase, orgId);
  return response(`Revenue this month: ${formatCurrency(metrics.revenueThisMonth)}.`, [], {
    sourcesUsed: ['revenue', 'invoices'],
    metrics: [
      { label: 'Revenue this month', value: formatCurrency(metrics.revenueThisMonth), href: '/analytics' },
      { label: 'Outstanding invoices', value: formatCurrency(metrics.outstandingInvoices), href: '/invoices' },
      { label: 'Jobs completed', value: String(metrics.jobsCompleted), href: '/jobs' },
      { label: 'Active customers', value: String(metrics.activeCustomers), href: '/customers' }
    ]
  });
}

async function queryExpensesThisMonth(
  supabase: SupabaseClient,
  orgId: string
): Promise<AskEverittSearchResponse | null> {
  const monthStart = monthStartDate();
  const { data, error } = await supabase
    .from('expenses')
    .select('id, category, vendor, description, amount, date')
    .eq('organization_id', orgId)
    .gte('date', monthStart)
    .order('date', { ascending: false })
    .limit(20);

  if (error) {
    if (isMissingSchemaError(error)) return null;
    return null;
  }

  const total = (data || []).reduce((s, e) => s + Number(e.amount || 0), 0);
  const results = (data || []).map((e) =>
    buildRecord('expenses', {
      id: e.id,
      title: e.description || e.vendor || e.category,
      subtitle: e.category,
      status: null,
      date: e.date,
      href: '/expenses'
    })
  );

  return response(
    `Expenses this month: ${formatCurrency(total)} across ${results.length} recorded expense${results.length === 1 ? '' : 's'}.`,
    results,
    {
      sourcesUsed: ['expenses'],
      metrics: [{ label: 'Total expenses this month', value: formatCurrency(total), href: '/expenses' }]
    }
  );
}

async function querySopsAndChecklists(
  supabase: SupabaseClient,
  orgId: string,
  terms: string
): Promise<AskEverittSearchResponse | null> {
  const pattern = `%${terms}%`;
  const quoted = `"${pattern}"`;
  const [templates, docs] = await Promise.all([
    supabase
      .from('template_library')
      .select('id, title, category, updated_at')
      .eq('organization_id', orgId)
      .or(`title.ilike.${quoted},body.ilike.${quoted}`)
      .limit(12),
    supabase
      .from('knowledge_documents')
      .select('id, title, category, updated_at')
      .eq('organization_id', orgId)
      .or(`title.ilike.${quoted},body.ilike.${quoted}`)
      .limit(12)
  ]);

  const results: AskEverittSearchRecord[] = [];
  for (const t of templates.data || []) {
    results.push(
      buildRecord(t.category === 'sop' ? 'sops' : 'templates', {
        id: t.id,
        type: t.category === 'sop' || t.category === 'checklist' ? 'sop' : 'document',
        title: t.title,
        subtitle: t.category,
        date: t.updated_at?.slice(0, 10) || null
      })
    );
  }
  for (const d of docs.error && isMissingSchemaError(docs.error) ? [] : docs.data || []) {
    results.push(
      buildRecord('documents', {
        id: d.id,
        title: d.title,
        subtitle: d.category,
        date: d.updated_at?.slice(0, 10) || null
      })
    );
  }

  if (results.length === 0) return null;

  return response(`${results.length} SOP, checklist, or document matches.`, results.slice(0, 20), {
    sourcesUsed: ['sops', 'documents', 'templates']
  });
}

async function queryOnboardingDocuments(
  supabase: SupabaseClient,
  orgId: string
): Promise<AskEverittSearchResponse | null> {
  const quoted = '"%onboard%"';
  const [docs, templates] = await Promise.all([
    supabase
      .from('knowledge_documents')
      .select('id, title, category, updated_at')
      .eq('organization_id', orgId)
      .or(`title.ilike.${quoted},category.ilike.${quoted}`)
      .limit(15),
    supabase
      .from('template_library')
      .select('id, title, category, updated_at')
      .eq('organization_id', orgId)
      .or(`title.ilike.${quoted},category.ilike.${quoted}`)
      .limit(15)
  ]);

  const results: AskEverittSearchRecord[] = [];
  for (const d of docs.data || []) {
    results.push(
      buildRecord('documents', {
        id: d.id,
        title: d.title,
        subtitle: d.category,
        date: d.updated_at?.slice(0, 10) || null
      })
    );
  }
  for (const t of templates.data || []) {
    results.push(
      buildRecord('sops', {
        id: t.id,
        type: 'document',
        title: t.title,
        subtitle: t.category,
        date: t.updated_at?.slice(0, 10) || null
      })
    );
  }

  return response(
    results.length > 0
      ? `${results.length} onboarding-related document${results.length === 1 ? '' : 's'}.`
      : 'No onboarding documents found.',
    results,
    { sourcesUsed: ['sops', 'documents'] }
  );
}

async function queryRecentActivity(
  supabase: SupabaseClient,
  orgId: string
): Promise<AskEverittSearchResponse | null> {
  const { data, error } = await supabase
    .from('activity_logs')
    .select('id, action, entity_type, entity_id, message, created_at, user_id')
    .eq('organization_id', orgId)
    .order('created_at', { ascending: false })
    .limit(15);

  if (error) {
    if (isMissingSchemaError(error)) return null;
    return null;
  }

  const results = (data || []).map((a) =>
    buildRecord('activity', {
      id: a.id,
      title: a.message || a.action || 'Activity',
      subtitle: a.entity_type,
      status: a.action,
      date: a.created_at?.slice(0, 10) || null,
      href: '/activity'
    })
  );

  return response(
    results.length > 0 ? `${results.length} recent activity entries.` : 'No activity logged yet.',
    results,
    { sourcesUsed: ['activity'] }
  );
}

async function queryCustomersOweMoney(
  supabase: SupabaseClient,
  orgId: string
): Promise<AskEverittSearchResponse | null> {
  const { data: invoices, error } = await supabase
    .from('invoices')
    .select('customer_id, amount, amount_paid')
    .eq('organization_id', orgId)
    .not('customer_id', 'is', null);

  if (error || !invoices?.length) return queryUnpaidInvoices(supabase, orgId);

  const owedByCustomer = new Map<string, number>();
  for (const inv of invoices) {
    const owed = Math.max(0, Number(inv.amount || 0) - Number(inv.amount_paid || 0));
    if (owed <= 0 || !inv.customer_id) continue;
    owedByCustomer.set(inv.customer_id, (owedByCustomer.get(inv.customer_id) || 0) + owed);
  }

  const customerIds = Array.from(owedByCustomer.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 20)
    .map(([id]) => id);

  if (customerIds.length === 0) {
    return response('No customers with outstanding balances.', [], { sourcesUsed: ['customers', 'invoices'] });
  }

  const { data: customers } = await supabase
    .from('customers')
    .select(CUSTOMER_LIST_SELECT)
    .eq('organization_id', orgId)
    .in('id', customerIds);

  const results = (customers || []).map((c) =>
    buildRecord('customers', {
      id: c.id,
      title: customerDisplayName(c),
      subtitle: `${formatCurrency(owedByCustomer.get(c.id) || 0)} owed`,
      status: 'Outstanding balance',
      date: null
    })
  );

  return response(
    `${results.length} customer${results.length === 1 ? '' : 's'} with outstanding balances.`,
    results,
    { sourcesUsed: ['customers', 'invoices'] }
  );
}

/** Pattern-matched handlers run before universal source search. Booking handlers first. */
export const ASK_EVERITT_QUERY_HANDLERS: { match: RegExp; run: QueryHandler }[] = [
  ...ASK_EVERITT_BOOKING_QUERY_HANDLERS,
  {
    match: /\b(tomorrow|scheduled tomorrow)\b.*\b(job|schedule|work|appointment)\b|\b(job|schedule)\b.*\btomorrow\b/,
    run: (s, o) => queryJobsTomorrow(s, o)
  },
  {
    match: /\b(this week|upcoming|coming up)\b.*\b(job|schedule|work)\b/,
    run: (s, o) => queryJobsThisWeek(s, o)
  },
  {
    match: /\b(revenue|income|earnings|sales)\b.*\b(this month|month)\b|\b(this month|month)\b.*\b(revenue|income)\b/,
    run: (s, o) => queryRevenueThisMonth(s, o)
  },
  {
    match: /\b(expense|expenses|spend|spending)\b.*\b(this month|month)\b|\b(this month|month)\b.*\b(expense|expenses)\b/,
    run: (s, o) => queryExpensesThisMonth(s, o)
  },
  {
    match: /\b(unpaid|outstanding|past due)\b.*\b(invoice|invoices)\b|\bshow\b.*\bunpaid\b.*\binvoice/,
    run: (s, o) => queryUnpaidInvoices(s, o)
  },
  {
    match: /\b(customers?|clients?)\b.*\b(owe|owing|outstanding|balance|money)\b|\bwho\b.*\bowe\b/,
    run: (s, o) => queryCustomersOweMoney(s, o)
  },
  {
    match: /\b(not booked|haven't booked|have not booked|inactive|no booking)\b.*\b(90|ninety)\b|\b90\b.*\bday/,
    run: (s, o) => queryInactiveCustomers90Days(s, o)
  },
  {
    match: /\b(worker|crew|technician)\b.*\b(most|top|completed|finished)\b.*\b(job|month)\b/,
    run: (s, o) => queryTopWorkerThisMonth(s, o)
  },
  {
    match: /\bleads?\b.*\b(this month|month|recent|new)\b/,
    run: (s, o) => queryLeadsThisMonth(s, o)
  },
  {
    match: /\breviews?\b/,
    run: (s, o, query) =>
      /\b(summarize|analyze|write|draft|generate)\b/i.test(query)
        ? Promise.resolve(null)
        : queryRecentReviews(s, o)
  },
  {
    match: /\b(before.?and.?after|photos?|pictures?)\b.*\bjob\b|\bjobs?\b.*\b(photo|picture)/,
    run: (s, o) => queryJobsWithPhotos(s, o)
  },
  {
    match: /\b(onboarding|on-board)\b.*\b(document|doc|sop|form)\b|\b(find|show)\b.*\bonboarding\b.*\bsop\b/,
    run: (s, o) => queryOnboardingDocuments(s, o)
  },
  {
    match: /\b(activity|history|audit)\b.*\b(recent|log|latest)\b|\brecent\b.*\bactivity\b/,
    run: (s, o) => queryRecentActivity(s, o)
  },
  {
    match: /\b(checklist|sop|procedure|kitchen|cleaning)\b/,
    run: (s, o, q) => {
      const terms = q.replace(/\b(find|show|the|for|a|an|my)\b/gi, ' ').trim();
      return querySopsAndChecklists(s, o, terms || q);
    }
  }
];

export async function runMatchedQueryHandler(
  supabase: SupabaseClient,
  orgId: string,
  query: string
): Promise<AskEverittSearchResponse | null> {
  const q = query.trim().toLowerCase();
  for (const handler of ASK_EVERITT_QUERY_HANDLERS) {
    if (handler.match.test(q)) {
      const city = extractCity(q);
      if (handler.match.source.includes('customer') && city && /\b(in|near)\b/.test(q)) {
        const cityResult = await queryCustomersByCity(supabase, orgId, city);
        if (cityResult && cityResult.results.length > 0) return cityResult;
      }
      const result = await handler.run(supabase, orgId, query);
      if (result) return result;
    }
  }

  const city = extractCity(q);
  if (city && /\b(customer|client|lead|show)\b/.test(q)) {
    return queryCustomersByCity(supabase, orgId, city);
  }

  return null;
}

export { buildRecord, groupResults, response };
