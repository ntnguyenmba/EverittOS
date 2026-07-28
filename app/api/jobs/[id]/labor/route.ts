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

async function resolveWorkerId(
  ctx: Awaited<ReturnType<typeof requireFinanceApiAccess>>,
  suppliedWorkerId: unknown,
  suppliedWorkerName: unknown
): Promise<{ workerId: string | null; error: string | null }> {
  if (!ctx.ok) return { workerId: null, error: 'Unable to verify contractor' };

  const workerId = typeof suppliedWorkerId === 'string' ? suppliedWorkerId.trim() : '';
  if (workerId) {
    if (!isValidUuid(workerId)) return { workerId: null, error: 'Invalid contractor selection' };
    const { data, error } = await ctx.supabase
      .from('workers')
      .select('id')
      .eq('id', workerId)
      .eq('organization_id', ctx.organizationId)
      .maybeSingle();
    if (error || !data) return { workerId: null, error: 'Select a contractor from your team list' };
    return { workerId: data.id, error: null };
  }

  const workerName = typeof suppliedWorkerName === 'string' ? suppliedWorkerName.trim() : '';
  if (!workerName) return { workerId: null, error: 'Select a contractor from your team list' };

  const { data, error } = await ctx.supabase
    .from('workers')
    .select('id')
    .eq('organization_id', ctx.organizationId)
    .ilike('name', workerName)
    .limit(2);

  if (error || !data || data.length !== 1) {
    return { workerId: null, error: 'Select a contractor from your team list so their earnings are linked correctly' };
  }

  return { workerId: data[0].id, error: null };
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
  const resolvedWorker = await resolveWorkerId(ctx, body.worker_id, body.worker_name);
  if (!resolvedWorker.workerId) {
    return NextResponse.json({ error: resolvedWorker.error }, { status: 400 });
  }

  const labor = buildLaborRow({
    hours: body.payment_basis === 'flat' ? 1 : body.hours,
    hourlyCost: body.hourly_cost ?? body.hourlyCost,
    paymentBasis: body.payment_basis ?? body.paymentBasis
  });

  if (labor.payment_basis !== 'flat' && labor.hours <= 0) {
    return NextResponse.json({ error: 'Quantity must be greater than zero' }, { status: 400 });
  }

  const insertPayload: Record<string, unknown> = {
    organization_id: ctx.organizationId,
    job_id: jobId,
    worker_id: resolvedWorker.workerId,
    worker_name: body.worker_name?.trim() || null,
    hours: labor.hours,
    hourly_cost: labor.hourly_cost,
    total_cost: labor.total_cost,
    notes: body.notes?.trim() || null,
    payment_basis: labor.payment_basis
  };

  let result = await ctx.supabase.from('job_labor').insert(insertPayload).select('*').single();

  if (result.error && /payment_basis/i.test(result.error.message || '')) {
    delete insertPayload.payment_basis;
    result = await ctx.supabase.from('job_labor').insert(insertPayload).select('*').single();
  }

  if (result.error) {
    return NextResponse.json({ error: result.error.message }, { status: 400 });
  }

  return NextResponse.json({ labor: result.data });
}
