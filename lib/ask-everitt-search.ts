import type { SupabaseClient } from '@supabase/supabase-js';
import { CUSTOMER_LIST_SELECT, customerDisplayName } from '@/lib/customer-record';
import { isMissingSchemaError } from '@/lib/supabase-schema-errors';

export type AskEverittRecordType =
  | 'customer'
  | 'job'
  | 'lead'
  | 'worker'
  | 'schedule'
  | 'form'
  | 'sop'
  | 'document'
  | 'review'
  | 'note'
  | 'invoice';

export type AskEverittSearchRecord = {
  id: string;
  type: AskEverittRecordType;
  title: string;
  subtitle: string | null;
  status: string | null;
  date: string | null;
  href: string;
  actionLabel: string;
};

export type AskEverittSearchResponse = {
  mode: 'search';
  summary: string;
  results: AskEverittSearchRecord[];
  noResultsHint?: string;
};

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

function actionLabel(type: AskEverittRecordType): string {
  const labels: Record<AskEverittRecordType, string> = {
    customer: 'Open Customer',
    job: 'Open Job',
    lead: 'Open Lead',
    worker: 'Open Worker',
    schedule: 'Open Schedule',
    form: 'Open Form',
    sop: 'Open SOP',
    document: 'Open Document',
    review: 'Open Review',
    note: 'Open Note',
    invoice: 'Open Invoice'
  };
  return labels[type];
}

function record(
  partial: Omit<AskEverittSearchRecord, 'actionLabel'> & { type: AskEverittRecordType }
): AskEverittSearchRecord {
  return { ...partial, actionLabel: actionLabel(partial.type) };
}

async function queryJobsTomorrow(
  supabase: SupabaseClient,
  orgId: string
): Promise<AskEverittSearchResponse | null> {
  const tomorrow = isoDate(addDays(new Date(), 1));
  const { data, error } = await supabase
    .from('jobs')
    .select('id, title, customer_name, status, start_date, due_date')
    .eq('organization_id', orgId)
    .or(`start_date.eq.${tomorrow},due_date.eq.${tomorrow}`)
    .order('start_date', { ascending: true })
    .limit(20);

  if (error) return null;

  const results = (data || []).map((j) =>
    record({
      id: j.id,
      type: 'schedule',
      title: j.title,
      subtitle: j.customer_name,
      status: j.status,
      date: j.start_date || j.due_date,
      href: `/jobs/${j.id}`
    })
  );

  return {
    mode: 'search',
    summary:
      results.length > 0
        ? `${results.length} job${results.length === 1 ? '' : 's'} scheduled for tomorrow (${tomorrow}).`
        : `No jobs scheduled for tomorrow (${tomorrow}).`,
    results,
    noResultsHint: results.length === 0 ? 'Add jobs with a start or due date to see them here.' : undefined
  };
}

async function queryJobsThisWeek(
  supabase: SupabaseClient,
  orgId: string
): Promise<AskEverittSearchResponse | null> {
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
    record({
      id: j.id,
      type: 'schedule',
      title: j.title,
      subtitle: j.customer_name,
      status: j.status,
      date: j.start_date || j.due_date,
      href: `/jobs/${j.id}`
    })
  );

  return {
    mode: 'search',
    summary:
      results.length > 0
        ? `${results.length} upcoming job${results.length === 1 ? '' : 's'} this week.`
        : 'No jobs scheduled this week.',
    results,
    noResultsHint: results.length === 0 ? 'Schedule jobs with start dates to track upcoming work.' : undefined
  };
}

async function queryUnpaidInvoices(
  supabase: SupabaseClient,
  orgId: string
): Promise<AskEverittSearchResponse | null> {
  const { data, error } = await supabase
    .from('invoices')
    .select('id, amount, amount_paid, status, due_date, description, customer_id')
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
    return record({
      id: inv.id,
      type: 'invoice',
      title: inv.description || `Invoice $${Number(inv.amount || 0).toFixed(2)}`,
      subtitle: owed > 0 ? `$${owed.toFixed(2)} outstanding` : null,
      status: inv.status,
      date: inv.due_date,
      href: '/invoices'
    });
  });

  return {
    mode: 'search',
    summary:
      results.length > 0
        ? `${results.length} unpaid or outstanding invoice${results.length === 1 ? '' : 's'}.`
        : 'No unpaid invoices found in your workspace.',
    results,
    noResultsHint: results.length === 0 ? 'Create invoices and mark payments to track balances.' : undefined
  };
}

async function queryLeadsThisMonth(
  supabase: SupabaseClient,
  orgId: string
): Promise<AskEverittSearchResponse | null> {
  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);

  const { data, error } = await supabase
    .from('customers')
    .select(CUSTOMER_LIST_SELECT)
    .eq('organization_id', orgId)
    .in('pipeline_stage', ['lead', 'qualified'])
    .gte('created_at', monthStart.toISOString())
    .order('created_at', { ascending: false })
    .limit(20);

  if (error) return null;

  const results = (data || []).map((c) =>
    record({
      id: c.id,
      type: 'lead',
      title: customerDisplayName(c),
      subtitle: c.email,
      status: c.pipeline_stage,
      date: c.created_at?.slice(0, 10) || null,
      href: `/customers/${c.id}`
    })
  );

  return {
    mode: 'search',
    summary:
      results.length > 0
        ? `${results.length} lead${results.length === 1 ? '' : 's'} added this month.`
        : 'No new leads recorded this month.',
    results,
    noResultsHint: results.length === 0 ? 'Add leads in CRM or capture them from forms.' : undefined
  };
}

async function queryRecentReviews(
  supabase: SupabaseClient,
  orgId: string
): Promise<AskEverittSearchResponse | null> {
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
    record({
      id: r.id,
      type: 'review',
      title: r.rating != null ? `${r.rating}★ review` : 'Customer review',
      subtitle: r.body?.slice(0, 120) || null,
      status: r.status,
      date: r.created_at?.slice(0, 10) || null,
      href: '/reviews'
    })
  );

  return {
    mode: 'search',
    summary:
      results.length > 0
        ? `${results.length} recent review${results.length === 1 ? '' : 's'}.`
        : 'No reviews found yet.',
    results,
    noResultsHint: results.length === 0 ? 'Send review requests after completed jobs.' : undefined
  };
}

async function queryJobsWithPhotos(
  supabase: SupabaseClient,
  orgId: string
): Promise<AskEverittSearchResponse | null> {
  const { data: photos, error } = await supabase
    .from('job_photos')
    .select('job_id, photo_type, created_at')
    .eq('organization_id', orgId)
    .limit(100);

  if (error) return null;

  const jobIds = Array.from(new Set((photos || []).map((p) => p.job_id).filter(Boolean))).slice(0, 20);
  if (jobIds.length === 0) {
    return {
      mode: 'search',
      summary: 'No jobs with photos found.',
      results: [],
      noResultsHint: 'Upload before-and-after photos on job pages.'
    };
  }

  const { data: jobs } = await supabase
    .from('jobs')
    .select('id, title, customer_name, status, start_date')
    .eq('organization_id', orgId)
    .in('id', jobIds);

  const results = (jobs || []).map((j) =>
    record({
      id: j.id,
      type: 'job',
      title: j.title,
      subtitle: j.customer_name,
      status: j.status,
      date: j.start_date,
      href: `/jobs/${j.id}`
    })
  );

  return {
    mode: 'search',
    summary: `${results.length} job${results.length === 1 ? '' : 's'} with photos.`,
    results
  };
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
    .or(`city.ilike.${quoted},address_line1.ilike.${quoted},service_address.ilike.${quoted},property_address.ilike.${quoted}`)
    .limit(20);

  if (error) return null;

  const results = (data || []).map((c) =>
    record({
      id: c.id,
      type: 'customer',
      title: customerDisplayName(c),
      subtitle: [c.city, c.email].filter(Boolean).join(' · ') || null,
      status: c.pipeline_stage,
      date: null,
      href: `/customers/${c.id}`
    })
  );

  return {
    mode: 'search',
    summary:
      results.length > 0
        ? `${results.length} customer${results.length === 1 ? '' : 's'} in or near ${city}.`
        : `No customers found in ${city}.`,
    results
  };
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
      record({
        id: t.id,
        type: t.category === 'sop' || t.category === 'checklist' ? 'sop' : 'document',
        title: t.title,
        subtitle: t.category,
        status: null,
        date: t.updated_at?.slice(0, 10) || null,
        href: '/templates'
      })
    );
  }
  for (const d of docs.error && isMissingSchemaError(docs.error) ? [] : docs.data || []) {
    results.push(
      record({
        id: d.id,
        type: 'document',
        title: d.title,
        subtitle: d.category,
        status: null,
        date: d.updated_at?.slice(0, 10) || null,
        href: '/knowledge'
      })
    );
  }

  if (results.length === 0) return null;

  return {
    mode: 'search',
    summary: `${results.length} SOP, checklist, or document match${results.length === 1 ? 'es' : ''} your search.`,
    results: results.slice(0, 20)
  };
}

async function queryOnboardingDocuments(
  supabase: SupabaseClient,
  orgId: string
): Promise<AskEverittSearchResponse | null> {
  const pattern = '%onboard%';
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
      record({
        id: d.id,
        type: 'document',
        title: d.title,
        subtitle: d.category,
        status: null,
        date: d.updated_at?.slice(0, 10) || null,
        href: '/knowledge'
      })
    );
  }
  for (const t of templates.data || []) {
    results.push(
      record({
        id: t.id,
        type: 'document',
        title: t.title,
        subtitle: t.category,
        status: null,
        date: t.updated_at?.slice(0, 10) || null,
        href: '/templates'
      })
    );
  }

  return {
    mode: 'search',
    summary:
      results.length > 0
        ? `${results.length} onboarding-related document${results.length === 1 ? '' : 's'}.`
        : 'No onboarding documents found.',
    results,
    noResultsHint: results.length === 0 ? 'Add onboarding SOPs or documents to your knowledge vault.' : undefined
  };
}

async function fallbackKeywordSearch(
  supabase: SupabaseClient,
  orgId: string,
  query: string
): Promise<AskEverittSearchResponse> {
  const pattern = `%${query.trim()}%`;
  const quoted = `"${pattern}"`;
  const [customers, jobs, forms, templates] = await Promise.all([
    supabase
      .from('customers')
      .select(CUSTOMER_LIST_SELECT)
      .eq('organization_id', orgId)
      .or(`company_name.ilike.${quoted},email.ilike.${quoted},notes.ilike.${quoted}`)
      .limit(8),
    supabase
      .from('jobs')
      .select('id, title, customer_name, status, start_date')
      .eq('organization_id', orgId)
      .or(`title.ilike.${quoted},customer_name.ilike.${quoted},notes.ilike.${quoted}`)
      .limit(8),
    supabase
      .from('everitt_forms')
      .select('id, name, slug')
      .eq('organization_id', orgId)
      .ilike('name', pattern)
      .limit(6),
    supabase
      .from('template_library')
      .select('id, title, category, updated_at')
      .eq('organization_id', orgId)
      .ilike('title', pattern)
      .limit(6)
  ]);

  const results: AskEverittSearchRecord[] = [];

  for (const c of customers.data || []) {
    const isLead = c.pipeline_stage === 'lead' || c.pipeline_stage === 'qualified';
    results.push(
      record({
        id: c.id,
        type: isLead ? 'lead' : 'customer',
        title: customerDisplayName(c),
        subtitle: c.email,
        status: c.pipeline_stage,
        date: null,
        href: `/customers/${c.id}`
      })
    );
  }
  for (const j of jobs.data || []) {
    results.push(
      record({
        id: j.id,
        type: 'job',
        title: j.title,
        subtitle: j.customer_name,
        status: j.status,
        date: j.start_date,
        href: `/jobs/${j.id}`
      })
    );
  }
  for (const f of forms.data || []) {
    results.push(
      record({
        id: f.id,
        type: 'form',
        title: f.name,
        subtitle: f.slug,
        status: null,
        date: null,
        href: `/forms/${f.id}`
      })
    );
  }
  for (const t of templates.data || []) {
    results.push(
      record({
        id: t.id,
        type: t.category === 'sop' ? 'sop' : 'document',
        title: t.title,
        subtitle: t.category,
        status: null,
        date: t.updated_at?.slice(0, 10) || null,
        href: '/templates'
      })
    );
  }

  const sliced = results.slice(0, 20);
  return {
    mode: 'search',
    summary:
      sliced.length > 0
        ? `Found ${sliced.length} record${sliced.length === 1 ? '' : 's'} matching "${query.trim()}".`
        : `No records found for "${query.trim()}".`,
    results: sliced,
    noResultsHint:
      sliced.length === 0
        ? 'Try a customer name, job title, city, or document keyword. Add data in CRM, Jobs, or Knowledge.'
        : undefined
  };
}

function extractCity(query: string): string | null {
  const match = query.match(/\b(?:in|near|around)\s+([A-Za-z][A-Za-z\s.-]{1,40})/i);
  return match?.[1]?.trim() || null;
}

/** Structured workspace search — no paid AI model calls. */
export async function runAskEverittSearch(
  supabase: SupabaseClient,
  organizationId: string,
  query: string
): Promise<AskEverittSearchResponse> {
  const q = query.trim().toLowerCase();
  if (!q) {
    return { mode: 'search', summary: 'Enter a question about your business data.', results: [] };
  }

  if (/\b(tomorrow|scheduled tomorrow)\b/.test(q) && /\b(job|schedule|work|appointment)\b/.test(q)) {
    const res = await queryJobsTomorrow(supabase, organizationId);
    if (res) return res;
  }

  if (/\b(this week|upcoming|coming up)\b/.test(q) && /\b(job|schedule|work)\b/.test(q)) {
    const res = await queryJobsThisWeek(supabase, organizationId);
    if (res) return res;
  }

  if (/\b(unpaid|owe|owing|outstanding|past due)\b/.test(q) && /\b(invoice|money|payment|customer)\b/.test(q)) {
    const res = await queryUnpaidInvoices(supabase, organizationId);
    if (res) return res;
  }

  if (/\bleads?\b/.test(q) && /\b(this month|month|recent|new)\b/.test(q)) {
    const res = await queryLeadsThisMonth(supabase, organizationId);
    if (res) return res;
  }

  if (/\breviews?\b/.test(q)) {
    const res = await queryRecentReviews(supabase, organizationId);
    if (res) return res;
  }

  if (/\b(before.?and.?after|photos?|pictures?)\b/.test(q) && /\bjob\b/.test(q)) {
    const res = await queryJobsWithPhotos(supabase, organizationId);
    if (res) return res;
  }

  if (/\b(onboarding|on-board)\b/.test(q) && /\b(document|doc|sop|form)\b/.test(q)) {
    const res = await queryOnboardingDocuments(supabase, organizationId);
    if (res) return res;
  }

  if (/\b(checklist|sop|procedure|kitchen|cleaning)\b/.test(q)) {
    const terms = q.replace(/\b(find|show|the|for|a|an)\b/g, ' ').trim();
    const res = await querySopsAndChecklists(supabase, organizationId, terms || q);
    if (res) return res;
  }

  const city = extractCity(q);
  if (city && /\b(customer|client|lead)\b/.test(q)) {
    const res = await queryCustomersByCity(supabase, organizationId, city);
    if (res) return res;
  }

  return fallbackKeywordSearch(supabase, organizationId, query);
}
