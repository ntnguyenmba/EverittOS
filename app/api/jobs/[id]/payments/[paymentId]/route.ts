import { NextResponse } from 'next/server';
import { logWorkspaceActivity } from '@/lib/activity-server';
import { requireFinanceApiAccess } from '@/lib/finance-api-auth';
import { deleteInvoicePayment, updateInvoicePayment } from '@/lib/finance/edit-invoice-payment';
import { deleteJobPayment, updateJobPayment } from '@/lib/finance/job-payments';
import { fetchJobProfitability } from '@/lib/finance-server';
import { isValidUuid } from '@/lib/input-validation';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type RouteParams = { params: Promise<{ id: string; paymentId: string }> };

function paymentSource(request: Request, body?: { source?: string | null }): 'job' | 'invoice' {
  const fromBody = body?.source === 'invoice' ? 'invoice' : body?.source === 'job' ? 'job' : null;
  if (fromBody) return fromBody;
  const url = new URL(request.url);
  return url.searchParams.get('source') === 'invoice' ? 'invoice' : 'job';
}

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
    source?: string | null;
  };

  const source = paymentSource(request, body);

  if (source === 'invoice') {
    const result = await updateInvoicePayment(ctx.supabase, {
      organizationId: ctx.organizationId,
      paymentId,
      jobId,
      amount: body.amount !== undefined ? Number(body.amount) : undefined,
      paidDate: body.paid_date,
      paymentMethod: body.payment_method,
      paymentReference: body.payment_reference,
      paymentNotes: body.payment_notes
    });

    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }

    await logWorkspaceActivity(
      ctx.organizationId,
      ctx.userId,
      'job',
      jobId,
      'invoice_payment_updated',
      'Invoice payment updated from job',
      {
        payment_id: paymentId,
        invoice_id: result.invoiceId,
        amount: body.amount !== undefined ? Number(body.amount) : undefined
      }
    );

    const profitability = await fetchJobProfitability(ctx.supabase, ctx.organizationId, jobId);
    return NextResponse.json({ ok: true, profitability });
  }

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

  await logWorkspaceActivity(
    ctx.organizationId,
    ctx.userId,
    'job',
    jobId,
    'job_payment_updated',
    'Client payment updated on job',
    {
      payment_id: paymentId,
      amount: body.amount !== undefined ? Number(body.amount) : undefined,
      paid_date: body.paid_date || null,
      payment_method: body.payment_method || null
    }
  );

  const profitability = await fetchJobProfitability(ctx.supabase, ctx.organizationId, jobId);
  return NextResponse.json({ ok: true, payment: result.payment, profitability });
}

export async function DELETE(request: Request, { params }: RouteParams) {
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

  const source = paymentSource(request);

  if (source === 'invoice') {
    const result = await deleteInvoicePayment(ctx.supabase, {
      organizationId: ctx.organizationId,
      paymentId,
      jobId
    });
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }

    await logWorkspaceActivity(
      ctx.organizationId,
      ctx.userId,
      'job',
      jobId,
      'invoice_payment_removed',
      'Invoice payment removed from job',
      { payment_id: paymentId, invoice_id: result.invoiceId }
    );

    const profitability = await fetchJobProfitability(ctx.supabase, ctx.organizationId, jobId);
    return NextResponse.json({ ok: true, profitability });
  }

  const result = await deleteJobPayment(ctx.supabase, ctx.organizationId, jobId, paymentId);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  await logWorkspaceActivity(
    ctx.organizationId,
    ctx.userId,
    'job',
    jobId,
    'job_payment_removed',
    'Client payment removed from job',
    { payment_id: paymentId }
  );

  const profitability = await fetchJobProfitability(ctx.supabase, ctx.organizationId, jobId);
  return NextResponse.json({ ok: true, profitability });
}
