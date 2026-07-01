import { logActivityServer } from '@/lib/activity-server';
import { sendTransactionalEmail, transactionalEmailConfigured } from '@/lib/email-provider';
import type { OutboundDocType, OutboundDocument } from '@/lib/outbound/types';
import { syncOutboundEntityOnSend } from '@/lib/outbound/sync-on-send';
import { isMissingSchemaError } from '@/lib/supabase-schema-errors';
import type { SupabaseClient } from '@supabase/supabase-js';

const FEEDBACK_FORM_URL =
  'https://docs.google.com/forms/d/e/1FAIpQLScKoDhMAuGu8RyvFQE9dBbrazjpGhPxm-C7lAlrdnDurGhDgQ/viewform?usp=header';

export type SendOutboundResult = {
  document: OutboundDocument;
  emailSent: boolean;
  deliveryNote?: string;
};

function defaultSubject(docType: OutboundDocType, subject: string | null): string {
  if (subject?.trim()) return subject.trim();
  const fallbacks: Record<OutboundDocType, string> = {
    review: 'We would love your feedback',
    proposal: 'Your proposal',
    estimate: 'Your estimate',
    invoice: 'Your invoice',
    message: 'Message from your service team'
  };
  return fallbacks[docType];
}

function moneyLabel(amount: number | null): string {
  if (amount == null || !Number.isFinite(Number(amount))) return '';
  return Number(amount).toLocaleString(undefined, { style: 'currency', currency: 'USD' });
}

function invoiceText(doc: OutboundDocument, body: string): string {
  const amount = moneyLabel(doc.amount);
  const lines = [body || 'Thank you for your business. Please find your invoice details below.'];
  if (amount) lines.push(`Amount due: ${amount}`);
  lines.push('Please reply to this email if you have any questions.');
  return lines.filter(Boolean).join('\n\n');
}

function emailHtml(doc: OutboundDocument): string {
  const reviewPlainLink = `\n\nShare Feedback: ${FEEDBACK_FORM_URL}`;
  const plainBody = doc.doc_type === 'review' ? (doc.body || '').replace(reviewPlainLink, '') : doc.body || '';
  const body = plainBody.replace(/\n/g, '<br />');
  const amount = doc.amount != null && doc.doc_type !== 'review' ? moneyLabel(doc.amount) : '';
  const invoiceBlock =
    doc.doc_type === 'invoice' && amount
      ? `<div style="margin:18px 0;padding:18px;border:1px solid #D9DED7;border-radius:14px;background:#F7F7F4"><p style="margin:0 0 6px;color:#66705F;font-size:13px;text-transform:uppercase;letter-spacing:.08em">Amount due</p><p style="margin:0;color:#24302B;font-size:28px;font-weight:800">${amount}</p></div>`
      : '';
  const amountLine = amount && doc.doc_type !== 'invoice' ? `<p><strong>Amount:</strong> ${amount}</p>` : '';
  const feedbackButton =
    doc.doc_type === 'review'
      ? `<p><a href="${FEEDBACK_FORM_URL}" style="display:inline-block;background:#234A84;color:#ffffff;text-decoration:none;border-radius:999px;padding:12px 20px;font-weight:700">Share Feedback</a></p>`
      : '';
  const replyNote = doc.doc_type === 'invoice' ? '<p>Please reply to this email if you have any questions.</p>' : '';
  return `<div style="font-family:Inter,system-ui,sans-serif;line-height:1.6;color:#25364A;max-width:640px">
    <p>${body}</p>
    ${invoiceBlock}
    ${feedbackButton}
    ${amountLine}
    ${replyNote}
  </div>`;
}

export async function sendOutboundDocument(input: {
  supabase: SupabaseClient;
  organizationId: string;
  userId: string;
  document: OutboundDocument;
}): Promise<SendOutboundResult> {
  const { supabase, organizationId, userId, document } = input;
  const recipient = document.recipient_email?.trim();
  if (!recipient) {
    throw new Error('Recipient email is required before sending.');
  }

  const subject = defaultSubject(document.doc_type, document.subject);
  const body = document.body?.trim() || '';
  const textBody = document.doc_type === 'invoice' ? invoiceText(document, body) : body;
  const now = new Date().toISOString();

  let emailSent = false;
  let failureReason: string | null = null;
  let externalId: string | undefined;
  let deliveryProvider: string | undefined;

  if (!transactionalEmailConfigured()) {
    failureReason = 'Email is not configured. Add RESEND_API_KEY and EMAIL_FROM in Vercel, then verify the sending domain in Resend.';
    deliveryProvider = 'none';
  } else {
    const result = await sendTransactionalEmail({
      to: recipient,
      subject,
      html: emailHtml(document),
      text: textBody
    });
    emailSent = result.sent;
    deliveryProvider = result.provider;
    externalId = result.id;
    if (!result.sent) {
      failureReason = result.error || 'Email delivery failed';
    }
  }

  const status = emailSent ? 'sent' : 'failed';
  const deliveryNote = emailSent
    ? undefined
    : failureReason || 'Email delivery failed. Check the outbound send history for details.';

  const { data: updated, error } = await supabase
    .from('outbound_documents')
    .update({
      status,
      subject,
      sent_at: status === 'sent' ? now : null,
      failed_at: status === 'failed' ? now : null,
      failure_reason: failureReason,
      updated_at: now
    })
    .eq('id', document.id)
    .eq('organization_id', organizationId)
    .select('*')
    .single();

  if (error || !updated) {
    if (isMissingSchemaError(error)) {
      throw new Error(
        'Outbound tables are not set up yet. Run supabase/manual_schema_repair.sql in the Supabase SQL Editor.'
      );
    }
    throw new Error(error?.message || 'Unable to update document after send');
  }

  const historyResult = await supabase.from('outbound_sent_history').insert({
    document_id: document.id,
    organization_id: organizationId,
    event_type: status === 'sent' ? 'sent' : 'failed',
    recipient_email: recipient,
    subject,
    body_snapshot: textBody,
    delivery_provider: deliveryProvider || 'resend',
    external_message_id: externalId || null,
    error_message: failureReason,
    created_by: userId
  });

  if (historyResult.error && !isMissingSchemaError(historyResult.error)) {
    console.warn('outbound_sent_history insert failed:', historyResult.error.message);
  }

  if (status === 'sent') {
    await syncOutboundEntityOnSend({
      supabase,
      organizationId,
      userId,
      document: updated as OutboundDocument
    });
  }

  const actionByType: Record<OutboundDocType, string> = {
    review: 'review_request_created',
    proposal: 'proposal_sent',
    estimate: 'estimate_sent',
    invoice: 'invoice_created',
    message: 'message_sent'
  };

  await logActivityServer({
    organizationId,
    userId,
    entityType: 'outbound_document',
    entityId: document.id,
    action: actionByType[document.doc_type],
    message:
      status === 'sent'
        ? `${document.doc_type} sent to ${recipient}`
        : `Failed to send ${document.doc_type} to ${recipient}`,
    metadata: { doc_type: document.doc_type, email_sent: emailSent, delivery_note: deliveryNote }
  });

  return {
    document: updated as OutboundDocument,
    emailSent,
    deliveryNote
  };
}
