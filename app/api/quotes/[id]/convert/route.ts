import { NextResponse } from 'next/server';
import { requireWorkspaceSession } from '@/lib/workspace-api-auth';
import { workspaceScopedFields } from '@/lib/workspace-server';
import { isMissingSchemaError } from '@/lib/supabase-schema-errors';
import { enforcePlanForUser } from '@/lib/plan-enforce-server';
import { logWorkspaceActivity } from '@/lib/activity-server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(_request: Request, context: { params: Promise<{ id: string }> }) {
  const ctx = await requireWorkspaceSession({ requireManager: true });
  if (!ctx.ok) return NextResponse.json({ error: ctx.error, code: ctx.code }, { status: ctx.status });

  const { id } = await context.params;
  const { data: quote, error: quoteError } = await ctx.supabase
    .from('quotes')
    .select('*')
    .eq('id', id)
    .eq('organization_id', ctx.workspace.organizationId)
    .maybeSingle();

  if (quoteError) return NextResponse.json({ error: quoteError.message }, { status: 400 });
  if (!quote) return NextResponse.json({ error: 'Quote not found.' }, { status: 404 });

  if (quote.job_id) {
    return NextResponse.json({ ok: true, job: { id: quote.job_id }, reused: true });
  }

  const planCheck = await enforcePlanForUser(ctx.supabase, ctx.userId, 'jobs');
  if (!planCheck.allowed) {
    return NextResponse.json({ error: planCheck.message || 'Plan limit reached.' }, { status: 403 });
  }

  const insert = {
    ...workspaceScopedFields(ctx.workspace, ctx.userId),
    title: quote.service_type || 'Quoted service',
    customer_id: quote.customer_id || null,
    customer_name: quote.customer_name || null,
    customer_email: quote.customer_email || null,
    phone: quote.customer_phone || null,
    notes: quote.notes || quote.source_request || null,
    status: 'new',
    revenue_amount: Number(quote.price) || 0,
    quote_id: quote.id,
    quote_service_type: quote.service_type || null,
    quote_size_value: quote.size_value ?? null,
    quote_size_unit: quote.size_unit || null,
    quote_primary_units: quote.primary_units ?? null,
    quote_extra_units: quote.extra_units ?? null,
    quote_condition: quote.condition || null,
    quote_frequency: quote.frequency || null,
    quote_add_ons: Array.isArray(quote.add_ons) ? quote.add_ons : [],
    quote_labor_hours: quote.labor_hours ?? null,
    quote_price: Number(quote.price) || 0,
    quote_currency: quote.currency || 'USD',
    quote_source_request: quote.source_request || null,
    quote_created_at: quote.created_at || new Date().toISOString()
  };

  const { data: job, error: jobError } = await ctx.supabase
    .from('jobs')
    .insert(insert)
    .select('id')
    .single();

  if (jobError || !job) {
    if (jobError && isMissingSchemaError(jobError)) {
      return NextResponse.json({ error: 'Quote-to-job fields are not ready yet.', code: 'schema_update_required' }, { status: 409 });
    }
    return NextResponse.json({ error: jobError?.message || 'Could not create job.' }, { status: 400 });
  }

  const now = new Date().toISOString();
  const { error: updateError } = await ctx.supabase
    .from('quotes')
    .update({ status: 'converted', converted_at: now, job_id: job.id, updated_at: now })
    .eq('id', quote.id)
    .eq('organization_id', ctx.workspace.organizationId);

  if (updateError) {
    await ctx.supabase.from('jobs').delete().eq('id', job.id).eq('organization_id', ctx.workspace.organizationId);
    return NextResponse.json({ error: 'Could not finish quote conversion.' }, { status: 400 });
  }

  await logWorkspaceActivity(
    ctx.workspace.organizationId,
    ctx.userId,
    'job',
    job.id,
    'job_created_from_quote',
    `Job created from quote: ${quote.service_type || 'Quoted service'}`,
    { quoteId: quote.id, price: Number(quote.price) || 0, currency: quote.currency || 'USD' }
  );

  return NextResponse.json({ ok: true, job });
}
