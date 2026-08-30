'use client';

import { useState } from 'react';
import { useAppFeedback } from '@/components/feedback/use-app-feedback';

type Template = { label: string; subject: string; body: string };

type Props = {
  buttonLabel: string;
  recipientEmail: string;
  recipientName?: string | null;
  jobId: string;
  customerId?: string | null;
  docType: 'message' | 'review';
  defaultSubject: string;
  defaultBody: string;
  templates?: Template[];
  metadata?: Record<string, unknown>;
  disabled?: boolean;
};

export function JobEmailComposer({
  buttonLabel,
  recipientEmail,
  recipientName = null,
  jobId,
  customerId = null,
  docType,
  defaultSubject,
  defaultBody,
  templates = [],
  metadata = {},
  disabled = false
}: Props) {
  const feedback = useAppFeedback();
  const [open, setOpen] = useState(false);
  const [subject, setSubject] = useState(defaultSubject);
  const [body, setBody] = useState(defaultBody);
  const [sending, setSending] = useState(false);

  function applyTemplate(index: number) {
    const template = templates[index];
    if (!template) return;
    setSubject(template.subject);
    setBody(template.body);
  }

  async function send() {
    if (sending || !recipientEmail.trim() || !subject.trim() || !body.trim()) return;
    setSending(true);
    try {
      const createRes = await fetch('/api/outbound', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          doc_type: docType,
          recipient_email: recipientEmail.trim(),
          recipient_name: recipientName?.trim() || null,
          subject: subject.trim(),
          body: body.trim(),
          customer_id: customerId || null,
          job_id: jobId,
          status: 'draft',
          force_new: true,
          metadata: { ...metadata, source: 'job_email_action' }
        })
      });
      const created = (await createRes.json().catch(() => ({}))) as { document?: { id?: string }; error?: string };
      if (!createRes.ok || !created.document?.id) throw new Error(created.error || 'Unable to create email.');

      const sendRes = await fetch(`/api/outbound/${created.document.id}/send`, { method: 'POST' });
      const sent = (await sendRes.json().catch(() => ({}))) as { error?: string; message?: string; emailSent?: boolean };
      if (!sendRes.ok || !sent.emailSent) throw new Error(sent.error || sent.message || 'Email could not be sent.');

      feedback.success(sent.message || 'Email sent.');
      setOpen(false);
    } catch (error) {
      feedback.error(error instanceof Error ? error.message : 'Email could not be sent.');
    } finally {
      setSending(false);
    }
  }

  if (!open) {
    return <button type="button" className="btn" disabled={disabled || !recipientEmail.trim()} onClick={() => setOpen(true)}>{buttonLabel}</button>;
  }

  return (
    <div className="card" style={{ marginTop: 12, width: '100%' }}>
      <div className="form">
        <p className="muted" style={{ margin: 0 }}><strong>To:</strong> {recipientEmail}</p>
        {templates.length ? (
          <label>
            Template
            <select className="input" defaultValue="" onChange={(event) => { if (event.target.value) applyTemplate(Number(event.target.value)); }}>
              <option value="">Choose a template</option>
              {templates.map((template, index) => <option key={template.label} value={index}>{template.label}</option>)}
            </select>
          </label>
        ) : null}
        <label>Subject<input className="input" value={subject} onChange={(event) => setSubject(event.target.value)} /></label>
        <label>Message<textarea className="input" rows={5} value={body} onChange={(event) => setBody(event.target.value)} /></label>
        <div className="button-row" style={{ flexWrap: 'wrap' }}>
          <button type="button" className="btn btn-primary" disabled={sending || !subject.trim() || !body.trim()} onClick={() => void send()}>{sending ? 'Sending...' : 'Send email'}</button>
          <button type="button" className="btn" disabled={sending} onClick={() => setOpen(false)}>Cancel</button>
        </div>
      </div>
    </div>
  );
}
