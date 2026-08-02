import type { SupabaseClient } from '@supabase/supabase-js';
import { sendOutboundDocument } from '@/lib/outbound/send-document';
import type { OutboundDocument } from '@/lib/outbound/types';

function formatMoney(value: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD'
  }).format(value);
}

function formatDate(value: string | null | undefined): string {
  const parsed = value ? new Date(value) : new Date();
  return Number.isNaN(parsed.getTime())
    ? String(value || '')
    : parsed.toLocaleDateString('en-US', {
        month: 'long',
        day: 'numeric',
        year: 'numeric'
      });
}

export type AutoSendPaymentReceiptResult = {
  receipt: OutboundDocument | null;
  emailSent: boolean;
  deliveryNote?: string;
};

export async function autoSendPaymentReceipt(input: {
  supabase: SupabaseClient;
  organizationId: string;
  userId: string;
  invoiceDocument: Record<string, unknown> | null;
  invoiceId: string | null;
  paymentId: string | null;
  paymentAmount: number;
  paidDate?: string | null;
  paymentMethod?: string | null;
  paymentReference?: string | null;
}): Promise<AutoSendPaymentReceiptResult> {
  const {
    supabase,
    organizationId,
    userId,
    invoiceDocument,
    invoiceId,
    paymentId,
    paymentAmount,
    paidDate,
    paymentMethod,
    paymentReference
  } = input;

  if (!invoiceDocument || paymentAmount <= 0) {
    return { receipt: null, emailSent: false };
  }

  const recipientEmail = String(invoiceDocument.recipient_email || '').trim();
  if (!recipientEmail) {
    return {
      receipt: null,
      emailSent: false,
      deliveryNote: 'Payment was recorded, but the client has no email address for the receipt.'
    };
  }

  const { data: existingReceipts } = await supabase
    .from('outbound_documents')
    .select('*')
    .eq('organization_id', organizationId)
    .eq('doc_type', 'receipt')
    .order('created_at', { ascending: false })
    .limit(50);

  const existing = (existingReceipts || []).find((document) => {
    const metadata = (document.metadata || {}) as Record<string, unknown>;
    return paymentId && metadata.payment_id === paymentId;
  }) as OutboundDocument | undefined;

  if (existing) {
    if (existing.status === 'sent') {
      return { receipt: existing, emailSent: true };
    }
    const sent = await sendOutboundDocument({
      supabase,
      organizationId,
      userId,
      document: existing
    });
    return {
      receipt: sent.document,
      emailSent: sent.emailSent,
      deliveryNote: sent.deliveryNote
    };
  }

  const amount = Math.max(0, Number(paymentAmount || 0));
  const paymentDate = paidDate || new Date().toISOString();
  let body = `Thank you. We received your payment of ${formatMoney(amount)} on ${formatDate(paymentDate)}.`;
  if (paymentMethod?.trim()) body += `\nPayment method: ${paymentMethod.trim()}`;
  if (paymentReference?.trim()) body += `\nReference: ${paymentReference.trim()}`;

  const { data: created, error } = await supabase
    .from('outbound_documents')
    .insert({
      organization_id: organizationId,
      doc_type: 'receipt',
      status: 'draft',
      recipient_name: invoiceDocument.recipient_name || null,
      recipient_email: recipientEmail,
      subject: 'Payment receipt',
      body,
      amount,
      customer_id: invoiceDocument.customer_id || null,
      job_id: invoiceDocument.job_id || null,
      source_entity_type: 'invoice_receipt',
      source_entity_id: invoiceId || invoiceDocument.source_entity_id || invoiceDocument.id,
      metadata: {
        receipt: true,
        invoice_id: invoiceId || invoiceDocument.source_entity_id || null,
        invoice_document_id: invoiceDocument.id,
        payment_id: paymentId,
        payment_date: paymentDate,
        payment_method: paymentMethod?.trim() || null,
        payment_reference: paymentReference?.trim() || null,
        payment_amount: amount,
        automatic: true
      },
      created_by: userId
    })
    .select('*')
    .single();

  if (error || !created) {
    return {
      receipt: null,
      emailSent: false,
      deliveryNote: error?.message || 'Payment was recorded, but the receipt could not be created.'
    };
  }

  const sent = await sendOutboundDocument({
    supabase,
    organizationId,
    userId,
    document: created as OutboundDocument
  });

  return {
    receipt: sent.document,
    emailSent: sent.emailSent,
    deliveryNote: sent.deliveryNote
  };
}
