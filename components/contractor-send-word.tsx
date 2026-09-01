'use client';

import { useState } from 'react';

const TEMPLATES = [
  { label: 'On my way', text: 'I am on my way to the job now.' },
  { label: 'Running late', text: 'I am running a little late and will update you when I arrive.' },
  { label: 'Job done', text: 'The job is finished. Thank you.' }
];

export function ContractorSendWord({ jobId }: { jobId: string }) {
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState(TEMPLATES[0].text);
  const [sending, setSending] = useState(false);
  const [status, setStatus] = useState('');

  async function send() {
    if (sending || !message.trim()) return;
    setSending(true); setStatus('');
    try {
      const res = await fetch(`/api/portal/contractor/jobs/${encodeURIComponent(jobId)}/send-word`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ to: 'owner', message })
      });
      const json = (await res.json().catch(() => ({}))) as { error?: string; message?: string };
      if (!res.ok) throw new Error(json.error || json.message || 'Unable to send.');
      setStatus(json.message || 'Sent.');
      setOpen(false);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Unable to send.');
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="contractor-job-block">
      <strong>Send update</strong>
      <p className="muted">Send a job update.</p>
      {!open ? <button type="button" className="btn" onClick={() => setOpen(true)}>Send update</button> : (
        <div className="form">
          <div className="button-row" style={{ flexWrap: 'wrap' }}>
            {TEMPLATES.map((template) => (
              <button key={template.label} type="button" className="btn" disabled={sending} onClick={() => setMessage(template.text)}>{template.label}</button>
            ))}
          </div>
          <label>Message<textarea className="input" rows={4} value={message} maxLength={2000} onChange={(event) => setMessage(event.target.value)} /></label>
          <div className="button-row" style={{ flexWrap: 'wrap' }}>
            <button type="button" className="btn btn-primary" disabled={sending || !message.trim()} onClick={() => void send()}>{sending ? 'Sending...' : 'Send update'}</button>
            <button type="button" className="btn" disabled={sending} onClick={() => setOpen(false)}>Cancel</button>
          </div>
        </div>
      )}
      {status ? <p className="muted" role="status">{status}</p> : null}
    </div>
  );
}
