import { NextResponse } from 'next/server';
import { requireFinanceApiAccess } from '@/lib/finance-api-auth';
import { deleteJobPayment, updateJobPayment } from '@/lib/finance/job-payments';
import { fetchJobProfitability } from '@/lib/finance-server';
import { isValidUuid } from '@/lib/input-validation';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type RouteParams = { params: Promise<{ id: string; paymentId: string }> };

export async function PATCH(request: Request, { params }: RouteParams) {
  const ctx = await requireFinanceApiAccess();
  if (!ctx.ok) {
    return NextResponse.json({ error: ctx.error }, { status: ctx.status });
  }

  if (!ctx.canManage) {
    return NextResponse.json({ error: 'You do not have permission to edit payments.' }, { status: 403 });
  }

  const { id: jobId, paymentId } = await params;
  if (!isValidUuid(jobId) || !isValidUuid(paymentId)) {
    return NextResponse.json({ error: 'Invalid id' }, { status: 400 });
  }

  const body = (await request.json().catch(() => ({}))) as {
    amount?: number | string;
    paid_date?: string | null;
    payment_method?: string | null;
    payment_reference?: string | null;
    payment_notes?: string | null;
  };

  const result = await updateJobPayment(ctx.supabase, ctx.organizationId, jobId, paymentId, {
    amount: body.amount !== undefined ? Number(body.amount) : undefined,
    paidDate: body.paid_date,
    paymentMethod: body.payment_method,
    paymentReference: body.payment_reference,
    paymentNotes: body.payment_notes
  });

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  const profitability = await fetchJobProfitability(ctx.supabase, ctx.organizationId, jobId);
  return NextResponse.json({ ok: true, payment: result.payment, profitability });
}

export async function DELETE(_request: Request, { params }: RouteParams) {
  const ctx = await requireFinanceApiAccess();
  if (!ctx.ok) {
    return NextResponse.json({ error: ctx.error }, { status: ctx.status });
  }

  if (!ctx.canManage) {
    return NextResponse.json({ error: 'You do not have permission to delete payments.' }, { status: 403 });
  }

  const { id: jobId, paymentId } = await params;
  if (!isValidUuid(jobId) || !isValidUuid(paymentId)) {
    return NextResponse.json({ error: 'Invalid id' }, { status: 400 });
  }

  const result = await deleteJobPayment(ctx.supabase, ctx.organizationId, jobId, paymentId);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  const profitability = await fetchJobProfitability(ctx.supabase, ctx.organizationId, jobId);
  return NextResponse.json({ ok: true, profitability });
}
