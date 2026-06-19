import type { SupabaseClient } from '@supabase/supabase-js';
import { CUSTOMER_LIST_SELECT, customerDisplayName } from '@/lib/customer-record';
import { formatCurrency } from '@/lib/dashboard-metrics';
import type { AskEverittSearchRecord, AskEverittSearchResponse } from '@/lib/ask-everitt/types';
import {
  getSearchSource,
  getSearchSources,
  resolveHref,
  resolveSearchSourcesFromQuery,
  type SearchSourceId
} from '@/lib/ask-everitt/search-sources';
import { buildRecord, groupResults, response } from '@/lib/ask-everitt/search-helpers';
import { runMatchedQueryHandler } from '@/lib/ask-everitt/query-handlers';
import { isMissingSchemaError } from '@/lib/supabase-schema-errors';

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function startOfDay(d = new Date()): string {
  const copy = new Date(d);
  copy.setHours(0, 0, 0, 0);
  return copy.toISOString();
}

function endOfDay(d = new Date()): string {
  const copy = new Date(d);
  copy.setHours(23, 59, 59, 999);
  return copy.toISOString();
}

function isClosedStatus(status?: string | null): boolean {
  const value = String(status || '').toLowerCase();
  return ['done', 'complete', 'completed', 'paid', 'cancelled', 'canceled', 'closed', 'void'].includes(value);
}

async function queryTodaysSchedule(supabase: SupabaseClient, orgId: string): Promise<AskEverittSearchResponse | null> {
  const today = isoDate(new Date());
  const [jobsRes, bookingsRes] = await Promise.all([
    supabase
      .from('jobs')
      .select('id, title, customer_name, status, start_date, due_date, assigned_to')
      .eq('organization_id', orgId)
      .or(`start_date.eq.${today},due_date.eq.${today}`)
      .order('start_date', { ascending: true })
      .limit(20),
    supabase
      .from('bookings')
      .select('id, client_name, starts_at, ends_at, status, manual_service_name, staff_name, services(name), workers(name)')
      .eq('organization_id', orgId)
      .gte('starts_at', startOfDay())
      .lte('starts_at', endOfDay())
      .not('status', 'eq', 'cancelled')
      .order('starts_at', { ascending: true })
      .limit(20)
  ]);

  const results: AskEverittSearchRecord[] = [];

  for (const j of jobsRes.data || []) {
    results.push(
      buildRecord('schedule', {
        id: j.id,
        type: 'job',
        title: j.title || 'Job',
        subtitle: j.customer_name || null,
        status: j.status,
        date: j.start_date || j.due_date,
        owner: j.assigned_to ? 'Assigned crew' : null,
        href: `/jobs/${j.id}`
      })
    );
  }

  if (!bookingsRes.error || !isMissingSchemaError(bookingsRes.error)) {
    for (const b of bookingsRes.data || []) {
      const serviceName = (b.services as { name?: string } | null)?.name || b.manual_service_name || 'Appointment';
      const staffName = (b.workers as { name?: string } | null)?.name || b.staff_name || null;
      results.push(
        buildRecord('bookings', {
          id: b.id,
          type: 'booking',
          title: `${b.client_name || 'Customer'} — ${serviceName}`,
          subtitle: staffName ? `Staff: ${staffName}` : null,
          status: b.status,
          date: b.starts_at?.slice(0, 10) || null,
          owner: staffName,
          href: '/bookings'
        })
      );
    }
  }

  return response(
    results.length > 0
      ? `${results.length} item${results.length === 1 ? '' : 's'} on today's schedule.`
      : 'Nothing is scheduled for today yet.',
    results.slice(0, 24),
    { sourcesUsed: ['schedule', 'jobs', 'bookings'], noResultsHint: results.length === 0 ? 'Create a job or booking to build today’s schedule.' : undefined }
  );
}

async function queryOverdueJobs(supabase: SupabaseClient, orgId: string): Promise<AskEverittSearchResponse | null> {
  const today = isoDate(new Date());
  const { data, error } = await supabase
    .from('jobs')
    .select('id, title, customer_name, status, start_date, due_date, assigned_to')
    .eq('organization_id', orgId)
    .lt('due_date', today)
    .order('due_date', { ascending: true })
    .limit(30);

  if (error) return null;

  const openJobs = (data || []).filter((job) => !isClosedStatus(job.status));
  const results = openJobs.map((j) =>
    buildRecord('jobs', {
      id: j.id,
      type: 'job',
      title: j.title || 'Job',
      subtitle: j.customer_name || null,
      status: j.status || 'Overdue',
      date: j.due_date,
      owner: j.assigned_to ? 'Assigned crew' : null,
      href: `/jobs/${j.id}`
    })
  );

  return response(
    results.length > 0 ? `${results.length} overdue job${results.length === 1 ? '' : 's'} need attention.` : 'No overdue jobs found.',
    results,
    { sourcesUsed: ['jobs'], noResultsHint: results.length === 0 ? undefined : 'Open these jobs and update the status, due date, or assignment.' }
  );
}

async function queryLeadsNeedingFollowUp(supabase: SupabaseClient, orgId: string): Promise<AskEverittSearchResponse | null> {
  const { data, error } = await supabase
    .from('customers')
    .select(CUSTOMER_LIST_SELECT)
    .eq('organization_id', orgId)
    .in('pipeline_stage', ['lead', 'qualified'])
    .order('updated_at', { ascending: true })
    .limit(20);

  if (error) return null;

  const results = (data || []).map((c) =>
    buildRecord('leads', {
      id: c.id,
      title: customerDisplayName(c),
      subtitle: [c.email, c.phone].filter(Boolean).join(' · ') || null,
      status: c.pipeline_stage || 'Lead',
      date: c.updated_at?.slice(0, 10) || c.created_at?.slice(0, 10) || null,
      href: `/customers/${c.id}`
    })
  );

  return response(
    results.length > 0
      ? `${results.length} lead${results.length === 1 ? '' : 's'} should be reviewed for follow-up.`
      : 'No open leads need follow-up right now.',
    results,
    { sourcesUsed: ['leads', 'customers'], noResultsHint: results.length === 0 ? 'New leads will appear here when their pipeline stage is lead or qualified.' : undefined }
  );
}

async function queryBestCustomers(supabase: SupabaseClient, orgId: string): Promise<AskEverittSearchResponse | null> {
  const { data: invoices, error } = await supabase
    .from('invoices')
    .select('customer_id, amount, amount_paid, status')
    .eq('organization_id', orgId)
    .not('customer_id', 'is', null)
    .limit(500);

  if (error) {
    if (isMissingSchemaError(error)) return null;
    return null;
  }

  const totals = new Map<string, number>();
  for (const inv of invoices || []) {
    if (!inv.customer_id) continue;
    const paidAmount = Number(inv.amount_paid || 0) > 0 ? Number(inv.amount_paid || 0) : isClosedStatus(inv.status) ? Number(inv.amount || 0) : 0;
    if (paidAmount <= 0) continue;
    totals.set(inv.customer_id, (totals.get(inv.customer_id) || 0) + paidAmount);
  }

  const ids = Array.from(totals.entries()).sort((a, b) => b[1] - a[1]).slice(0, 10).map(([id]) => id);
  if (ids.length === 0) {
    return response('No best-customer ranking yet because no paid invoice history was found.', [], {
      sourcesUsed: ['customers', 'invoices'],
      noResultsHint: 'Paid invoices will help EverittOS identify top customers.'
    });
  }

  const { data: customers } = await supabase
    .from('customers')
    .select(CUSTOMER_LIST_SELECT)
    .eq('organization_id', orgId)
    .in('id', ids);

  const results = (customers || [])
    .sort((a, b) => (totals.get(b.id) || 0) - (totals.get(a.id) || 0))
    .map((c) =>
      buildRecord('customers', {
        id: c.id,
        title: customerDisplayName(c),
        subtitle: `${formatCurrency(totals.get(c.id) || 0)} paid`,
        status: 'Top customer',
        date: null,
        href: `/customers/${c.id}`
      })
    );

  return response(`${results.length} top customer${results.length === 1 ? '' : 's'} by paid invoice history.`, results, {
    sourcesUsed: ['customers', 'invoices']
  });
}

async function queryNeedsAttention(supabase: SupabaseClient, orgId: string): Promise<AskEverittSearchResponse | null> {
  const today = isoDate(new Date());
  const [overdueJobs, leads, invoices] = await Promise.all([
    supabase
      .from('jobs')
      .select('id, title, customer_name, status, due_date')
      .eq('organization_id', orgId)
      .lt('due_date', today)
      .order('due_date', { ascending: true })
      .limit(8),
    supabase
      .from('customers')
      .select(CUSTOMER_LIST_SELECT)
      .eq('organization_id', orgId)
      .in('pipeline_stage', ['lead', 'qualified'])
      .order('updated_at', { ascending: true })
      .limit(8),
    supabase
      .from('invoices')
      .select('id, description, amount, amount_paid, status, due_date')
      .eq('organization_id', orgId)
      .in('status', ['sent', 'open', 'overdue', 'unpaid', 'past_due'])
      .order('due_date', { ascending: true })
      .limit(8)
  ]);

  const results: AskEverittSearchRecord[] = [];
  for (const j of overdueJobs.data || []) {
    if (isClosedStatus(j.status)) continue;
    results.push(buildRecord('jobs', { id: j.id, type: 'job', title: j.title || 'Overdue job', subtitle: j.customer_name || null, status: j.status || 'Overdue', date: j.due_date, href: `/jobs/${j.id}` }));
  }
  for (const inv of invoices.data || []) {
    const owed = Number(inv.amount || 0) - Number(inv.amount_paid || 0);
    results.push(buildRecord('invoices', { id: inv.id, title: inv.description || `Invoice ${formatCurrency(Number(inv.amount || 0))}`, subtitle: owed > 0 ? `${formatCurrency(owed)} outstanding` : null, status: inv.status, date: inv.due_date, href: '/invoices' }));
  }
  for (const c of leads.data || []) {
    results.push(buildRecord('leads', { id: c.id, title: customerDisplayName(c), subtitle: c.email, status: c.pipeline_stage, date: c.updated_at?.slice(0, 10) || c.created_at?.slice(0, 10) || null, href: `/customers/${c.id}` }));
  }

  const overdueCount = (overdueJobs.data || []).filter((j) => !isClosedStatus(j.status)).length;
  const invoiceCount = invoices.data?.length || 0;
  const leadCount = leads.data?.length || 0;

  return response(
    `Today’s business brief: ${overdueCount} overdue job${overdueCount === 1 ? '' : 's'}, ${invoiceCount} unpaid invoice${invoiceCount === 1 ? '' : 's'}, and ${leadCount} lead${leadCount === 1 ? '' : 's'} to review.`,
    results.slice(0, 24),
    {
      sourcesUsed: ['jobs', 'invoices', 'leads'],
      metrics: [
        { label: 'Overdue jobs', value: String(overdueCount), href: '/jobs' },
        { label: 'Unpaid invoices', value: String(invoiceCount), href: '/invoices' },
        { label: 'Leads to review', value: String(leadCount), href: '/leads' }
      ],
      noResultsHint: results.length === 0 ? 'No urgent items found from jobs, invoices, or leads.' : undefined
    }
  );
}

async function runOwnerQuestionHandler(
  supabase: SupabaseClient,
  orgId: string,
  query: string
): Promise<AskEverittSearchResponse | null> {
  const q = query.trim().toLowerCase();
  if (/\b(what needs attention|needs attention|business brief|focus on today|what should i focus|focus next)\b/.test(q)) {
    return queryNeedsAttention(supabase, orgId);
  }
  if (/\b(today|today's)\b.*\b(schedule|jobs?|appointments?|bookings?)\b|\b(show|what's|what is)\b.*\b(today|today's)\b/.test(q)) {
    return queryTodaysSchedule(supabase, orgId);
  }
  if (/\b(overdue|late|past due)\b.*\b(jobs?|work)\b|\b(jobs?|work)\b.*\b(overdue|late|past due)\b/.test(q)) {
    return queryOverdueJobs(supabase, orgId);
  }
  if (/\b(leads?)\b.*\b(follow.?up|review|call|contact|need)\b|\b(follow.?up)\b.*\b(leads?)\b/.test(q)) {
    return queryLeadsNeedingFollowUp(supabase, orgId);
  }
  if (/\b(best|top|highest value|most valuable)\b.*\b(customers?|clients?)\b/.test(q)) {
    return queryBestCustomers(supabase, orgId);
  }
  return null;
}

async function searchSource(
  supabase: SupabaseClient,
  orgId: string,
  sourceId: SearchSourceId,
  query: string
): Promise<AskEverittSearchRecord[]> {
  const source = getSearchSource(sourceId);
  if (!source) return [];

  const pattern = `%${query.trim()}%`;
  const quoted = `"${pattern}"`;

  switch (sourceId) {
    case 'customers':
    case 'leads': {
      const filter =
        sourceId === 'leads'
          ? supabase
              .from('customers')
              .select(CUSTOMER_LIST_SELECT)
              .eq('organization_id', orgId)
              .in('pipeline_stage', ['lead', 'qualified'])
          : supabase
              .from('customers')
              .select(CUSTOMER_LIST_SELECT)
              .eq('organization_id', orgId)
              .not('pipeline_stage', 'in', '("lead","qualified")');

      const { data } = await filter
        .or(`company_name.ilike.${quoted},email.ilike.${quoted},notes.ilike.${quoted}`)
        .limit(8);

      return (data || []).map((c) =>
        buildRecord(sourceId, {
          id: c.id,
          title: customerDisplayName(c),
          subtitle: c.email,
          status: c.pipeline_stage,
          date: c.created_at?.slice(0, 10) || null
        })
      );
    }
    case 'jobs':
    case 'schedule': {
      const { data } = await supabase
        .from('jobs')
        .select('id, title, customer_name, status, start_date')
        .eq('organization_id', orgId)
        .or(`title.ilike.${quoted},customer_name.ilike.${quoted},notes.ilike.${quoted}`)
        .limit(8);
      return (data || []).map((j) =>
        buildRecord(sourceId, {
          id: j.id,
          title: j.title,
          subtitle: j.customer_name,
          status: j.status,
          date: j.start_date,
          href: `/jobs/${j.id}`
        })
      );
    }
    case 'workers': {
      const { data } = await supabase
        .from('workers')
        .select('id, name, role, email')
        .eq('organization_id', orgId)
        .or(`name.ilike.${quoted},email.ilike.${quoted}`)
        .limit(8);
      return (data || []).map((w) =>
        buildRecord('workers', {
          id: w.id,
          title: w.name || 'Worker',
          subtitle: w.email,
          status: w.role,
          owner: w.name,
          href: '/workers'
        })
      );
    }
    case 'forms': {
      const { data } = await supabase
        .from('everitt_forms')
        .select('id, name, slug')
        .eq('organization_id', orgId)
        .ilike('name', pattern)
        .limit(6);
      return (data || []).map((f) =>
        buildRecord('forms', { id: f.id, title: f.name, subtitle: f.slug, status: null, date: null })
      );
    }
    case 'templates':
    case 'sops': {
      const { data } = await supabase
        .from('template_library')
        .select('id, title, category, updated_at')
        .eq('organization_id', orgId)
        .or(`title.ilike.${quoted},body.ilike.${quoted}`)
        .limit(8);
      return (data || []).map((t) =>
        buildRecord(sourceId === 'sops' ? 'sops' : 'templates', {
          id: t.id,
          type: t.category === 'sop' ? 'sop' : 'document',
          title: t.title,
          subtitle: t.category,
          date: t.updated_at?.slice(0, 10) || null
        })
      );
    }
    case 'documents': {
      const { data, error } = await supabase
        .from('knowledge_documents')
        .select('id, title, category, updated_at')
        .eq('organization_id', orgId)
        .or(`title.ilike.${quoted},body.ilike.${quoted}`)
        .limit(8);
      if (error && isMissingSchemaError(error)) return [];
      return (data || []).map((d) =>
        buildRecord('documents', {
          id: d.id,
          title: d.title,
          subtitle: d.category,
          date: d.updated_at?.slice(0, 10) || null
        })
      );
    }
    case 'invoices': {
      const { data, error } = await supabase
        .from('invoices')
        .select('id, description, amount, status, due_date')
        .eq('organization_id', orgId)
        .or(`description.ilike.${quoted},notes.ilike.${quoted}`)
        .limit(8);
      if (error && isMissingSchemaError(error)) return [];
      return (data || []).map((inv) =>
        buildRecord('invoices', {
          id: inv.id,
          title: inv.description || `Invoice $${Number(inv.amount || 0).toFixed(2)}`,
          subtitle: null,
          status: inv.status,
          date: inv.due_date,
          href: '/invoices'
        })
      );
    }
    case 'notes': {
      const { data } = await supabase
        .from('customers')
        .select(CUSTOMER_LIST_SELECT)
        .eq('organization_id', orgId)
        .ilike('notes', pattern)
        .limit(8);
      return (data || []).map((c) =>
        buildRecord('notes', {
          id: c.id,
          type: 'note',
          title: customerDisplayName(c),
          subtitle: c.notes?.slice(0, 100) || null,
          status: null,
          date: null
        })
      );
    }
    case 'bookings': {
      const { data, error } = await supabase
        .from('bookings')
        .select(
          'id, client_name, client_email, starts_at, ends_at, status, source, staff_name, manual_service_name, services(name), workers(name)'
        )
        .eq('organization_id', orgId)
        .or(
          `client_name.ilike.${quoted},client_email.ilike.${quoted},manual_service_name.ilike.${quoted},staff_name.ilike.${quoted},notes.ilike.${quoted}`
        )
        .order('starts_at', { ascending: false })
        .limit(8);
      if (error && isMissingSchemaError(error)) return [];
      return (data || []).map((b) => {
        const serviceName = (b.services as { name?: string } | null)?.name || b.manual_service_name || 'Appointment';
        const staffName = (b.workers as { name?: string } | null)?.name || b.staff_name || null;
        return buildRecord('bookings', {
          id: b.id,
          type: 'booking',
          title: `${b.client_name} — ${serviceName}`,
          subtitle: staffName ? `Staff: ${staffName}` : b.source || null,
          status: b.status,
          date: b.starts_at?.slice(0, 10) || null,
          owner: staffName,
          href: '/bookings'
        });
      });
    }
    case 'services': {
      const { data, error } = await supabase
        .from('services')
        .select('id, name, category, duration_minutes, price_cents, is_active')
        .eq('organization_id', orgId)
        .or(`name.ilike.${quoted},category.ilike.${quoted},description.ilike.${quoted}`)
        .limit(8);
      if (error && isMissingSchemaError(error)) return [];
      return (data || []).map((s) =>
        buildRecord('services', {
          id: s.id,
          type: 'service',
          title: s.name,
          subtitle: s.category || `${s.duration_minutes} min`,
          status: s.is_active ? 'Active' : 'Inactive',
          date: null,
          href: '/services'
        })
      );
    }
    case 'availability': {
      const { data, error } = await supabase
        .from('staff_availability')
        .select('id, day_of_week, starts_at, ends_at, is_active, workers(name)')
        .eq('organization_id', orgId)
        .eq('is_active', true)
        .limit(12);
      if (error && isMissingSchemaError(error)) return [];
      const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
      return (data || [])
        .filter((row) => {
          const workerName = (row.workers as { name?: string } | null)?.name || '';
          return !query.trim() || workerName.toLowerCase().includes(query.trim().toLowerCase());
        })
        .slice(0, 8)
        .map((row) => {
          const workerName = (row.workers as { name?: string } | null)?.name || 'Staff';
          const day = dayNames[row.day_of_week] || `Day ${row.day_of_week}`;
          return buildRecord('availability', {
            id: row.id,
            type: 'availability',
            title: `${workerName} — ${day}`,
            subtitle: `${String(row.starts_at).slice(0, 5)} – ${String(row.ends_at).slice(0, 5)}`,
            status: 'Available',
            date: null,
            owner: workerName,
            href: '/services'
          });
        });
    }
    case 'calendar': {
      const { data, error } = await supabase
        .from('bookings')
        .select(
          'id, client_name, starts_at, ends_at, status, manual_service_name, services(name), workers(name), google_calendar_event_id'
        )
        .eq('organization_id', orgId)
        .gte('starts_at', new Date().toISOString())
        .not('status', 'eq', 'cancelled')
        .or(
          `client_name.ilike.${quoted},manual_service_name.ilike.${quoted},notes.ilike.${quoted}`
        )
        .order('starts_at', { ascending: true })
        .limit(8);
      if (error && isMissingSchemaError(error)) return [];
      return (data || []).map((b) => {
        const serviceName = (b.services as { name?: string } | null)?.name || b.manual_service_name || 'Event';
        return buildRecord('calendar', {
          id: b.id,
          type: 'calendar',
          title: `${b.client_name} — ${serviceName}`,
          subtitle: b.google_calendar_event_id ? 'Calendar synced' : 'Scheduled',
          status: b.status,
          date: b.starts_at?.slice(0, 10) || null,
          href: '/bookings'
        });
      });
    }
    case 'staff_services': {
      const { data, error } = await supabase
        .from('staff_services')
        .select('id, workers(name), services(name)')
        .eq('organization_id', orgId)
        .limit(20);
      if (error && isMissingSchemaError(error)) return [];
      return (data || [])
        .filter((row) => {
          const workerName = (row.workers as { name?: string } | null)?.name || '';
          const serviceName = (row.services as { name?: string } | null)?.name || '';
          const q = query.trim().toLowerCase();
          return !q || workerName.toLowerCase().includes(q) || serviceName.toLowerCase().includes(q);
        })
        .slice(0, 8)
        .map((row) => {
          const workerName = (row.workers as { name?: string } | null)?.name || 'Staff';
          const serviceName = (row.services as { name?: string } | null)?.name || 'Service';
          return buildRecord('staff_services', {
            id: row.id,
            title: `${workerName} → ${serviceName}`,
            subtitle: 'Staff assignment',
            status: null,
            date: null,
            owner: workerName,
            href: '/services'
          });
        });
    }
    default:
      return [];
  }
}

async function universalSourceSearch(
  supabase: SupabaseClient,
  orgId: string,
  query: string
): Promise<AskEverittSearchResponse> {
  const sourceIds = resolveSearchSourcesFromQuery(query);
  const allResults: AskEverittSearchRecord[] = [];

  for (const sourceId of sourceIds) {
    const rows = await searchSource(supabase, orgId, sourceId, query);
    allResults.push(...rows);
  }

  const results = allResults.slice(0, 24);
  const groups = groupResults(results);

  return response(
    results.length > 0
      ? `Found ${results.length} record${results.length === 1 ? '' : 's'} across your workspace.`
      : `No records found for "${query.trim()}".`,
    results,
    {
      sourcesUsed: sourceIds,
      noResultsHint:
        results.length === 0
          ? `Try keywords from: ${getSearchSources()
              .slice(0, 8)
              .map((s) => s.label)
              .join(', ')}.`
          : undefined
    }
  );
}

/**
 * EverittOS business search engine — database-first intelligence layer.
 * No AI model calls. Workspace-scoped via authenticated Supabase client (RLS).
 */
export async function runAskEverittSearchEngine(
  supabase: SupabaseClient,
  organizationId: string,
  query: string
): Promise<AskEverittSearchResponse> {
  const trimmed = query.trim();
  if (!trimmed) {
    return { mode: 'search', summary: 'Ask about customers, jobs, bookings, leads, invoices, or documents.', results: [] };
  }

  const ownerQuestion = await runOwnerQuestionHandler(supabase, organizationId, trimmed);
  if (ownerQuestion) return ownerQuestion;

  const matched = await runMatchedQueryHandler(supabase, organizationId, trimmed);
  if (matched) return matched;

  return universalSourceSearch(supabase, organizationId, trimmed);
}

/** Re-export for modules extending search. */
export { getSearchSources, registerSearchSource } from '@/lib/ask-everitt/search-sources';
