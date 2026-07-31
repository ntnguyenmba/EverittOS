import { NextResponse } from 'next/server';
import { requireFinanceApiAccess } from '@/lib/finance-api-auth';
import { fetchJobPaymentHistory } from '@/lib/finance/job-payments';
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
  const history = await fetchJobPaymentHistory(ctx.supabase, ctx.organizationId, jobId);
  return NextResponse.json({ profitability: { ...profitability, payments: history.payments } });
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

  const body = (await request.json().catch(() => ({}))) as {
    revenue_amount?: number | string | null;
    revenue_notes?: string | null;
    expected_contractor_cost?: number | string | null;
    expected_additional_expense?: number | string | null;
    expected_expense_description?: string | null;
  };
  const revenueAmount =
    body.revenue_amount === undefined
      ? undefined
      : body.revenue_amount === null || body.revenue_amount === ''
        ? null
        : Number(body.revenue_amount);
  if (revenueAmount !== undefined && revenueAmount !== null && (!Number.isFinite(revenueAmount) || revenueAmount < 0)) {
    return NextResponse.json({ error: 'Revenue amount must be a positive number.' }, { status: 400 });
  }

  const job = await resolveJob(ctx, jobId);
  if (!job) {
    return NextResponse.json({ error: 'Job not found' }, { status: 404 });
  }

  const patch: Record<string, unknown> = {};
  if (revenueAmount !== undefined) patch.revenue_amount = revenueAmount;
  if (body.revenue_notes !== undefined) patch.revenue_notes = body.revenue_notes?.trim() || null;
  if (body.expected_contractor_cost !== undefined) {
    const value =
      body.expected_contractor_cost === null || body.expected_contractor_cost === ''
        ? null
        : Number(body.expected_contractor_cost);
    if (value !== null && (!Number.isFinite(value) || value < 0)) {
      return NextResponse.json({ error: 'Expected contractor cost must be a positive number.' }, { status: 400 });
    }
    patch.expected_contractor_cost = value;
  }
  if (body.expected_additional_expense !== undefined) {
    const value =
      body.expected_additional_expense === null || body.expected_additional_expense === ''
        ? null
        : Number(body.expected_additional_expense);
    if (value !== null && (!Number.isFinite(value) || value < 0)) {
      return NextResponse.json({ error: 'Expected additional expense must be a positive number.' }, { status: 400 });
    }
    patch.expected_additional_expense = value;
  }
  if (body.expected_expense_description !== undefined) {
    patch.expected_expense_description = body.expected_expense_description?.trim() || null;
  }

  const { error } = await ctx.supabase
    .from('jobs')
    .update(patch)
    .eq('id', jobId)
    .eq('organization_id', ctx.organizationId);

  if (error) {
    return NextResponse.json({ error: error.message || 'Unable to save revenue.' }, { status: 400 });
  }

  const profitability = await fetchJobProfitability(ctx.supabase, ctx.organizationId, jobId);
  return NextResponse.json({ ok: true, profitability });
}
