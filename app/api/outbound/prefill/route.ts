import { NextResponse } from 'next/server';
import {
  getBillingOpsCopy,
  localizedInvoiceBody,
  localizedInvoiceSubject,
  localizedReceiptBody,
  localizedReceiptSubject
} from '@/lib/i18n/billing-ops-copy';
import { normalizeLocale } from '@/lib/i18n/config';
import { formatDateLocale, formatMoneyUsd } from '@/lib/i18n/locale-format';
import { requireOutboundApiAccess } from '@/lib/outbound/auth';
import { isValidUuid } from '@/lib/input-validation';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const ctx = await requireOutboundApiAccess();
  if (!ctx.ok) {
    return NextResponse.json({ error: ctx.error }, { status: ctx.status });
  }

  const url = new URL(request.url);
  const locale = normalizeLocale(url.searchParams.get('locale'));
  const billingCopy = getBillingOpsCopy(locale);
  const jobId = url.searchParams.get('jobId')?.trim() || '';
  const customerId = url.searchParams.get('customerId')?.trim() || '';
  const invoiceId = url.searchParams.get('invoiceId')?.trim() || '';
  const paymentId = url.searchParams.get('paymentId')?.trim() || '';
  const docType = (url.searchParams.get('docType')?.trim() || 'invoice').toLowerCase();
  const forceNew = url.searchParams.get('forceNew') === '1';

  if (jobId && !isValidUuid(jobId)) {
    return NextResponse.json(
      { error: billingCopy.invalidJobId, code: 'invalid_job_id' },
      { status: 400 }
    );
  }
  if (customerId && !isValidUuid(customerId)) {
    return NextResponse.json(
      { error: billingCopy.invalidCustomerId, code: 'invalid_customer_id' },
      { status: 400 }
    );
  }
  if (invoiceId && !isValidUuid(invoiceId)) {
    return NextResponse.json(
      { error: billingCopy.invalidInvoiceId, code: 'invalid_invoice_id' },
      { status: 400 }
    );
  }
  if (paymentId && !isValidUuid(paymentId)) {
    return NextResponse.json(
      { error: billingCopy.invalidPaymentId, code: 'invalid_payment_id' },
      { status: 400 }
    );
  }

  // Receipt prefill from invoice / payment
  if (docType === 'receipt' || invoiceId || paymentId) {
    return prefillReceipt(ctx, { invoiceId, paymentId, jobId, customerId, locale });
  }

  let job: {
    id: string;
    title: string | null;
    customer_id: string | null;
    customer_name: string | null;
    customer_email: string | null;
    revenue_amount: number | null;
  } | null = null;

  if (jobId) {
    const { data, error } = await ctx.supabase
      .from('jobs')
      .select('id, title, customer_id, customer_name, customer_email, revenue_amount')
      .eq('id', jobId)
      .eq('organization_id', ctx.organizationId)
      .maybeSingle();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    if (!data) {
      return NextResponse.json(
        { error: billingCopy.jobNotFound, code: 'job_not_found' },
        { status: 404 }
      );
    }
    job = data;
  }

  const resolvedCustomerId = customerId || job?.customer_id || '';
  let customer: { id: string; name: string | null; email: string | null } | null = null;

  if (resolvedCustomerId) {
    const { data, error } = await ctx.supabase
      .from('customers')
      .select('id, name, email')
      .eq('id', resolvedCustomerId)
      .eq('organization_id', ctx.organizationId)
      .maybeSingle();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    customer = data;
  }

  const jobTitle = job?.title || '';
  const amount = job?.revenue_amount ?? null;

  let existingInvoice: {
    id: string;
    status: string | null;
    payment_status?: string | null;
    subject?: string | null;
    amount?: number | null;
  } | null = null;

  if (job?.id && !forceNew) {
    const { data: existingDocs } = await ctx.supabase
      .from('outbound_documents')
      .select('id, status, payment_status, subject, amount, updated_at')
      .eq('organization_id', ctx.organizationId)
      .eq('doc_type', 'invoice')
      .eq('job_id', job.id)
      .order('updated_at', { ascending: false })
      .limit(5);

    const docs = existingDocs || [];
    existingInvoice =
      docs.find((doc) => String(doc.payment_status || '').toLowerCase() !== 'cancelled') ||
      docs[0] ||
      null;
  }

  return NextResponse.json({
    prefill: {
      job_id: job?.id || jobId || null,
      customer_id: customer?.id || resolvedCustomerId || null,
      recipient_name: customer?.name || job?.customer_name || '',
      recipient_email: customer?.email || job?.customer_email || '',
      amount,
      job_title: jobTitle,
      subject: jobTitle ? localizedInvoiceSubject(locale, jobTitle) : billingCopy.invoiceForCompletedWork,
      body: jobTitle ? localizedInvoiceBody(locale, jobTitle) : billingCopy.thankYouBusiness,
      amount_missing: !(Number(amount) > 0)
    },
    existing_invoice: existingInvoice
      ? {
          id: existingInvoice.id,
          status: existingInvoice.status,
          payment_status: existingInvoice.payment_status || null,
          subject: existingInvoice.subject || null,
          amount: existingInvoice.amount ?? null,
          is_paid: String(existingInvoice.payment_status || '').toLowerCase() === 'paid'
        }
      : null
  });
}

async function prefillReceipt(
  ctx: Extract<Awaited<ReturnType<typeof requireOutboundApiAccess>>, { ok: true }>,
  input: {
    invoiceId: string;
    paymentId: string;
    jobId: string;
    customerId: string;
    locale: ReturnType<typeof normalizeLocale>;
  }
) {
  const billingCopy = getBillingOpsCopy(input.locale);
  let invoiceRow: Record<string, unknown> | null = null;
  let outboundInvoice: Record<string, unknown> | null = null;
  let paymentRow: Record<string, unknown> | null = null;

  if (input.paymentId) {
    const { data, error } = await ctx.supabase
      .from('invoice_payments')
      .select('*')
      .eq('id', input.paymentId)
      .eq('organization_id', ctx.organizationId)
      .maybeSingle();
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    if (!data) {
      return NextResponse.json(
        { error: billingCopy.paymentNotFound, code: 'payment_not_found' },
        { status: 404 }
      );
    }
    paymentRow = data as Record<string, unknown>;
  }

  const resolvedInvoiceId =
    input.invoiceId ||
    (paymentRow?.invoice_id ? String(paymentRow.invoice_id) : '') ||
    (paymentRow?.outbound_document_id ? String(paymentRow.outbound_document_id) : '');

  if (resolvedInvoiceId) {
    const { data: invoice } = await ctx.supabase
      .from('invoices')
      .select('*')
      .eq('id', resolvedInvoiceId)
      .eq('organization_id', ctx.organizationId)
      .maybeSingle();
    if (invoice) invoiceRow = invoice as Record<string, unknown>;

    if (!invoiceRow) {
      const { data: outbound } = await ctx.supabase
        .from('outbound_documents')
        .select('*')
        .eq('id', resolvedInvoiceId)
        .eq('organization_id', ctx.organizationId)
        .eq('doc_type', 'invoice')
        .maybeSingle();
      if (outbound) outboundInvoice = outbound as Record<string, unknown>;
    } else {
      const { data: outbound } = await ctx.supabase
        .from('outbound_documents')
        .select('*')
        .eq('organization_id', ctx.organizationId)
        .eq('doc_type', 'invoice')
        .eq('source_entity_id', resolvedInvoiceId)
        .maybeSingle();
      if (outbound) outboundInvoice = outbound as Record<string, unknown>;
    }
  }

  if (!invoiceRow && !outboundInvoice && !paymentRow) {
    return NextResponse.json(
      { error: billingCopy.invoiceNotFound, code: 'invoice_not_found' },
      { status: 404 }
    );
  }

  const jobId =
    input.jobId ||
    (outboundInvoice?.job_id ? String(outboundInvoice.job_id) : '') ||
    (invoiceRow?.job_id ? String(invoiceRow.job_id) : '');

  let jobTitle = '';
  if (jobId) {
    const { data: job } = await ctx.supabase
      .from('jobs')
      .select('id, title, customer_id, customer_name, customer_email')
      .eq('id', jobId)
      .eq('organization_id', ctx.organizationId)
      .maybeSingle();
    jobTitle = (job?.title as string) || '';
  }

  const customerId =
    input.customerId ||
    (outboundInvoice?.customer_id ? String(outboundInvoice.customer_id) : '') ||
    (invoiceRow?.customer_id ? String(invoiceRow.customer_id) : '');

  let recipientName = (outboundInvoice?.recipient_name as string) || '';
  let recipientEmail = (outboundInvoice?.recipient_email as string) || '';

  if (customerId && (!recipientName || !recipientEmail)) {
    const { data: customer } = await ctx.supabase
      .from('customers')
      .select('id, name, email')
      .eq('id', customerId)
      .eq('organization_id', ctx.organizationId)
      .maybeSingle();
    recipientName = recipientName || customer?.name || '';
    recipientEmail = recipientEmail || customer?.email || '';
  }

  const paymentAmount = paymentRow
    ? Math.max(0, Number(paymentRow.amount || 0))
    : Math.max(0, Number(outboundInvoice?.amount_paid ?? invoiceRow?.amount_paid ?? 0));

  // Prefer the latest ledger increment when no specific payment was provided.
  let resolvedPaymentId = input.paymentId || '';
  let paymentMethod =
    (paymentRow?.payment_method as string | null) ||
    (outboundInvoice?.payment_method as string | null) ||
    (invoiceRow?.payment_method as string | null) ||
    null;
  let paymentReference =
    (paymentRow?.payment_reference as string | null) ||
    (outboundInvoice?.payment_reference as string | null) ||
    (invoiceRow?.payment_reference as string | null) ||
    null;
  let paymentDate =
    (paymentRow?.paid_at as string | null) ||
    (outboundInvoice?.last_payment_at as string | null) ||
    (invoiceRow?.last_payment_at as string | null) ||
    (invoiceRow?.paid_at as string | null) ||
    new Date().toISOString();
  let amountPaid = paymentAmount;

  if (!paymentRow && resolvedInvoiceId) {
    let ledgerQuery = ctx.supabase
      .from('invoice_payments')
      .select('*')
      .eq('organization_id', ctx.organizationId)
      .order('paid_at', { ascending: false })
      .limit(1);

    if (invoiceRow) {
      ledgerQuery = ledgerQuery.eq('invoice_id', String(invoiceRow.id));
    } else if (outboundInvoice) {
      ledgerQuery = ledgerQuery.eq('outbound_document_id', String(outboundInvoice.id));
    }

    const { data: latestPayment } = await ledgerQuery.maybeSingle();
    if (latestPayment) {
      paymentRow = latestPayment as Record<string, unknown>;
      resolvedPaymentId = String(latestPayment.id);
      amountPaid = Math.max(0, Number(latestPayment.amount || 0));
      paymentMethod = (latestPayment.payment_method as string | null) || paymentMethod;
      paymentReference = (latestPayment.payment_reference as string | null) || paymentReference;
      paymentDate = (latestPayment.paid_at as string) || paymentDate;
    }
  }

  const invoiceNumber =
    (invoiceRow?.invoice_number as string) ||
    (resolvedInvoiceId ? `INV-${resolvedInvoiceId.slice(0, 8).toUpperCase()}` : 'Invoice');

  const money = formatMoneyUsd(amountPaid, input.locale);
  const when = formatDateLocale(paymentDate, input.locale);
  const methodLabel =
    (paymentMethod && billingCopy.paymentMethods[paymentMethod]) || paymentMethod;
  const body = localizedReceiptBody(input.locale, {
    amountLabel: money,
    whenLabel: when,
    jobTitle,
    paymentMethod: methodLabel,
    paymentReference
  });

  // Duplicate receipt check
  let existingReceipt: { id: string; status: string | null } | null = null;
  if (resolvedPaymentId || resolvedInvoiceId) {
    const { data: receipts } = await ctx.supabase
      .from('outbound_documents')
      .select('id, status, metadata, source_entity_id, created_at')
      .eq('organization_id', ctx.organizationId)
      .eq('doc_type', 'receipt')
      .order('created_at', { ascending: false })
      .limit(20);

    existingReceipt =
      (receipts || []).find((doc) => {
        const meta = (doc.metadata || {}) as Record<string, unknown>;
        if (resolvedPaymentId && meta.payment_id === resolvedPaymentId) return true;
        if (resolvedInvoiceId && (meta.invoice_id === resolvedInvoiceId || doc.source_entity_id === resolvedInvoiceId)) {
          return Boolean(resolvedPaymentId) ? meta.payment_id === resolvedPaymentId : !meta.payment_id;
        }
        return false;
      }) || null;
  }

  return NextResponse.json({
    prefill: {
      job_id: jobId || null,
      customer_id: customerId || null,
      recipient_name: recipientName,
      recipient_email: recipientEmail,
      amount: amountPaid > 0 ? amountPaid : null,
      job_title: jobTitle,
      subject: localizedReceiptSubject(input.locale),
      body,
      invoice_id: invoiceRow ? String(invoiceRow.id) : resolvedInvoiceId || null,
      invoice_number: invoiceNumber,
      payment_id: resolvedPaymentId || null,
      payment_date: paymentDate,
      payment_method: paymentMethod,
      payment_reference: paymentReference,
      amount_missing: !(amountPaid > 0)
    },
    existing_receipt: existingReceipt
      ? { id: existingReceipt.id, status: existingReceipt.status }
      : null
  });
}
