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
  if (!value) return new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime())
    ? value
    : parsed.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
}

export async function POST(request: Request, { params }: RouteParams) {
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

  const body = (await request.json().catch(() => ({}))) as {
    payment_id?: string;
    payment_amount?: number;
  };
  const paymentId = body.payment_id && isValidUuid(body.payment_id) ? body.payment_id : '';

  const { data: invoice, error: invoiceError } = await ctx.supabase
    .from('invoices')
    .select('*')
    .eq('id', id)
    .eq('organization_id', ctx.organizationId)
    .maybeSingle();

  let outboundInvoice: Record<string, unknown> | null = null;
  if (invoiceError) {
    return NextResponse.json({ error: invoiceError.message }, { status: 400 });
  }

  if (!invoice) {
    const { data: outbound } = await ctx.supabase
      .from('outbound_documents')
      .select('*')
      .eq('id', id)
      .eq('organization_id', ctx.organizationId)
      .eq('doc_type', 'invoice')
      .maybeSingle();
    if (!outbound) {
      return NextResponse.json({ error: 'Invoice not found.' }, { status: 404 });
    }
    outboundInvoice = outbound as Record<string, unknown>;
  } else {
    const { data: outbound } = await ctx.supabase
      .from('outbound_documents')
      .select('*')
      .eq('organization_id', ctx.organizationId)
      .eq('doc_type', 'invoice')
      .eq('source_entity_id', id)
      .maybeSingle();
    outboundInvoice = (outbound as Record<string, unknown>) || null;
  }

  // Prefer an existing receipt for this payment / invoice.
  const { data: existingReceipts } = await ctx.supabase
    .from('outbound_documents')
    .select('*')
    .eq('organization_id', ctx.organizationId)
    .eq('doc_type', 'receipt')
    .order('created_at', { ascending: false })
    .limit(25);

  const existing = (existingReceipts || []).find((doc) => {
    const meta = (doc.metadata || {}) as Record<string, unknown>;
    if (paymentId && meta.payment_id === paymentId) return true;
    if (!paymentId && (meta.invoice_id === id || doc.source_entity_id === id) && !meta.payment_id) return true;
    return false;
  });
  if (existing) {
    return NextResponse.json({ receipt: existing, existing: true });
  }

  let paymentRow: Record<string, unknown> | null = null;
  if (paymentId) {
    const { data } = await ctx.supabase
      .from('invoice_payments')
      .select('*')
      .eq('id', paymentId)
      .eq('organization_id', ctx.organizationId)
      .maybeSingle();
    paymentRow = (data as Record<string, unknown>) || null;
  } else {
    let ledgerQuery = ctx.supabase
      .from('invoice_payments')
      .select('*')
      .eq('organization_id', ctx.organizationId)
      .order('paid_at', { ascending: false })
      .limit(1);
    if (invoice) ledgerQuery = ledgerQuery.eq('invoice_id', id);
    else if (outboundInvoice) ledgerQuery = ledgerQuery.eq('outbound_document_id', id);
    const { data } = await ledgerQuery.maybeSingle();
    paymentRow = (data as Record<string, unknown>) || null;
  }

  let recipientName = (outboundInvoice?.recipient_name as string) || '';
  let recipientEmail = (outboundInvoice?.recipient_email as string) || '';
  const customerId =
    (outboundInvoice?.customer_id as string) ||
    (invoice?.customer_id as string) ||
    null;
  const jobId =
    (outboundInvoice?.job_id as string) ||
    (invoice?.job_id as string) ||
    null;

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

  let jobTitle = '';
  if (jobId) {
    const { data: job } = await ctx.supabase
      .from('jobs')
      .select('title')
      .eq('id', jobId)
      .eq('organization_id', ctx.organizationId)
      .maybeSingle();
    jobTitle = job?.title || '';
  }

  const paymentAmount = Math.max(
    0,
    Number(
      body.payment_amount ||
        paymentRow?.amount ||
        invoice?.amount_paid ||
        outboundInvoice?.amount_paid ||
        0
    )
  );
  const paymentDate =
    (paymentRow?.paid_at as string) ||
    (invoice?.last_payment_at as string) ||
    (outboundInvoice?.last_payment_at as string) ||
    (invoice?.paid_at as string) ||
    new Date().toISOString();
  const paymentMethod =
    (paymentRow?.payment_method as string) ||
    (invoice?.payment_method as string) ||
    (outboundInvoice?.payment_method as string) ||
    null;
  const paymentReference =
    (paymentRow?.payment_reference as string) ||
    (invoice?.payment_reference as string) ||
    (outboundInvoice?.payment_reference as string) ||
    null;
  const invoiceNumber =
    (invoice?.invoice_number as string) || `INV-${id.slice(0, 8).toUpperCase()}`;

  const money = formatMoney(paymentAmount);
  const when = formatDate(paymentDate);
  const forJob = jobTitle ? ` for ${jobTitle}` : '';
  let receiptBody = `Thank you. We received your payment of ${money}${forJob} on ${when}.`;
  if (paymentMethod) receiptBody += `\nPayment method: ${paymentMethod}`;
  if (paymentReference) receiptBody += `\nReference: ${paymentReference}`;

  const { data: receipt, error: receiptError } = await ctx.supabase
    .from('outbound_documents')
    .insert({
      organization_id: ctx.organizationId,
      doc_type: 'receipt',
      status: 'draft',
      recipient_name: recipientName || null,
      recipient_email: recipientEmail || null,
      subject: 'Payment receipt',
      body: receiptBody,
      amount: paymentAmount,
      customer_id: customerId,
      job_id: jobId,
      source_entity_type: 'invoice_receipt',
      source_entity_id: invoice ? id : (outboundInvoice?.source_entity_id as string) || id,
      metadata: {
        receipt: true,
        invoice_id: invoice ? id : (outboundInvoice?.source_entity_id as string) || id,
        invoice_number: invoiceNumber,
        payment_id: paymentRow?.id ? String(paymentRow.id) : paymentId || null,
        payment_date: paymentDate,
        payment_method: paymentMethod,
        payment_reference: paymentReference,
        payment_amount: paymentAmount
      },
      created_by: ctx.userId
    })
    .select('*')
    .single();

  if (receiptError) {
    return NextResponse.json({ error: receiptError.message }, { status: 400 });
  }

  return NextResponse.json({ receipt, existing: false });
}
