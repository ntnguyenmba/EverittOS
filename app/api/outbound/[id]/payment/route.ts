import { NextResponse } from 'next/server';
import { logWorkspaceActivity } from '@/lib/activity-server';
import { requireOutboundApiAccess } from '@/lib/outbound/auth';
import { recordInvoicePaymentByOutboundId } from '@/lib/finance/record-invoice-payment';
import { canRecordInvoicePayments } from '@/lib/roles';
import { isValidUuid } from '@/lib/input-validation';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type RouteContext = { params: Promise<{ id: string }> };

/**
 * Canonical customer payment API (outbound invoice document id).
 * Delegates to the shared finance payment recorder so ledger + summaries stay in sync.
 */
export async function POST(request: Request, context: RouteContext) {
  const ctx = await requireOutboundApiAccess();
  if (!ctx.ok) {
    return NextResponse.json({ error: ctx.error }, { status: ctx.status });
  }

  if (!canRecordInvoicePayments(ctx.role)) {
    return NextResponse.json({ error: 'You do not have permission to record payments.' }, { status: 403 });
  }

  const { id } = await context.params;
  if (!isValidUuid(id)) {
    return NextResponse.json({ error: 'Invalid document id.' }, { status: 400 });
  }

  const body = (await request.json()) as {
    amount?: number | string;
    payment_method?: string;
    payment_reference?: string;
    payment_notes?: string;
    paid_date?: string;
    cancel?: boolean;
  };

  const result = await recordInvoicePaymentByOutboundId(ctx.supabase, id, {
    organizationId: ctx.organizationId,
    userId: ctx.userId,
    amount: body.amount !== undefined ? Number(body.amount) : undefined,
    paidDate: body.paid_date,
    paymentMethod: body.payment_method,
    paymentReference: body.payment_reference,
    paymentNotes: body.payment_notes,
    cancel: Boolean(body.cancel)
  });

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  const activityAction =
    result.paymentStatus === 'paid'
      ? 'invoice_marked_paid'
      : body.cancel
        ? 'invoice_payment_updated'
        : 'invoice_payment_recorded';

  await logWorkspaceActivity(
    ctx.organizationId,
    ctx.userId,
    'invoice',
    id,
    activityAction,
    body.cancel ? 'Invoice marked cancelled' : 'Invoice payment recorded',
    {
      amount_paid: result.amountPaid,
      payment_increment: result.paymentIncrement,
      payment_status: result.paymentStatus,
      payment_method: body.payment_method || null,
      payment_reference: body.payment_reference || null
    }
  );

  return NextResponse.json({
    document: result.document,
    invoice: result.invoice,
    payment_status: result.paymentStatus,
    amount_paid: result.amountPaid,
    balance_due: result.balanceDue,
    payment_increment: result.paymentIncrement,
    payment_id: result.paymentId
  });
}
