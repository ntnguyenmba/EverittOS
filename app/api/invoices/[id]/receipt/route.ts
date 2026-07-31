import { NextResponse } from 'next/server';
import { requireFinanceApiAccess } from '@/lib/finance-api-auth';
import { isValidUuid } from '@/lib/input-validation';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type RouteParams = { params: Promise<{ id: string }> };

function formatMoney(value: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value);
}

function formatDate(value: string | null | undefined) {
  if (!value) return new Date().toLocaleDateString('en-US');
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? value : parsed.toLocaleDateString('en-US');
}

export async function POST(_request: Request, { params }: RouteParams) {
  const ctx = await requireFinanceApiAccess();
  if (!ctx.ok) {
    return NextResponse.json({ error: ctx.error }, { status: ctx.status });
  }
  if (!ctx.canManage) {
    return NextResponse.json({ error: 'You do not have permission to create receipts.' }, { status: 403 });
  }

  const { id } = await params;
  if (!isValidUuid(id)) {
    return NextResponse.json({ error: 'Invalid invoice id.' }, { status: 400 });
  }

  const { data: invoice, error: invoiceError } = await ctx.supabase
    .from('invoices')
    .select('*')
    .eq('id', id)
    .eq('organization_id', ctx.organizationId)
    .maybeSingle();

  if (invoiceError) {
    return NextResponse.json({ error: invoiceError.message }, { status: 400 });
  }
  if (!invoice) {
    return NextResponse.json({ error: 'Invoice not found.' }, { status: 404 });
  }

  const { data: linkedDocument } = await ctx.supabase
    .from('outbound_documents')
    .select('recipient_name, recipient_email, customer_id, job_id')
    .eq('organization_id', ctx.organizationId)
    .eq('doc_type', 'invoice')
    .eq('source_entity_id', id)
    .maybeSingle();

  let recipientName = linkedDocument?.recipient_name || '';
  let recipientEmail = linkedDocument?.recipient_email || '';
  const customerId = linkedDocument?.customer_id || invoice.customer_id || null;

  if (customerId && (!recipientName || !recipientEmail)) {
    const { data: customer } = await ctx.supabase
      .from('customers')
      .select('name, email')
      .eq('id', customerId)
      .eq('organization_id', ctx.organizationId)
      .maybeSingle();
    recipientName = recipientName || customer?.name || '';
    recipientEmail = recipientEmail || customer?.email || '';
  }

  const paymentAmount = Math.max(0, Number(invoice.amount_paid || 0));
  const invoiceAmount = Math.max(0, Number(invoice.amount || 0));
  const balanceDue = Math.max(0, Number(invoice.balance_due ?? invoiceAmount - paymentAmount));
  const paymentDate = invoice.last_payment_at || invoice.paid_at || new Date().toISOString();
  const invoiceNumber = invoice.invoice_number || `INV-${id.slice(0, 8).toUpperCase()}`;

  const subject = `Payment receipt for ${invoiceNumber}`;
  const body = [
    recipientName ? `Hi ${recipientName},` : 'Hello,',
    '',
    `Thank you. We received your payment of ${formatMoney(paymentAmount)} on ${formatDate(paymentDate)}.`,
    '',
    `Invoice: ${invoiceNumber}`,
    `Invoice total: ${formatMoney(invoiceAmount)}`,
    `Amount paid: ${formatMoney(paymentAmount)}`,
    `Balance due: ${formatMoney(balanceDue)}`,
    invoice.payment_method ? `Payment method: ${invoice.payment_method}` : '',
    invoice.payment_reference ? `Reference: ${invoice.payment_reference}` : '',
    '',
    'This message serves as your payment receipt.'
  ]
    .filter(Boolean)
    .join('\n');

  const { data: receipt, error: receiptError } = await ctx.supabase
    .from('outbound_documents')
    .insert({
      organization_id: ctx.organizationId,
      doc_type: 'message',
      status: 'draft',
      recipient_name: recipientName || null,
      recipient_email: recipientEmail || null,
      subject,
      body,
      amount: paymentAmount,
      customer_id: customerId,
      job_id: linkedDocument?.job_id || invoice.job_id || null,
      source_entity_type: 'invoice_receipt',
      source_entity_id: id,
      metadata: {
        receipt: true,
        invoice_id: id,
        invoice_number: invoiceNumber,
        payment_date: paymentDate,
        payment_method: invoice.payment_method || null,
        payment_reference: invoice.payment_reference || null,
        balance_due: balanceDue
      },
      created_by: ctx.userId
    })
    .select('*')
    .single();

  if (receiptError) {
    return NextResponse.json({ error: receiptError.message }, { status: 400 });
  }

  return NextResponse.json({ receipt });
}
