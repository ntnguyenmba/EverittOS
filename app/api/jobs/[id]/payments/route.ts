import { NextResponse } from 'next/server';
import { logWorkspaceActivity } from '@/lib/activity-server';
import { requireFinanceApiAccess } from '@/lib/finance-api-auth';
import { updateInvoicePayment } from '@/lib/finance/edit-invoice-payment';
import {
  CLIENT_PAYMENT_METHODS,
  fetchJobPaymentHistory,
  recordJobPayment,
  updateJobPayment
} from '@/lib/finance/job-payments';
import { withTruthfulProfit } from '@/lib/finance/profit-math';
import { fetchJobProfitability } from '@/lib/finance-server';
import { isValidUuid } from '@/lib/input-validation';
import { sendJobPaymentReceipt } from '@/lib/outbound/send-job-payment-receipt';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type RouteParams = { params: Promise<{ id: string }> };

async function resolveJob(ctx: Awaited<ReturnType<typeof requireFinanceApiAccess>>, jobId: string) {
  if (!ctx.ok) return null;
  const { data: job } = await ctx.supabase
    .from('jobs')
    .select('id, customer_id, title')
    .eq('id', jobId)
    .eq('organization_id', ctx.organizationId)
    .maybeSingle();
  return job;
}

function sameMoney(left: number, right: number) {
  return Math.abs(left - right) < 0.01;
}

async function truthfulProfitability(ctx: Awaited<ReturnType<typeof requireFinanceApiAccess>>, jobId: string) {
  if (!ctx.ok) return null;
  return withTruthfulProfit(await fetchJobProfitability(ctx.supabase, ctx.organizationId, jobId));
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

  const [profitability, history] = await Promise.all([
    truthfulProfitability(ctx, jobId),
    fetchJobPaymentHistory(ctx.supabase, ctx.organizationId, jobId)
  ]);

  return NextResponse.json({
    profitability,
    payments: history.payments,
    paymentMethods: CLIENT_PAYMENT_METHODS
  });
}

export async function POST(request: Request, { params }: RouteParams) {
  const ctx = await requireFinanceApiAccess();
  if (!ctx.ok) {
    return NextResponse.json({ error: ctx.error }, { status: ctx.status });
  }

  if (!ctx.canManage) {
    return NextResponse.json({ error: 'You do not have permission to record payments.' }, { status: 403 });
  }

  const { id: jobId } = await params;
  if (!isValidUuid(jobId)) {
    return NextResponse.json({ error: 'Invalid job id' }, { status: 400 });
  }

  const job = await resolveJob(ctx, jobId);
  if (!job) {
    return NextResponse.json({ error: 'Job not found' }, { status: 404 });
  }

  const body = (await request.json().catch(() => ({}))) as {
    amount?: number | string;
    paid_date?: string | null;
    payment_method?: string | null;
    payment_reference?: string | null;
    payment_notes?: string | null;
  };
  const amount = Number(body.amount);

  const [before, historyBefore] = await Promise.all([
    truthfulProfitability(ctx, jobId),
    fetchJobPaymentHistory(ctx.supabase, ctx.organizationId, jobId)
  ]);
  const existing = historyBefore.payments.length === 1 ? historyBefore.payments[0] : null;
  const replaceQuotedPayment = Boolean(
    existing &&
      before &&
      before.expectedAmount > 0 &&
      sameMoney(existing.amount, before.expectedAmount) &&
      !sameMoney(existing.amount, amount)
  );

  if (existing && replaceQuotedPayment) {
    const patch = {
      amount,
      paidDate: body.paid_date,
      paymentMethod: body.payment_method,
      paymentReference: body.payment_reference,
      paymentNotes: body.payment_notes
    };
    const replacement =
      existing.source === 'invoice'
        ? await updateInvoicePayment(ctx.supabase, {
            organizationId: ctx.organizationId,
            paymentId: existing.id,
            jobId,
            ...patch
          })
        : await updateJobPayment(ctx.supabase, ctx.organizationId, jobId, existing.id, patch);

    if (!replacement.ok) {
      return NextResponse.json({ error: replacement.error }, { status: replacement.status });
    }

    await logWorkspaceActivity(
      ctx.organizationId,
      ctx.userId,
      'job',
      jobId,
      'job_payment_corrected',
      'Existing client payment corrected on job',
      {
        payment_id: existing.id,
        source: existing.source,
        previous_amount: existing.amount,
        amount
      }
    );

    const profitability = await truthfulProfitability(ctx, jobId);
    const history = await fetchJobPaymentHistory(ctx.supabase, ctx.organizationId, jobId);
    return NextResponse.json({
      ok: true,
      replacedExisting: true,
      profitability,
      payments: history.payments
    });
  }

  const result = await recordJobPayment(ctx.supabase, {
    organizationId: ctx.organizationId,
    userId: ctx.userId,
    jobId,
    customerId: job.customer_id,
    amount,
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
    'job_payment_recorded',
    'Client payment recorded on job',
    {
      amount,
      via_invoice: result.viaInvoice,
      invoice_id: result.invoiceId
    }
  );

  const profitability = await truthfulProfitability(ctx, jobId);
  const history = await fetchJobPaymentHistory(ctx.supabase, ctx.organizationId, jobId);
  const newestPayment = history.payments[0] || null;
  const receiptDelivery = newestPayment
    ? await sendJobPaymentReceipt({
        supabase: ctx.supabase,
        organizationId: ctx.organizationId,
        jobId,
        source: newestPayment.source,
        paymentId: newestPayment.id
      })
    : { sent: false, error: 'Payment was saved, but the receipt could not be prepared.' };

  await logWorkspaceActivity(
    ctx.organizationId,
    ctx.userId,
    'job',
    jobId,
    receiptDelivery.sent ? 'receipt_sent' : 'receipt_send_failed',
    receiptDelivery.sent
      ? `Payment receipt emailed to ${receiptDelivery.recipientEmail}`
      : receiptDelivery.error || 'Payment receipt email failed',
    {
      payment_id: newestPayment?.id || null,
      recipient_email: receiptDelivery.recipientEmail || null,
      email_sent: receiptDelivery.sent,
      error: receiptDelivery.error || null
    }
  );

  return NextResponse.json({
    ok: true,
    viaInvoice: result.viaInvoice,
    invoiceId: result.invoiceId,
    profitability,
    payments: history.payments,
    receiptDelivery
  });
}
