import { NextResponse } from 'next/server';
import { requireFinanceApiAccess } from '@/lib/finance-api-auth';
import { fetchJobPaymentHistory } from '@/lib/finance/job-payments';
import { fetchJobProfitability } from '@/lib/finance-server';
import type { JobProfitability } from '@/lib/finance-types';
import { isValidUuid } from '@/lib/input-validation';

type RouteParams = { params: Promise<{ id: string }> };

type ResolvedJob = {
  id: string;
  expected_additional_expense: number | null;
};

async function resolveJob(
  ctx: Awaited<ReturnType<typeof requireFinanceApiAccess>>,
  jobId: string
): Promise<ResolvedJob | null> {
  if (!ctx.ok) return null;
  const { data: job } = await ctx.supabase
    .from('jobs')
    .select('id, expected_additional_expense')
    .eq('id', jobId)
    .eq('organization_id', ctx.organizationId)
    .maybeSingle();
  return job as ResolvedJob | null;
}

export function withPlannedExpenses(
  profitability: JobProfitability,
  expectedAdditionalExpense: number | null | undefined
): JobProfitability & { expectedAdditionalExpense: number } {
  const planned = Math.max(0, Number(expectedAdditionalExpense || 0));
  const actualNonLabor = Math.max(0, Number(profitability.materialCost || 0) + Number(profitability.otherExpenses || 0));
  const effectiveNonLabor = actualNonLabor > 0 ? actualNonLabor : planned;
  const laborCost = Math.max(0, Number(profitability.laborCost || 0));
  const totalExpenses = Number((laborCost + effectiveNonLabor).toFixed(2));
  const expectedAmount = Math.max(0, Number(profitability.expectedAmount || 0));
  const collectedAmount = Math.max(0, Number(profitability.collectedAmount || 0));
  const expectedProfit = Number((expectedAmount - totalExpenses).toFixed(2));
  const collectedProfit = Number(Math.max(0, collectedAmount - totalExpenses).toFixed(2));

  return {
    ...profitability,
    materialCost: actualNonLabor > 0 ? Number(profitability.materialCost || 0) : 0,
    otherExpenses: actualNonLabor > 0 ? Number(profitability.otherExpenses || 0) : planned,
    totalExpenses,
    expectedProfit,
    collectedProfit,
    estimatedProfit: collectedAmount > 0 ? collectedProfit : expectedProfit,
    expectedAdditionalExpense: Number(planned.toFixed(2))
  };
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

  const baseProfitability = await fetchJobProfitability(ctx.supabase, ctx.organizationId, jobId);
  const profitability = withPlannedExpenses(baseProfitability, job.expected_additional_expense);
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
    return NextResponse.json({ error: 'Revenue amount must be a non-negative number.' }, { status: 400 });
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
      return NextResponse.json({ error: 'Expected contractor cost must be a non-negative number.' }, { status: 400 });
    }
    patch.expected_contractor_cost = value;
  }
  if (body.expected_additional_expense !== undefined) {
    const value =
      body.expected_additional_expense === null || body.expected_additional_expense === ''
        ? null
        : Number(body.expected_additional_expense);
    if (value !== null && (!Number.isFinite(value) || value < 0)) {
      return NextResponse.json({ error: 'Expected additional expense must be a non-negative number.' }, { status: 400 });
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
    return NextResponse.json({ error: error.message || 'Unable to save job financials.' }, { status: 400 });
  }

  const updatedJob = await resolveJob(ctx, jobId);
  const baseProfitability = await fetchJobProfitability(ctx.supabase, ctx.organizationId, jobId);
  const profitability = withPlannedExpenses(baseProfitability, updatedJob?.expected_additional_expense);
  return NextResponse.json({ ok: true, profitability });
}
