import type { SupabaseClient } from '@supabase/supabase-js';
import { CUSTOMER_ADDRESS_FIELDS } from '@/lib/customer-record';
import { sendTransactionalEmail, transactionalEmailConfigured } from '@/lib/email-provider';
import { fetchJobPaymentHistory } from '@/lib/finance/job-payments';
import { fetchJobProfitability } from '@/lib/finance-server';
import { buildPaymentReceiptView } from '@/lib/payment-receipt';
import { createSimplePdf } from '@/lib/simple-pdf';

export type SendJobPaymentReceiptResult = {
  sent: boolean;
  recipientEmail?: string;
  error?: string;
};

export async function sendJobPaymentReceipt(input: {
  supabase: SupabaseClient;
  organizationId: string;
  jobId: string;
  source: 'job' | 'invoice';
  paymentId: string;
}): Promise<SendJobPaymentReceiptResult> {
  const { supabase, organizationId, jobId, source, paymentId } = input;
  const customerSelect = `id, company_name, email, phone, ${CUSTOMER_ADDRESS_FIELDS}`;

  const [{ data: job }, history, profitability, orgRes, settingsRes] = await Promise.all([
    supabase
      .from('jobs')
      .select(`id, title, address, customer_name, phone, customer_id, customers(${customerSelect})`)
      .eq('id', jobId)
      .eq('organization_id', organizationId)
      .maybeSingle(),
    fetchJobPaymentHistory(supabase, organizationId, jobId),
    fetchJobProfitability(supabase, organizationId, jobId),
    supabase.from('organizations').select('name').eq('id', organizationId).maybeSingle(),
    supabase
      .from('organization_settings')
      .select('company_phone, company_email, company_address, website')
      .eq('organization_id', organizationId)
      .maybeSingle()
  ]);

  if (!job) return { sent: false, error: 'Job not found.' };

  const payment = history.payments.find((entry) => entry.id === paymentId && entry.source === source);
  if (!payment) return { sent: false, error: 'Payment receipt not found.' };

  const customerRelation = job.customers as Record<string, unknown> | Record<string, unknown>[] | null;
  const linkedCustomer = Array.isArray(customerRelation) ? customerRelation[0] : customerRelation;
  const recipientEmail = String(linkedCustomer?.email || '').trim();

  if (!recipientEmail) {
    return { sent: false, error: 'Payment was saved, but the customer has no email address.' };
  }

  if (!transactionalEmailConfigured()) {
    return { sent: false, recipientEmail, error: 'Email is not configured in Vercel.' };
  }

  const receipt = buildPaymentReceiptView({
    payment: {
      id: payment.id,
      amount: payment.amount,
      paidAt: payment.paidAt,
      paymentMethod: payment.paymentMethod,
      paymentReference: payment.paymentReference,
      notes: payment.notes,
      source: payment.source
    },
    job: {
      title: job.title,
      customer_name: job.customer_name,
      phone: job.phone,
      address: job.address
    },
    linkedCustomer: linkedCustomer as {
      company_name?: string | null;
      email?: string | null;
      phone?: string | null;
      address_line1?: string | null;
      address_line2?: string | null;
      city?: string | null;
      state?: string | null;
      postal_code?: string | null;
      country?: string | null;
      service_address?: string | null;
      property_address?: string | null;
    } | null,
    business: {
      companyName: orgRes.data?.name || null,
      phone: settingsRes.data?.company_phone || null,
      email: settingsRes.data?.company_email || null,
      website: settingsRes.data?.website || null,
      address: settingsRes.data?.company_address || null
    },
    quotedPrice: profitability.manualRevenue || profitability.invoiceTotal || profitability.expectedAmount || 0,
    outstanding: profitability.outstanding || 0
  });

  const pdf = createSimplePdf([
    ...(receipt.businessName ? [{ text: receipt.businessName, size: 16, bold: true, gapAfter: 2 }] : []),
    ...receipt.businessLines.map((line) => ({ text: line, size: 9 })),
    { text: 'PAYMENT RECEIPT', size: 10, bold: true, gapAfter: 4 },
    { text: receipt.receiptNumber, size: 18, bold: true },
    { text: receipt.paidOnLabel, size: 10, gapAfter: 10 },
    { text: `${receipt.amountPaidLabel}: ${receipt.amountPaidValue}`, size: 16, bold: true, gapAfter: 12 },
    { text: receipt.customerHeading, size: 12, bold: true },
    ...receipt.customerLines.map((line) => ({ text: line, size: 10 })),
    { text: 'Receipt details', size: 12, bold: true, gapAfter: 2 },
    ...receipt.receiptDetails.map((row) => ({ text: `${row.label}: ${row.value}`, size: 10 })),
    ...(receipt.paidInFull ? [{ text: 'Paid in full', size: 10, bold: true, gapAfter: 8 }] : []),
    { text: receipt.thankYou, size: 11, bold: true },
    { text: receipt.keepCopy, size: 9 }
  ]);

  const companyName = receipt.businessName || 'Your service provider';
  const result = await sendTransactionalEmail({
    to: recipientEmail,
    subject: `${companyName} payment receipt ${receipt.receiptNumber}`,
    text: `Thank you for your payment of ${receipt.amountPaidValue}. Your receipt is attached.`,
    html: `<div style="font-family:Inter,system-ui,sans-serif;line-height:1.6;color:#25364A;max-width:640px"><p>Thank you for your payment of <strong>${receipt.amountPaidValue}</strong>.</p><p>Your receipt is attached for your records.</p></div>`,
    attachments: [
      {
        filename: `${receipt.receiptNumber}.pdf`,
        content: Buffer.from(pdf).toString('base64'),
        contentType: 'application/pdf'
      }
    ]
  });

  return result.sent
    ? { sent: true, recipientEmail }
    : { sent: false, recipientEmail, error: result.error || 'Receipt email could not be sent.' };
}
