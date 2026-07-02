import { NextResponse } from 'next/server';
import { logWorkspaceActivity } from '@/lib/activity-server';
import { requireOutboundApiAccess } from '@/lib/outbound/auth';
import {
  calculateBalanceDue,
  calculateInvoicePaymentStatus,
  INVOICE_PAYMENT_METHODS,
  type InvoicePaymentStatus
} from '@/lib/outbound/invoice-payment';
import { canRecordInvoicePayments } from '@/lib/roles';
import { isValidUuid } from '@/lib/input-validation';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type RouteContext = { params: Promise<{ id: string }> };

function parsePaymentDate(value: unknown): string | null {
  if (!value || typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return null;
  return trimmed;
}

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

  const { data: document, error: readError } = await ctx.supabase
    .from('outbound_documents')
    .select('*')
    .eq('id', id)
    .eq('organization_id', ctx.organizationId)
    .maybeSingle();

  if (readError) {
    return NextResponse.json({ error: readError.message }, { status: 400 });
  }
  if (!document) {
    return NextResponse.json({ error: 'Invoice not found.' }, { status: 404 });
  }
  if (document.doc_type !== 'invoice') {
    return NextResponse.json({ error: 'Payment recording is only available for invoices.' }, { status: 400 });
  }

  const invoiceAmount = Math.max(0, Number(document.amount || 0));
  const existingPaid = Math.max(0, Number(document.amount_paid || 0));
  const now = new Date().toISOString();
  const paidDate = parsePaymentDate(body.paid_date) || now.slice(0, 10);

  let nextPaid = existingPaid;
  let paymentStatus: InvoicePaymentStatus;
  let activityAction = 'invoice_payment_recorded';
  let activityMessage = 'Invoice payment recorded';

  if (body.cancel) {
    paymentStatus = 'cancelled';
    activityAction = 'invoice_payment_updated';
    activityMessage = 'Invoice marked cancelled';
  } else {
    const paymentAmount = Number(body.amount);
    if (!Number.isFinite(paymentAmount) || paymentAmount <= 0) {
      return NextResponse.json({ error: 'Enter a positive payment amount.' }, { status: 400 });
    }

    const method = body.payment_method?.trim() || null;
    if (method && !INVOICE_PAYMENT_METHODS.includes(method as (typeof INVOICE_PAYMENT_METHODS)[number]) && method !== 'Other') {
      // Allow free text that maps to Other
    }

    nextPaid = invoiceAmount > 0 ? Math.min(existingPaid + paymentAmount, invoiceAmount) : existingPaid + paymentAmount;

    paymentStatus = calculateInvoicePaymentStatus({
      amount: invoiceAmount || nextPaid,
      amount_paid: nextPaid,
      due_date: document.due_date,
      cancelled: false
    });

    if (paymentStatus === 'paid') {
      activityAction = 'invoice_marked_paid';
      activityMessage = 'Invoice marked paid';
    }
  }

  const balanceDue = calculateBalanceDue(invoiceAmount || nextPaid, nextPaid);
  const docPatch: Record<string, unknown> = {
    amount_paid: nextPaid,
    balance_due: balanceDue,
    payment_status: paymentStatus,
    last_payment_at: body.cancel ? document.last_payment_at : now,
    updated_at: now
  };

  if (!body.cancel) {
    docPatch.payment_method = body.payment_method?.trim() || document.payment_method;
    docPatch.payment_reference = body.payment_reference?.trim() || document.payment_reference;
    const note = body.payment_notes?.trim();
    if (note) {
      const prior = typeof document.payment_notes === 'string' ? document.payment_notes : '';
      docPatch.payment_notes = prior ? `${prior}\n${note}` : note;
    }
    if (paymentStatus === 'paid') {
      docPatch.paid_at = `${paidDate}T12:00:00.000Z`;
    }
  }

  const { data: updated, error: updateError } = await ctx.supabase
    .from('outbound_documents')
    .update(docPatch)
    .eq('id', id)
    .eq('organization_id', ctx.organizationId)
    .select('*')
    .single();

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 400 });
  }

  if (document.source_entity_id) {
    const invoicePatch: Record<string, unknown> = {
      amount_paid: nextPaid,
      balance_due: balanceDue,
      payment_status: paymentStatus,
      last_payment_at: docPatch.last_payment_at,
      payment_method: docPatch.payment_method,
      payment_reference: docPatch.payment_reference,
      payment_notes: docPatch.payment_notes,
      updated_at: now
    };
    if (paymentStatus === 'paid') {
      invoicePatch.paid_at = docPatch.paid_at;
      invoicePatch.status = 'paid';
    } else if (paymentStatus === 'partially_paid') {
      invoicePatch.status = 'partial';
    } else if (paymentStatus === 'cancelled') {
      invoicePatch.status = 'cancelled';
    }
    await ctx.supabase
      .from('invoices')
      .update(invoicePatch)
      .eq('id', document.source_entity_id)
      .eq('organization_id', ctx.organizationId);
  }

  await logWorkspaceActivity(
    ctx.organizationId,
    ctx.userId,
    'invoice',
    id,
    activityAction,
    activityMessage,
    {
      amount_paid: nextPaid,
      payment_status: paymentStatus,
      payment_method: docPatch.payment_method,
      payment_reference: docPatch.payment_reference
    }
  );

  return NextResponse.json({ document: updated, payment_status: paymentStatus });
}
