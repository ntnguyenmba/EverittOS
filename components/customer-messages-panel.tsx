'use client';

import { useCallback, useEffect, useState } from 'react';
import { useAppFeedback } from '@/components/feedback/use-app-feedback';

type ThreadMessage = {
  id: string;
  body: string;
  status: string;
  direction: string;
  recipient_email: string | null;
  sent_at: string | null;
  created_at: string;
  failure_reason?: string | null;
};

type MessageThread = {
  id: string;
  subject: string | null;
  status: string;
  last_message_at: string | null;
  customer_messages?: ThreadMessage[];
};

const EMPTY_COMPOSE = {
  recipient_email: '',
  subject: '',
  message: ''
};

export function CustomerMessagesPanel({ canManage }: { canManage: boolean }) {
  const appFeedback = useAppFeedback();
  const [threads, setThreads] = useState<MessageThread[]>([]);
  const [loading, setLoading] = useState(true);
  const [schemaReady, setSchemaReady] = useState(true);
  const [selectedId, setSelectedId] = useState('');
  const [threadDetail, setThreadDetail] = useState<{ thread: MessageThread; messages: ThreadMessage[] } | null>(null);
  const [compose, setCompose] = useState(EMPTY_COMPOSE);
  const [reply, setReply] = useState('');
  const [sending, setSending] = useState(false);

  const loadThreads = useCallback(async () => {
    setLoading(true);
    const res = await fetch('/api/customer-messages');
    const json = await res.json();
    setLoading(false);
    if (!res.ok) {
      appFeedback.error(json.error || 'Unable to load messages.');
      return;
    }
    if (json.schemaReady === false) {
      setSchemaReady(false);
      setThreads([]);
      return;
    }
    setSchemaReady(true);
    setThreads(json.threads || []);
  }, [appFeedback]);

  const loadThread = useCallback(async (threadId: string) => {
    const res = await fetch(`/api/customer-messages/${threadId}`);
    const json = await res.json();
    if (!res.ok) {
      appFeedback.error(json.error || 'Unable to load thread.');
      return;
    }
    setThreadDetail({ thread: json.thread, messages: json.messages || [] });
  }, [appFeedback]);

  useEffect(() => {
    void loadThreads();
  }, [loadThreads]);

  useEffect(() => {
    if (selectedId) void loadThread(selectedId);
    else setThreadDetail(null);
  }, [selectedId, loadThread]);

  async function sendNewMessage() {
    if (!canManage) return;
    setSending(true);
    const res = await fetch('/api/customer-messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(compose)
    });
    const json = await res.json();
    setSending(false);
    if (!res.ok) {
      appFeedback.error(json.error || 'Unable to send message.');
      return;
    }
    if (!json.emailSent) {
      appFeedback.error(json.deliveryNote || 'Email failed. Message saved with failed status.');
    } else {
      appFeedback.sent();
    }
    setCompose(EMPTY_COMPOSE);
    void loadThreads();
    if (json.thread?.id) setSelectedId(json.thread.id);
  }

  async function sendReply() {
    if (!canManage || !selectedId) return;
    setSending(true);
    const res = await fetch(`/api/customer-messages/${selectedId}/reply`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: reply })
    });
    const json = await res.json();
    setSending(false);
    if (!res.ok) {
      appFeedback.error(json.error || 'Unable to send reply.');
      return;
    }
    if (!json.emailSent) {
      appFeedback.error(json.deliveryNote || 'Email failed. Reply saved with failed status.');
    } else {
      appFeedback.sent();
    }
    setReply('');
    void loadThread(selectedId);
    void loadThreads();
  }

  if (!schemaReady) {
    return (
      <div className="card" role="status">
        <p className="muted">Customer messaging tables are not set up yet. Run the latest Supabase migrations, then refresh.</p>
      </div>
    );
  }

  return (
    <div className="card">
      {canManage ? (
        <div style={{ marginBottom: 16 }}>
          <h2>Compose message</h2>
          <input className="input" placeholder="Recipient email" value={compose.recipient_email} onChange={(e) => setCompose({ ...compose, recipient_email: e.target.value })} />
          <input className="input" placeholder="Subject" value={compose.subject} onChange={(e) => setCompose({ ...compose, subject: e.target.value })} style={{ marginTop: 8 }} />
          <textarea className="input" placeholder="Message" value={compose.message} onChange={(e) => setCompose({ ...compose, message: e.target.value })} style={{ marginTop: 8, minHeight: 100 }} />
          <button type="button" className="btn btn-primary" style={{ marginTop: 8 }} disabled={sending} onClick={() => void sendNewMessage()}>
            {sending ? 'Sending…' : 'Send email'}
          </button>
        </div>
      ) : null}

      <h2>Threads</h2>
      {loading ? <p className="muted">Loading threads…</p> : null}
      {!loading && threads.length === 0 ? <p className="muted">No customer message threads yet.</p> : null}
      {!loading && threads.length > 0 ? (
        <table className="table">
          <thead>
            <tr>
              <th>Subject</th>
              <th>Status</th>
              <th>Last message</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {threads.map((thread) => (
              <tr key={thread.id}>
                <td>{thread.subject || 'No subject'}</td>
                <td>{thread.status}</td>
                <td>{thread.last_message_at ? new Date(thread.last_message_at).toLocaleString() : '—'}</td>
                <td>
                  <button type="button" className="btn btn-sm" onClick={() => setSelectedId(thread.id)}>
                    Open
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : null}

      {threadDetail ? (
        <div style={{ marginTop: 16 }}>
          <h3>{threadDetail.thread.subject || 'Thread'}</h3>
          {threadDetail.messages.map((message) => (
            <div key={message.id} style={{ marginBottom: 12 }}>
              <p className="muted">
                {message.direction} · {message.status}
                {message.sent_at ? ` · ${new Date(message.sent_at).toLocaleString()}` : ''}
              </p>
              <p>{message.body}</p>
              {message.failure_reason ? <p className="auth-message auth-message-error">{message.failure_reason}</p> : null}
            </div>
          ))}
          {canManage ? (
            <>
              <textarea className="input" placeholder="Reply" value={reply} onChange={(e) => setReply(e.target.value)} style={{ minHeight: 80 }} />
              <button type="button" className="btn btn-primary" style={{ marginTop: 8 }} disabled={sending} onClick={() => void sendReply()}>
                {sending ? 'Sending…' : 'Send reply'}
              </button>
            </>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
