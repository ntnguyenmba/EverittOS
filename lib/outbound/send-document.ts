import { logActivityServer } from '@/lib/activity-server';
import { sendTransactionalEmail, transactionalEmailConfigured } from '@/lib/email-provider';
import type { OutboundDocType, OutboundDocument } from '@/lib/outbound/types';
import { syncOutboundEntityOnSend } from '@/lib/outbound/sync-on-send';
import { isMissingSchemaError } from '@/lib/supabase-schema-errors';
import type { SupabaseClient } from '@supabase/supabase-js';

type InvoicePaymentPreference = { method: string; link: string; instructions: string };
export type SendOutboundResult = { document: OutboundDocument; emailSent: boolean; deliveryNote?: string };

function escapeHtml(value: string): string { return value.replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char] || char); }
function safeWebUrl(value: string): string { try { const url = new URL(value); return ['https:', 'http:'].includes(url.protocol) ? url.toString() : ''; } catch { return ''; } }
function safeHttpsUrl(value: string): string { try { const url = new URL(value); return url.protocol === 'https:' ? url.toString() : ''; } catch { return ''; } }
function paymentMethodLabel(method: string): string { const labels: Record<string, string> = { stripe: 'Stripe', square: 'Square', paypal: 'PayPal', venmo: 'Venmo', zelle: 'Zelle', cash_app: 'Cash App', custom: 'online' }; return labels[method] || 'online'; }
function defaultSubject(docType: OutboundDocType, subject: string | null): string { if (subject?.trim()) return subject.trim(); const fallbacks: Record<OutboundDocType, string> = { review: 'We would love your feedback', proposal: 'Your proposal', estimate: 'Your estimate', invoice: 'Your invoice', message: 'Message from your service team', receipt: 'Payment receipt' }; return fallbacks[docType]; }
function moneyLabel(amount: number | null): string { if (amount == null || !Number.isFinite(Number(amount))) return ''; return Number(amount).toLocaleString(undefined, { style: 'currency', currency: 'USD' }); }
function metadataString(doc: OutboundDocument, key: string): string { const metadata = (doc.metadata || {}) as Record<string, unknown>; return typeof metadata[key] === 'string' ? String(metadata[key]).trim() : ''; }

function invoiceText(doc: OutboundDocument, body: string, payment: InvoicePaymentPreference): string {
  const amount = moneyLabel(doc.amount); const lines = [body || 'Thank you for your business. Please find your invoice details below.'];
  if (amount) lines.push(`Amount due: ${amount}`); if (payment.link) lines.push(`Pay ${amount || 'invoice'}: ${payment.link}`); if (payment.instructions) lines.push(payment.instructions); lines.push('Please reply to this email if you have any questions.'); return lines.filter(Boolean).join('\n\n');
}

function emailHtml(doc: OutboundDocument, payment: InvoicePaymentPreference): string {
  const body = escapeHtml(doc.body || '').replace(/\n/g, '<br />');
  const amount = doc.amount != null && doc.doc_type !== 'review' ? moneyLabel(doc.amount) : '';
  const payButton = doc.doc_type === 'invoice' && payment.link ? `<p style="margin:16px 0 0"><a href="${escapeHtml(payment.link)}" style="display:inline-block;background:#25364A;color:#ffffff;text-decoration:none;border-radius:10px;padding:13px 20px;font-weight:700">Pay ${escapeHtml(amount || 'invoice')}</a></p><p style="margin:8px 0 0;color:#667085;font-size:13px">Pay securely with ${escapeHtml(paymentMethodLabel(payment.method))}.</p>` : '';
  const instructions = doc.doc_type === 'invoice' && payment.instructions ? `<div style="margin:14px 0 0;padding:14px 16px;border-left:2px solid #A7ADA6;color:#46504B"><strong>Payment instructions</strong><br />${escapeHtml(payment.instructions).replace(/\n/g, '<br />')}</div>` : '';
  const invoiceBlock = doc.doc_type === 'invoice' && amount ? `<div style="margin:18px 0;padding:18px;border:1px solid #D9DED7;border-radius:14px;background:#F7F7F4"><p style="margin:0 0 6px;color:#66705F;font-size:13px;text-transform:uppercase;letter-spacing:.08em">Amount due</p><p style="margin:0;color:#24302B;font-size:28px;font-weight:800">${escapeHtml(amount)}</p>${payButton}${instructions}</div>` : '';
  const amountLine = amount && doc.doc_type !== 'invoice' ? `<p><strong>Amount:</strong> ${escapeHtml(amount)}</p>` : '';
  const reviewUrl = doc.doc_type === 'review' ? safeWebUrl(metadataString(doc, 'review_url')) : '';
  const reviewButton = reviewUrl ? `<p style="margin:18px 0"><a href="${escapeHtml(reviewUrl)}" style="display:inline-block;background:#25364A;color:#ffffff;text-decoration:none;border-radius:999px;padding:12px 20px;font-weight:700">Leave a review</a></p>` : '';
  const replyNote = doc.doc_type === 'invoice' ? '<p>Please reply to this email if you have any questions.</p>' : '';
  return `<div style="font-family:Inter,system-ui,sans-serif;line-height:1.6;color:#25364A;max-width:640px"><p>${body}</p>${invoiceBlock}${reviewButton}${amountLine}${replyNote}</div>`;
}

export async function sendOutboundDocument(input: { supabase: SupabaseClient; organizationId: string; userId: string; document: OutboundDocument }): Promise<SendOutboundResult> {
  const { supabase, organizationId, userId, document } = input; const recipient = document.recipient_email?.trim(); if (!recipient) throw new Error('Recipient email is required before sending.');
  const payment: InvoicePaymentPreference = { method: '', link: '', instructions: '' };
  if (document.doc_type === 'invoice') { const { data: settings, error: settingsError } = await supabase.from('organization_settings').select('preferred_payment_method,payment_link,payment_instructions').eq('organization_id', organizationId).maybeSingle(); if (settingsError && !isMissingSchemaError(settingsError)) console.warn('Invoice payment settings lookup failed:', settingsError.message); payment.method = String(settings?.preferred_payment_method || ''); payment.link = safeHttpsUrl(String(settings?.payment_link || '')); payment.instructions = String(settings?.payment_instructions || '').trim(); }
  if (document.doc_type === 'review' && !safeWebUrl(metadataString(document, 'review_url'))) throw new Error('Add a valid Review URL in Settings before sending.');
  const subject = defaultSubject(document.doc_type, document.subject); const body = document.body?.trim() || ''; const textBody = document.doc_type === 'invoice' ? invoiceText(document, body, payment) : body; const now = new Date().toISOString(); let emailSent = false; let failureReason: string | null = null; let externalId: string | undefined; let deliveryProvider: string | undefined;
  if (!transactionalEmailConfigured()) { failureReason = 'Email is not configured. Add RESEND_API_KEY and EMAIL_FROM in Vercel, then verify the sending domain in Resend.'; deliveryProvider = 'none'; }
  else { const result = await sendTransactionalEmail({ to: recipient, subject, html: emailHtml(document, payment), text: textBody }); emailSent = result.sent; deliveryProvider = result.provider; externalId = result.id; if (!result.sent) failureReason = result.error || 'Email delivery failed'; }
  const status = emailSent ? 'sent' : 'failed'; const deliveryNote = emailSent ? undefined : failureReason || 'Email delivery failed. Check the outbound send history for details.';
  const { data: updated, error } = await supabase.from('outbound_documents').update({ status, subject, sent_at: status === 'sent' ? now : null, failed_at: status === 'failed' ? now : null, failure_reason: failureReason, updated_at: now }).eq('id', document.id).eq('organization_id', organizationId).select('*').single();
  if (error || !updated) { if (isMissingSchemaError(error)) throw new Error('Outbound tables are not set up yet. Run supabase/manual_schema_repair.sql in the Supabase SQL Editor.'); throw new Error(error?.message || 'Unable to update document after send'); }
  const historyResult = await supabase.from('outbound_sent_history').insert({ document_id: document.id, organization_id: organizationId, event_type: status === 'sent' ? 'sent' : 'failed', recipient_email: recipient, subject, body_snapshot: textBody, delivery_provider: deliveryProvider || 'resend', external_message_id: externalId || null, error_message: failureReason, created_by: userId }); if (historyResult.error && !isMissingSchemaError(historyResult.error)) console.warn('outbound_sent_history insert failed:', historyResult.error.message);
  if (status === 'sent') await syncOutboundEntityOnSend({ supabase, organizationId, userId, document: updated as OutboundDocument });
  const actionByType: Record<OutboundDocType, string> = { review: 'review_request_created', proposal: 'proposal_sent', estimate: 'estimate_sent', invoice: 'invoice_created', message: 'message_sent', receipt: 'receipt_sent' };
  await logActivityServer({ organizationId, userId, entityType: 'outbound_document', entityId: document.id, action: actionByType[document.doc_type], message: status === 'sent' ? `${document.doc_type} sent to ${recipient}` : `Failed to send ${document.doc_type} to ${recipient}`, metadata: { doc_type: document.doc_type, job_id: document.job_id, email_sent: emailSent, delivery_note: deliveryNote } });
  return { document: updated as OutboundDocument, emailSent, deliveryNote };
}
