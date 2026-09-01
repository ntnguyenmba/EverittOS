'use client';

import { useState } from 'react';
import { useTranslation } from '@/components/locale-provider';

const copy = {
  en: { title: 'Send message', help: 'Send a message to the company.', message: 'Message', send: 'Send message', sending: 'Sending...', cancel: 'Cancel', sent: 'Sent.', unable: 'Unable to send.' },
  es: { title: 'Enviar mensaje', help: 'Envía un mensaje a la empresa.', message: 'Mensaje', send: 'Enviar mensaje', sending: 'Enviando...', cancel: 'Cancelar', sent: 'Enviado.', unable: 'No se pudo enviar.' },
  vi: { title: 'Gửi tin nhắn', help: 'Gửi tin nhắn cho công ty.', message: 'Tin nhắn', send: 'Gửi tin nhắn', sending: 'Đang gửi...', cancel: 'Hủy', sent: 'Đã gửi.', unable: 'Không thể gửi.' }
} as const;

export function ClientSendMessage({ jobId }: { jobId: string }) {
  const { locale } = useTranslation();
  const c = copy[locale];
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [status, setStatus] = useState('');

  async function send() {
    const text = message.trim();
    if (sending || text.length < 2) return;
    setSending(true);
    setStatus('');
    try {
      const response = await fetch(`/api/portal/client/jobs/${encodeURIComponent(jobId)}/message`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text })
      });
      const payload = (await response.json().catch(() => ({}))) as { error?: string; message?: string };
      if (!response.ok) throw new Error(payload.error || payload.message || c.unable);
      setMessage('');
      setStatus(payload.message || c.sent);
      setOpen(false);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : c.unable);
    } finally {
      setSending(false);
    }
  }

  return (
    <section className="card" style={{ marginTop: 16 }}>
      <h3>{c.title}</h3>
      <p className="muted">{c.help}</p>
      {!open ? (
        <button type="button" className="btn" onClick={() => setOpen(true)}>{c.send}</button>
      ) : (
        <div className="form">
          <label>
            {c.message}
            <textarea className="input" rows={4} value={message} maxLength={2000} onChange={(event) => setMessage(event.target.value)} />
          </label>
          <div className="button-row" style={{ flexWrap: 'wrap' }}>
            <button type="button" className="btn btn-primary" disabled={sending || message.trim().length < 2} onClick={() => void send()}>{sending ? c.sending : c.send}</button>
            <button type="button" className="btn" disabled={sending} onClick={() => setOpen(false)}>{c.cancel}</button>
          </div>
        </div>
      )}
      {status ? <p className="muted" role="status">{status}</p> : null}
    </section>
  );
}
