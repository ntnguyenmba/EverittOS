import { NextResponse } from 'next/server';
import { logWorkspaceActivity } from '@/lib/activity-server';
import { requireOutboundApiAccess } from '@/lib/outbound/auth';
import { recordInvoicePaymentByOutboundId } from '@/lib/finance/record-invoice-payment';
import { canRecordInvoicePayments } from '@/lib/roles';
import { isValidUuid } from '@/lib/input-validation';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type RouteContext = { params: Promise<{ id: string }> };

function paymentErrorCode(error: string): string | undefined {
  const message = String(error || '').trim();
  if (message === 'You do not have permission to record payments.') return 'permission_denied';
  if (message === 'Permission denied' || message === 'Permission denied.') return 'permission_denied';
  if (message === 'Invalid document id.') return 'invalid_invoice_id';
  if (message === 'Invalid invoice id.') return 'invalid_invoice_id';
  if (message === 'Invoice not found.' || message === 'Invoice not found') return 'invoice_not_found';
  if (message === 'Enter a positive payment amount.' || message === 'Enter a positive payment amount') {
    return 'enter_positive_payment';
  }
  if (message === 'Unable to record payment') return 'unable_to_record_payment';
  return undefined;
}

function paymentErrorResponse(error: string, status: number) {
  const code = paymentErrorCode(error);
  return NextResponse.json(code ? { error, code } : { error }, { status });
}

/**
 * Canonical customer payment API (outbound invoice document id).
 * Delegates to the shared finance payment recorder so ledger + summaries stay in sync.
 */
export async function POST(request: Request, context: RouteContext) {
  const ctx = await requireOutboundApiAccess();
  if (!ctx.ok) {
    return paymentErrorResponse(ctx.error, ctx.status);
  }

  if (!canRecordInvoicePayments(ctx.role)) {
    return paymentErrorResponse('You do not have permission to record payments.', 403);
  }

  const { id } = await context.params;
  if (!isValidUuid(id)) {
    return paymentErrorResponse('Invalid document id.', 400);
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
    return paymentErrorResponse(result.error, result.status);
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
