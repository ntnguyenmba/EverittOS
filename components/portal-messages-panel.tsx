'use client';

import { useCallback, useEffect, useState } from 'react';

type Message = {
  id: string;
  sender_type: string;
  body: string;
  created_at: string | null;
};

type PortalMessagesPanelProps = {
  jobId: string;
  canReply?: boolean;
};

export function PortalMessagesPanel({ jobId, canReply = true }: PortalMessagesPanelProps) {
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

  useEffect(() => {
    void load();
  }, [load]);

  async function sendMessage() {
    if (!body.trim() || busy) return;
    setBusy(true);
    const res = await fetch('/api/portal-messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jobId, message: body.trim() })
    });
    setBusy(false);
    if (res.ok) {
      setBody('');
      void load();
    }
  }

  return (
    <div className="card settings-card" style={{ marginTop: 16 }}>
      <h3>Client messages</h3>
      {loading ? <p className="loading-state">Loading messages…</p> : null}
      {messages.map((message) => (
        <div key={message.id} className="list-row">
          <strong>{message.sender_type === 'client' ? 'Client' : 'Business'}</strong>
          <p>{message.body}</p>
          <p className="muted">{message.created_at ? new Date(message.created_at).toLocaleString() : ''}</p>
        </div>
      ))}
      {canReply ? (
        <div style={{ marginTop: 12 }}>
          <textarea className="input" rows={3} value={body} onChange={(e) => setBody(e.target.value)} placeholder="Write a message" />
          <button type="button" className="btn btn-primary" onClick={() => void sendMessage()} disabled={busy}>
            Send message
          </button>
        </div>
      ) : null}
    </div>
  );
}
