import { logActivityServer } from '@/lib/activity-server';
import { sendTransactionalEmail, transactionalEmailConfigured } from '@/lib/email-provider';
import type { OutboundDocType, OutboundDocument } from '@/lib/outbound/types';
import { syncOutboundEntityOnSend } from '@/lib/outbound/sync-on-send';
import type { SupabaseClient } from '@supabase/supabase-js';

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

function emailHtml(doc: OutboundDocument): string {
  const body = (doc.body || '').replace(/\n/g, '<br />');
  const amount =
    doc.amount != null && doc.doc_type !== 'review'
      ? `<p><strong>Amount:</strong> $${Number(doc.amount).toFixed(2)}</p>`
      : '';
  return `<div style="font-family:Inter,system-ui,sans-serif;line-height:1.6;color:#25364A">
    <p>${body}</p>
    ${amount}
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
  const textBody = document.body?.trim() || '';
  const now = new Date().toISOString();

  let emailSent = false;
  let failureReason: string | null = null;
  let externalId: string | undefined;
  let deliveryProvider: string | undefined;

  if (transactionalEmailConfigured()) {
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

  const status = emailSent || !transactionalEmailConfigured() ? 'sent' : 'failed';
  const deliveryNote = !transactionalEmailConfigured()
    ? 'Saved to sent history. Connect Resend in settings to deliver by email automatically.'
    : undefined;

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
    throw new Error(error?.message || 'Unable to update document after send');
  }

  await supabase.from('outbound_sent_history').insert({
    document_id: document.id,
    organization_id: organizationId,
    event_type: status === 'sent' ? 'sent' : 'failed',
    recipient_email: recipient,
    subject,
    body_snapshot: textBody,
    delivery_provider: deliveryProvider || (transactionalEmailConfigured() ? 'resend' : 'manual'),
    external_message_id: externalId || null,
    error_message: failureReason,
    created_by: userId
  });

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
