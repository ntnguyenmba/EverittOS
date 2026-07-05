import { NextResponse } from 'next/server';
import { requireFinanceApiAccess } from '@/lib/finance-api-auth';
import { fetchJobProfitability } from '@/lib/finance-server';
import { isValidUuid } from '@/lib/input-validation';

type RouteParams = { params: Promise<{ id: string }> };

async function resolveJob(ctx: Awaited<ReturnType<typeof requireFinanceApiAccess>>, jobId: string) {
  if (!ctx.ok) return null;
  const { data: job } = await ctx.supabase
    .from('jobs')
    .select('id')
    .eq('id', jobId)
    .eq('organization_id', ctx.organizationId)
    .maybeSingle();
  return job;
}

export async function GET(_request: Request, { params }: RouteParams) {
  const ctx = await requireFinanceApiAccess();
  if (!ctx.ok) {
    return NextResponse.json({ error: ctx.error }, { status: ctx.status });
  }

  const { id: jobId } = await params;
  if (!isValidUuid(jobId)) {
    return NextResponse.json({ error: 'Invalid job id' }, { status: 400 });
  }

  const job = await resolveJob(ctx, jobId);
  if (!job) {
    return NextResponse.json({ error: 'Job not found' }, { status: 404 });
  }

  const profitability = await fetchJobProfitability(ctx.supabase, ctx.organizationId, jobId);
  return NextResponse.json({ profitability });
}

export async function PATCH(request: Request, { params }: RouteParams) {
  const ctx = await requireFinanceApiAccess();
  if (!ctx.ok) {
    return NextResponse.json({ error: ctx.error }, { status: ctx.status });
  }

  const { id: jobId } = await params;
  if (!isValidUuid(jobId)) {
    return NextResponse.json({ error: 'Invalid job id' }, { status: 400 });
  }

  const body = (await request.json().catch(() => ({}))) as { revenue_amount?: number | string | null; revenue_notes?: string | null };
  const revenueAmount = body.revenue_amount === null || body.revenue_amount === '' ? null : Number(body.revenue_amount);
  if (revenueAmount !== null && (!Number.isFinite(revenueAmount) || revenueAmount < 0)) {
    return NextResponse.json({ error: 'Revenue amount must be a positive number.' }, { status: 400 });
  }

  const job = await resolveJob(ctx, jobId);
  if (!job) {
    return NextResponse.json({ error: 'Job not found' }, { status: 404 });
  }

  const { error } = await ctx.supabase
    .from('jobs')
    .update({
      revenue_amount: revenueAmount,
      revenue_notes: body.revenue_notes?.trim() || null
    })
    .eq('id', jobId)
    .eq('organization_id', ctx.organizationId);

  if (error) {
    return NextResponse.json({ error: error.message || 'Unable to save revenue.' }, { status: 400 });
  }

  const profitability = await fetchJobProfitability(ctx.supabase, ctx.organizationId, jobId);
  return NextResponse.json({ ok: true, profitability });
}
