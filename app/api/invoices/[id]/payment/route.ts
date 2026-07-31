import { NextResponse } from 'next/server';
import { logWorkspaceActivity } from '@/lib/activity-server';
import { requireFinanceApiAccess } from '@/lib/finance-api-auth';
import { recordInvoicePaymentByInvoiceId } from '@/lib/finance/record-invoice-payment';
import { isValidUuid } from '@/lib/input-validation';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type RouteParams = { params: Promise<{ id: string }> };

/**
 * Canonical customer payment API.
 * POST /api/invoices/[id]/payment
 *
 * Body: { amount, paid_date?, payment_method?, payment_reference?, payment_notes?, cancel? }
 */
export async function POST(request: Request, { params }: RouteParams) {
  const ctx = await requireFinanceApiAccess();
  if (!ctx.ok) {
    return NextResponse.json({ error: ctx.error }, { status: ctx.status });
  }

  if (!ctx.canManage) {
    return NextResponse.json({ error: 'You do not have permission to record payments.' }, { status: 403 });
  }

  const { id } = await params;
  if (!isValidUuid(id)) {
    return NextResponse.json({ error: 'Invalid invoice id.' }, { status: 400 });
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
