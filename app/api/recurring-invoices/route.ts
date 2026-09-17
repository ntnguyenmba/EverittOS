import { NextResponse } from 'next/server';
import { requireFinanceApiAccess } from '@/lib/finance-api-auth';
import { assertCustomerInOrganization, assertJobInOrganization } from '@/lib/org-resource-validation';
import { isRecurringCadence } from '@/lib/recurring-invoices';
import { isMissingSchemaError, SCHEMA_SETUP_HINT } from '@/lib/supabase-schema-errors';
import { localeFromRequest } from '@/lib/i18n/server-request-locale';
import { getRecurringInvoiceApiCopy } from '@/lib/i18n/recurring-invoice-api-copy';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const locale = localeFromRequest(request);
  const c = getRecurringInvoiceApiCopy(locale);
  const ctx = await requireFinanceApiAccess(locale);
  if (!ctx.ok) return NextResponse.json({ error: ctx.error }, { status: ctx.status });

  const { data, error } = await ctx.supabase.from('recurring_invoice_templates').select('*').eq('organization_id', ctx.organizationId).order('updated_at', { ascending: false });
  if (error) {
    if (isMissingSchemaError(error)) return NextResponse.json({ templates: [], schemaReady: false, setupHint: SCHEMA_SETUP_HINT });
    return NextResponse.json({ error: c.loadError }, { status: 400 });
  }

  const templateIds = (data || []).map((t) => t.id);
  let runsByTemplate: Record<string, unknown[]> = {};
  if (templateIds.length) {
    const { data: runs, error: runsError } = await ctx.supabase.from('recurring_invoice_runs').select('id, template_id, run_for_date, status, invoice_id, created_at').eq('organization_id', ctx.organizationId).in('template_id', templateIds).order('created_at', { ascending: false });
    if (runsError && !isMissingSchemaError(runsError)) return NextResponse.json({ error: c.loadError }, { status: 400 });
    runsByTemplate = (runs || []).reduce<Record<string, unknown[]>>((acc, run) => { const key = run.template_id as string; if (!acc[key]) acc[key] = []; acc[key].push(run); return acc; }, {});
  }

  return NextResponse.json({ templates: (data || []).map((template) => ({ ...template, recurring_invoice_runs: runsByTemplate[template.id] || [] })), schemaReady: true });
}

export async function POST(request: Request) {
  const locale = localeFromRequest(request);
  const c = getRecurringInvoiceApiCopy(locale);
  const ctx = await requireFinanceApiAccess(locale);
  if (!ctx.ok) return NextResponse.json({ error: ctx.error }, { status: ctx.status });
  if (!ctx.canManage) return NextResponse.json({ error: c.permissionDenied }, { status: 403 });

  const body = await request.json().catch(() => null) as { title?: string; amount?: number | string; cadence?: string; customer_id?: string | null; job_id?: string | null; next_run_on?: string | null; active?: boolean } | null;
  if (!body) return NextResponse.json({ error: c.saveError }, { status: 400 });

  const amount = Number(body.amount);
  if (!Number.isFinite(amount) || amount <= 0) return NextResponse.json({ error: c.validAmount }, { status: 400 });
  const cadence = body.cadence || 'monthly';
  if (!isRecurringCadence(cadence)) return NextResponse.json({ error: c.invalidCadence }, { status: 400 });

  const customerError = await assertCustomerInOrganization(ctx.supabase, ctx.organizationId, body.customer_id);
  if (customerError) return NextResponse.json({ error: customerError }, { status: 400 });
  const jobError = await assertJobInOrganization(ctx.supabase, ctx.organizationId, body.job_id);
  if (jobError) return NextResponse.json({ error: jobError }, { status: 400 });

  const { data, error } = await ctx.supabase.from('recurring_invoice_templates').insert({ organization_id: ctx.organizationId, title: body.title?.trim() || c.defaultTitle, amount, cadence, customer_id: body.customer_id || null, job_id: body.job_id || null, next_run_on: body.next_run_on || new Date().toISOString().slice(0, 10), active: body.active !== false, created_by: ctx.userId }).select('*').single();
  if (error) {
    if (isMissingSchemaError(error)) return NextResponse.json({ error: SCHEMA_SETUP_HINT }, { status: 503 });
    return NextResponse.json({ error: c.saveError }, { status: 400 });
  }
  return NextResponse.json({ template: data });
}
