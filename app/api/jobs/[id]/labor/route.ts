import { NextResponse } from 'next/server';
import { requireFinanceApiAccess } from '@/lib/finance-api-auth';
import { buildLaborRow } from '@/lib/finance-server';
import { isValidUuid } from '@/lib/input-validation';

type RouteParams = { params: Promise<{ id: string }> };

async function verifyJob(ctx: Awaited<ReturnType<typeof requireFinanceApiAccess>>, jobId: string) {
  if (!ctx.ok) return false;
  const { data } = await ctx.supabase
    .from('jobs')
    .select('id')
    .eq('id', jobId)
    .eq('organization_id', ctx.organizationId)
    .maybeSingle();
  return Boolean(data);
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

  if (!(await verifyJob(ctx, jobId))) {
    return NextResponse.json({ error: 'Job not found' }, { status: 404 });
  }

  const { data, error } = await ctx.supabase
    .from('job_labor')
    .select('*')
    .eq('organization_id', ctx.organizationId)
    .eq('job_id', jobId)
    .order('created_at', { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ labor: data || [] });
}

export async function POST(request: Request, { params }: RouteParams) {
  const ctx = await requireFinanceApiAccess();
  if (!ctx.ok) {
    return NextResponse.json({ error: ctx.error }, { status: ctx.status });
  }

  const { id: jobId } = await params;
  if (!isValidUuid(jobId)) {
    return NextResponse.json({ error: 'Invalid job id' }, { status: 400 });
  }

  if (!(await verifyJob(ctx, jobId))) {
    return NextResponse.json({ error: 'Job not found' }, { status: 404 });
  }

  const body = await request.json();
  const labor = buildLaborRow({
    hours: body.hours,
    hourlyCost: body.hourly_cost ?? body.hourlyCost
  });

  if (labor.hours <= 0) {
    return NextResponse.json({ error: 'Hours worked must be greater than zero' }, { status: 400 });
  }

  const { data, error } = await ctx.supabase
    .from('job_labor')
    .insert({
      organization_id: ctx.organizationId,
      job_id: jobId,
      worker_id: body.worker_id || null,
      worker_name: body.worker_name?.trim() || null,
      hours: labor.hours,
      hourly_cost: labor.hourly_cost,
      total_cost: labor.total_cost,
      notes: body.notes?.trim() || null
    })
    .select('*')
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ labor: data });
}
