import { NextResponse } from 'next/server';
import { logWorkspaceActivity } from '@/lib/activity-server';
import { requireFinanceApiAccess } from '@/lib/finance-api-auth';
import { recordInvoicePaymentByInvoiceId } from '@/lib/finance/record-invoice-payment';
import { isValidUuid } from '@/lib/input-validation';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type RouteParams = { params: Promise<{ id: string }> };

function paymentErrorCode(error: string): string | undefined {
  const message = String(error || '').trim();
  if (message === 'You do not have permission to record payments.') return 'permission_denied';
  if (message === 'Permission denied' || message === 'Permission denied.') return 'permission_denied';
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
 * Canonical customer payment API.
 * POST /api/invoices/[id]/payment
 *
 * Body: { amount, paid_date?, payment_method?, payment_reference?, payment_notes?, cancel? }
 */
export async function POST(request: Request, { params }: RouteParams) {
  const ctx = await requireFinanceApiAccess();
  if (!ctx.ok) {
    return paymentErrorResponse(ctx.error, ctx.status);
  }

  if (!ctx.canManage) {
    return paymentErrorResponse('You do not have permission to record payments.', 403);
  }

  const { id } = await params;
  if (!isValidUuid(id)) {
    return paymentErrorResponse('Invalid invoice id.', 400);
  }

  const body = (await request.json()) as {
    amount?: number | string;
    payment_method?: string;
    payment_reference?: string;
    payment_notes?: string;
    paid_date?: string;
    cancel?: boolean;
  };

  const result = await recordInvoicePaymentByInvoiceId(ctx.supabase, id, {
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
      payment_reference: body.payment_reference || null,
      payment_id: result.paymentId
    }
  );

  return NextResponse.json({
    invoice: result.invoice,
    document: result.document,
    invoice_id: result.invoiceId,
    outbound_document_id: result.outboundDocumentId,
    payment_id: result.paymentId,
    payment_increment: result.paymentIncrement,
    payment_status: result.paymentStatus,
    amount_paid: result.amountPaid,
    balance_due: result.balanceDue
  });
}
