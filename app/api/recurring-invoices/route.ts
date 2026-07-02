import { NextResponse } from 'next/server';
import { requireFinanceApiAccess } from '@/lib/finance-api-auth';
import { assertCustomerInOrganization, assertJobInOrganization } from '@/lib/org-resource-validation';
import { isRecurringCadence } from '@/lib/recurring-invoices';
import { isMissingSchemaError, SCHEMA_SETUP_HINT } from '@/lib/supabase-schema-errors';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const ctx = await requireFinanceApiAccess();
  if (!ctx.ok) {
    return NextResponse.json({ error: ctx.error }, { status: ctx.status });
  }

  const { data, error } = await ctx.supabase
    .from('recurring_invoice_templates')
    .select('*')
    .eq('organization_id', ctx.organizationId)
    .order('updated_at', { ascending: false });

  if (error) {
    if (isMissingSchemaError(error)) {
      return NextResponse.json({ templates: [], schemaReady: false, setupHint: SCHEMA_SETUP_HINT });
    }
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  const templateIds = (data || []).map((t) => t.id);
  let runsByTemplate: Record<string, unknown[]> = {};
  if (templateIds.length) {
    const { data: runs } = await ctx.supabase
      .from('recurring_invoice_runs')
      .select('id, template_id, run_for_date, status, invoice_id, created_at')
      .eq('organization_id', ctx.organizationId)
      .in('template_id', templateIds)
      .order('created_at', { ascending: false });
    runsByTemplate = (runs || []).reduce<Record<string, unknown[]>>((acc, run) => {
      const key = run.template_id as string;
      if (!acc[key]) acc[key] = [];
      acc[key].push(run);
      return acc;
    }, {});
  }

  const templates = (data || []).map((template) => ({
    ...template,
    recurring_invoice_runs: runsByTemplate[template.id] || []
  }));

  return NextResponse.json({ templates, schemaReady: true });
}

export async function POST(request: Request) {
  const ctx = await requireFinanceApiAccess();
  if (!ctx.ok) {
    return NextResponse.json({ error: ctx.error }, { status: ctx.status });
  }
  if (!ctx.canManage) {
    return NextResponse.json({ error: 'Permission denied' }, { status: 403 });
  }

  const body = (await request.json()) as {
    title?: string;
    amount?: number | string;
    cadence?: string;
    customer_id?: string | null;
    job_id?: string | null;
    next_run_on?: string | null;
    active?: boolean;
  };

  const amount = Number(body.amount);
  if (!Number.isFinite(amount) || amount <= 0) {
    return NextResponse.json({ error: 'Enter a valid invoice amount.' }, { status: 400 });
  }

  const cadence = body.cadence || 'monthly';
  if (!isRecurringCadence(cadence)) {
    return NextResponse.json({ error: 'Invalid cadence.' }, { status: 400 });
  }

  const nextRun = body.next_run_on || new Date().toISOString().slice(0, 10);

  const customerError = await assertCustomerInOrganization(ctx.supabase, ctx.organizationId, body.customer_id);
  if (customerError) {
    return NextResponse.json({ error: customerError }, { status: 400 });
  }
  const jobError = await assertJobInOrganization(ctx.supabase, ctx.organizationId, body.job_id);
  if (jobError) {
    return NextResponse.json({ error: jobError }, { status: 400 });
  }

  const { data, error } = await ctx.supabase
    .from('recurring_invoice_templates')
    .insert({
      organization_id: ctx.organizationId,
      title: body.title?.trim() || 'Recurring invoice',
      amount,
      cadence,
      customer_id: body.customer_id || null,
      job_id: body.job_id || null,
      next_run_on: nextRun,
      active: body.active !== false,
      created_by: ctx.userId
    })
    .select('*')
    .single();

  if (error) {
    if (isMissingSchemaError(error)) {
      return NextResponse.json({ error: SCHEMA_SETUP_HINT }, { status: 503 });
    }
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ template: data });
}
