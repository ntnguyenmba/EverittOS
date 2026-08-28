import { NextResponse } from 'next/server';
import { requireFinanceApiAccess } from '@/lib/finance-api-auth';
import { buildLaborRow } from '@/lib/finance-server';
import { isValidUuid } from '@/lib/input-validation';

type RouteParams = { params: Promise<{ id: string }> };

type VerifiedJob = {
  id: string;
  assigned_to: string | null;
  expected_contractor_cost: number | null;
  notes: string | null;
};

async function verifyJob(
  ctx: Awaited<ReturnType<typeof requireFinanceApiAccess>>,
  jobId: string
): Promise<VerifiedJob | null> {
  if (!ctx.ok) return null;
  const { data } = await ctx.supabase
    .from('jobs')
    .select('id, assigned_to, expected_contractor_cost, notes')
    .eq('id', jobId)
    .eq('organization_id', ctx.organizationId)
    .maybeSingle();
  return data
    ? {
        id: data.id,
        assigned_to: data.assigned_to || null,
        expected_contractor_cost:
          data.expected_contractor_cost === null || data.expected_contractor_cost === undefined
            ? null
            : Number(data.expected_contractor_cost),
        notes: data.notes || null
      }
    : null;
}

async function resolveWorkerId(
  ctx: Awaited<ReturnType<typeof requireFinanceApiAccess>>,
  suppliedWorkerId: unknown,
  suppliedWorkerName: unknown,
  assignedUserId?: string | null
): Promise<{ workerId: string | null; workerName: string | null; error: string | null }> {
  if (!ctx.ok) return { workerId: null, workerName: null, error: 'Unable to verify contractor' };

  const workerId = typeof suppliedWorkerId === 'string' ? suppliedWorkerId.trim() : '';
  if (workerId) {
    if (!isValidUuid(workerId)) {
      return { workerId: null, workerName: null, error: 'Invalid contractor selection' };
    }
    const { data, error } = await ctx.supabase
      .from('workers')
      .select('id, name')
      .eq('id', workerId)
      .eq('organization_id', ctx.organizationId)
      .maybeSingle();
    if (error || !data) {
      return { workerId: null, workerName: null, error: 'Select a contractor from your team list' };
    }
    return { workerId: data.id, workerName: data.name || null, error: null };
  }

  const workerName = typeof suppliedWorkerName === 'string' ? suppliedWorkerName.trim() : '';
  if (workerName) {
    return { workerId: null, workerName, error: null };
  }

  if (assignedUserId && isValidUuid(assignedUserId)) {
    const { data, error } = await ctx.supabase
      .from('workers')
      .select('id, name')
      .eq('organization_id', ctx.organizationId)
      .eq('auth_user_id', assignedUserId)
      .eq('active', true)
      .limit(2);

    if (!error && data?.length === 1) {
      return { workerId: data[0].id, workerName: data[0].name || null, error: null };
    }
  }

  return {
    workerId: null,
    workerName: 'Unassigned contractor',
    error: null
  };
}

function moneyMatches(left: number | null, right: number): boolean {
  if (left === null || !Number.isFinite(left) || !Number.isFinite(right)) return false;
  return Math.abs(left - right) < 0.005;
}

function looksLikeJobCreationPlannedPay(job: VerifiedJob, body: Record<string, unknown>, totalCost: number): boolean {
  if (!moneyMatches(job.expected_contractor_cost, totalCost)) return false;
  if (body.payment_status && body.payment_status !== 'unpaid') return false;

  const note = typeof body.notes === 'string' ? body.notes.trim() : '';
  if (note === 'Added during job creation') return true;
  if (!note || !job.notes) return false;
  return job.notes.includes(`Worker pay notes: ${note}`);
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

  const job = await verifyJob(ctx, jobId);
  if (!job) {
    return NextResponse.json({ error: 'Job not found' }, { status: 404 });
  }

  const body = (await request.json()) as Record<string, unknown>;
  const resolvedWorker = await resolveWorkerId(ctx, body.worker_id, body.worker_name, job.assigned_to);
  if (resolvedWorker.error || (!resolvedWorker.workerId && !resolvedWorker.workerName)) {
    return NextResponse.json({ error: resolvedWorker.error || 'Unable to verify contractor' }, { status: 400 });
  }

  const labor = buildLaborRow({
    hours: body.payment_basis === 'flat' ? 1 : body.hours,
    hourlyCost: body.hourly_cost ?? body.hourlyCost,
    paymentBasis: body.payment_basis ?? body.paymentBasis
  });

  if (labor.payment_basis !== 'flat' && labor.hours <= 0) {
    return NextResponse.json({ error: 'Quantity must be greater than zero' }, { status: 400 });
  }

  /*
   * New Job already persists expected_contractor_cost on jobs. Older creator code
   * also POSTs the same unpaid amount here immediately afterward. Treat that
   * specific follow-up as an idempotent acknowledgement so planned pay remains
   * the single source until the user explicitly finalizes or adds extra labor.
   */
  if (looksLikeJobCreationPlannedPay(job, body, labor.total_cost)) {
    const { count, error: countError } = await ctx.supabase
      .from('job_labor')
      .select('id', { count: 'exact', head: true })
      .eq('organization_id', ctx.organizationId)
      .eq('job_id', jobId);

    if (!countError && (count || 0) === 0) {
      return NextResponse.json({
        labor: null,
        planned: true,
        message: 'Planned contractor pay is already saved on the job.'
      });
    }
  }

  const insertPayload: Record<string, unknown> = {
    organization_id: ctx.organizationId,
    job_id: jobId,
    worker_id: resolvedWorker.workerId,
    worker_name: resolvedWorker.workerName || (typeof body.worker_name === 'string' ? body.worker_name.trim() : null),
    hours: labor.hours,
    hourly_cost: labor.hourly_cost,
    total_cost: labor.total_cost,
    notes: typeof body.notes === 'string' ? body.notes.trim() || null : null,
    payment_basis: labor.payment_basis,
    payment_status: body.payment_status === 'paid' ? 'paid' : body.payment_status === 'pending' ? 'pending' : 'unpaid',
    paid_at: body.payment_status === 'paid' ? body.paid_at || new Date().toISOString() : null
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
