import { NextResponse } from 'next/server';
import { requireFinanceApiAccess } from '@/lib/finance-api-auth';
import { fetchJobProfitability } from '@/lib/finance-server';
import { isValidUuid } from '@/lib/input-validation';

type RouteParams = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: RouteParams) {
  const ctx = await requireFinanceApiAccess();
  if (!ctx.ok) {
    return NextResponse.json({ error: ctx.error }, { status: ctx.status });
  }

  const { id: jobId } = await params;
  if (!isValidUuid(jobId)) {
    return NextResponse.json({ error: 'Invalid job id' }, { status: 400 });
  }

  const { data: job } = await ctx.supabase
    .from('jobs')
    .select('id')
    .eq('id', jobId)
    .eq('organization_id', ctx.organizationId)
    .maybeSingle();

  if (!job) {
    return NextResponse.json({ error: 'Job not found' }, { status: 404 });
  }

  const profitability = await fetchJobProfitability(ctx.supabase, ctx.organizationId, jobId);
  return NextResponse.json({ profitability });
}
