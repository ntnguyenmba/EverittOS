'use client';

import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from '@/components/locale-provider';
import { getPortalMessagesCopy } from '@/lib/i18n/services-portal-copy';

type Message = { id:string; sender_type:string; body:string; created_at:string|null };
type PortalMessagesPanelProps = { jobId:string; canReply?:boolean };

export function PortalMessagesPanel({ jobId, canReply = true }: PortalMessagesPanelProps) {
  const { locale } = useTranslation();
  const c = getPortalMessagesCopy(locale);
  const [messages, setMessages] = useState<Message[]>([]);
  const [body, setBody] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch(`/api/portal-messages?jobId=${encodeURIComponent(jobId)}`);
    const json = await res.json();
    setLoading(false);
    if (res.ok) setMessages(json.messages || []);
  }, [jobId]);

  useEffect(() => { void load(); }, [load]);

  async function sendMessage() {
    if (!body.trim() || busy) return;
    setBusy(true);
    const res = await fetch('/api/portal-messages', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ jobId, message:body.trim() }) });
    setBusy(false);
    if (res.ok) { setBody(''); void load(); }
  }

  return <div className="card settings-card" style={{ marginTop: 16 }}>
    <h3>{c.title}</h3>
    {loading ? <p className="loading-state">{c.loading}</p> : null}
    {messages.map(message => <div key={message.id} className="list-row">
      <strong>{message.sender_type === 'client' ? c.client : c.business}</strong>
      <p>{message.body}</p>
      <p className="muted">{message.created_at ? new Date(message.created_at).toLocaleString(locale) : ''}</p>
    </div>)}
    {canReply ? <div style={{ marginTop: 12 }}>
      <textarea className="input" rows={3} value={body} onChange={e => setBody(e.target.value)} placeholder={c.writeMessage} />
      <button type="button" className="btn btn-primary" onClick={() => void sendMessage()} disabled={busy}>{c.sendMessage}</button>
    </div> : null}
  </div>;
}
