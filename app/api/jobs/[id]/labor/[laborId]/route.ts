import { NextResponse } from 'next/server';
import { requireFinanceApiAccess } from '@/lib/finance-api-auth';
import { buildLaborRow } from '@/lib/finance-server';
import { isValidUuid } from '@/lib/input-validation';

const PAYMENT_STATUSES = new Set(['unpaid', 'pending', 'paid']);

type RouteParams = { params: Promise<{ id: string; laborId: string }> };

function cleanOptionalText(value: unknown, max = 240): string | null {
  return typeof value === 'string' && value.trim() ? value.trim().slice(0, max) : null;
}

export async function PATCH(request: Request, { params }: RouteParams) {
  const ctx = await requireFinanceApiAccess();
  if (!ctx.ok) {
    return NextResponse.json({ error: ctx.error }, { status: ctx.status });
  }

  const { id: jobId, laborId } = await params;
  if (!isValidUuid(jobId) || !isValidUuid(laborId)) {
    return NextResponse.json({ error: 'Invalid id' }, { status: 400 });
  }

  const body = await request.json();
  const patch: Record<string, unknown> = {};

  if (body.worker_id !== undefined) patch.worker_id = body.worker_id || null;
  if (body.worker_name !== undefined) patch.worker_name = body.worker_name?.trim() || null;
  if (body.notes !== undefined) patch.notes = body.notes?.trim() || null;

  if (body.payment_status !== undefined) {
    const paymentStatus = String(body.payment_status).toLowerCase();
    if (!PAYMENT_STATUSES.has(paymentStatus)) {
      return NextResponse.json({ error: 'Invalid contractor payment status' }, { status: 400 });
    }
    patch.payment_status = paymentStatus;
    patch.paid_at = paymentStatus === 'paid' ? body.paid_at || new Date().toISOString() : null;
  } else if (body.paid_at !== undefined) {
    patch.paid_at = body.paid_at || null;
  }

  if (body.payment_method !== undefined) {
    patch.payment_method = cleanOptionalText(body.payment_method, 80);
  }
  if (body.payment_reference !== undefined) {
    patch.payment_reference = cleanOptionalText(body.payment_reference, 240);
  }

  if (body.hours !== undefined || body.hourly_cost !== undefined || body.hourlyCost !== undefined) {
    const { data: existing } = await ctx.supabase
      .from('job_labor')
      .select('hours, hourly_cost')
      .eq('id', laborId)
      .eq('job_id', jobId)
      .eq('organization_id', ctx.organizationId)
      .maybeSingle();

    if (!existing) {
      return NextResponse.json({ error: 'Labor entry not found' }, { status: 404 });
    }

    const labor = buildLaborRow({
      hours: body.hours ?? existing.hours,
      hourlyCost: body.hourly_cost ?? body.hourlyCost ?? existing.hourly_cost
    });
    patch.hours = labor.hours;
    patch.hourly_cost = labor.hourly_cost;
    patch.total_cost = labor.total_cost;
  }

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: 'No contractor pay changes provided' }, { status: 400 });
  }

  const { data, error } = await ctx.supabase
    .from('job_labor')
    .update(patch)
    .eq('id', laborId)
    .eq('job_id', jobId)
    .eq('organization_id', ctx.organizationId)
    .select('*')
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ labor: data });
}

export async function DELETE(_request: Request, { params }: RouteParams) {
  const ctx = await requireFinanceApiAccess();
  if (!ctx.ok) {
    return NextResponse.json({ error: ctx.error }, { status: ctx.status });
  }

  const { id: jobId, laborId } = await params;
  if (!isValidUuid(jobId) || !isValidUuid(laborId)) {
    return NextResponse.json({ error: 'Invalid id' }, { status: 400 });
  }

  const { error } = await ctx.supabase
    .from('job_labor')
    .delete()
    .eq('id', laborId)
    .eq('job_id', jobId)
    .eq('organization_id', ctx.organizationId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}
