import { NextResponse } from 'next/server';
import { requireFinanceApiAccess } from '@/lib/finance-api-auth';
import { assertCustomerInOrganization, assertJobInOrganization } from '@/lib/org-resource-validation';
import { isRecurringCadence } from '@/lib/recurring-invoices';
import { isValidUuid } from '@/lib/input-validation';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type RouteContext = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, context: RouteContext) {
  const ctx = await requireFinanceApiAccess();
  if (!ctx.ok) {
    return NextResponse.json({ error: ctx.error }, { status: ctx.status });
  }
  if (!ctx.canManage) {
    return NextResponse.json({ error: 'Permission denied' }, { status: 403 });
  }

  const { id } = await context.params;
  if (!isValidUuid(id)) {
    return NextResponse.json({ error: 'Invalid template id.' }, { status: 400 });
  }

  const body = (await request.json()) as Record<string, unknown>;
  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };

  if (body.title !== undefined) patch.title = String(body.title).trim() || 'Recurring invoice';
  if (body.amount !== undefined) {
    const amount = Number(body.amount);
    if (!Number.isFinite(amount) || amount <= 0) {
      return NextResponse.json({ error: 'Enter a valid invoice amount.' }, { status: 400 });
    }
    patch.amount = amount;
  }
  if (body.cadence !== undefined) {
    const cadence = String(body.cadence);
    if (!isRecurringCadence(cadence)) {
      return NextResponse.json({ error: 'Invalid cadence.' }, { status: 400 });
    }
    patch.cadence = cadence;
  }
  if (body.customer_id !== undefined) {
    const customerError = await assertCustomerInOrganization(ctx.supabase, ctx.organizationId, body.customer_id as string | null);
    if (customerError) {
      return NextResponse.json({ error: customerError }, { status: 400 });
    }
    patch.customer_id = body.customer_id || null;
  }
  if (body.job_id !== undefined) {
    const jobError = await assertJobInOrganization(ctx.supabase, ctx.organizationId, body.job_id as string | null);
    if (jobError) {
      return NextResponse.json({ error: jobError }, { status: 400 });
    }
    patch.job_id = body.job_id || null;
  }
  if (body.next_run_on !== undefined) patch.next_run_on = body.next_run_on || null;
  if (body.active !== undefined) patch.active = Boolean(body.active);

  const { data, error } = await ctx.supabase
    .from('recurring_invoice_templates')
    .update(patch)
    .eq('id', id)
    .eq('organization_id', ctx.organizationId)
    .select('*')
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
  if (!data) {
    return NextResponse.json({ error: 'Template not found.' }, { status: 404 });
  }

  return NextResponse.json({ template: data });
}

export async function DELETE(_request: Request, context: RouteContext) {
  const ctx = await requireFinanceApiAccess();
  if (!ctx.ok) {
    return NextResponse.json({ error: ctx.error }, { status: ctx.status });
  }
  if (!ctx.canManage) {
    return NextResponse.json({ error: 'Permission denied' }, { status: 403 });
  }

  const { id } = await context.params;
  if (!isValidUuid(id)) {
    return NextResponse.json({ error: 'Invalid template id.' }, { status: 400 });
  }

  const { count } = await ctx.supabase
    .from('recurring_invoice_runs')
    .select('id', { count: 'exact', head: true })
    .eq('template_id', id)
    .eq('organization_id', ctx.organizationId);

  if ((count || 0) > 0) {
    const { error: deactivateError } = await ctx.supabase
      .from('recurring_invoice_templates')
      .update({ active: false, updated_at: new Date().toISOString() })
      .eq('id', id)
      .eq('organization_id', ctx.organizationId);
    if (deactivateError) {
      return NextResponse.json({ error: deactivateError.message }, { status: 400 });
    }
    return NextResponse.json({ ok: true, deactivated: true, message: 'Template has run history and was paused instead of deleted.' });
  }

  const { error } = await ctx.supabase
    .from('recurring_invoice_templates')
    .delete()
    .eq('id', id)
    .eq('organization_id', ctx.organizationId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}
