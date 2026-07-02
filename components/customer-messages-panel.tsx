'use client';

import { useCallback, useEffect, useState } from 'react';
import { useAppFeedback } from '@/components/feedback/use-app-feedback';
import { useTranslation } from '@/components/locale-provider';

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
  const { t } = useTranslation();
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
      appFeedback.error(json.error || t('pages.customerMessages.loadError'));
      return;
    }
    if (json.schemaReady === false) {
      setSchemaReady(false);
      setThreads([]);
      return;
    }
    setSchemaReady(true);
    setThreads(json.threads || []);
  }, [appFeedback, t]);

  const loadThread = useCallback(async (threadId: string) => {
    const res = await fetch(`/api/customer-messages/${threadId}`);
    const json = await res.json();
    if (!res.ok) {
      appFeedback.error(json.error || t('pages.customerMessages.threadLoadError'));
      return;
    }
    setThreadDetail({ thread: json.thread, messages: json.messages || [] });
  }, [appFeedback, t]);

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
      appFeedback.error(json.error || t('pages.customerMessages.sendError'));
      return;
    }
    if (!json.emailSent) {
      appFeedback.error(json.deliveryNote || t('pages.customerMessages.emailFailed'));
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
      appFeedback.error(json.error || t('pages.customerMessages.replyError'));
      return;
    }
    if (!json.emailSent) {
      appFeedback.error(json.deliveryNote || t('pages.customerMessages.emailFailed'));
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
        <p className="muted">{t('pages.customerMessages.schemaNotReady')}</p>
      </div>
    );
  }

  return (
    <div className="card">
      {canManage ? (
        <div style={{ marginBottom: 16 }}>
          <h2>{t('pages.customerMessages.composeTitle')}</h2>
          <input className="input" placeholder={t('pages.customerMessages.recipientEmail')} value={compose.recipient_email} onChange={(e) => setCompose({ ...compose, recipient_email: e.target.value })} />
          <input className="input" placeholder={t('pages.customerMessages.subject')} value={compose.subject} onChange={(e) => setCompose({ ...compose, subject: e.target.value })} style={{ marginTop: 8 }} />
          <textarea className="input" placeholder={t('pages.customerMessages.message')} value={compose.message} onChange={(e) => setCompose({ ...compose, message: e.target.value })} style={{ marginTop: 8, minHeight: 100 }} />
          <button type="button" className="btn btn-primary" style={{ marginTop: 8 }} disabled={sending} onClick={() => void sendNewMessage()}>
            {sending ? t('pages.customerMessages.sending') : t('pages.customerMessages.sendEmail')}
          </button>
        </div>
      ) : null}

      <h2>{t('pages.customerMessages.threads')}</h2>
      {loading ? <p className="muted">{t('pages.customerMessages.loadingThreads')}</p> : null}
      {!loading && threads.length === 0 ? <p className="muted">{t('pages.customerMessages.emptyThreads')}</p> : null}
      {!loading && threads.length > 0 ? (
        <table className="table">
          <thead>
            <tr>
              <th>{t('pages.customerMessages.colSubject')}</th>
              <th>{t('pages.customerMessages.colStatus')}</th>
              <th>{t('pages.customerMessages.colLastMessage')}</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {threads.map((thread) => (
              <tr key={thread.id}>
                <td>{thread.subject || t('pages.customerMessages.noSubject')}</td>
                <td>{thread.status}</td>
                <td>{thread.last_message_at ? new Date(thread.last_message_at).toLocaleString() : '—'}</td>
                <td>
                  <button type="button" className="btn btn-sm" onClick={() => setSelectedId(thread.id)}>
                    {t('pages.customerMessages.open')}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : null}

      {threadDetail ? (
        <div style={{ marginTop: 16 }}>
          <h3>{threadDetail.thread.subject || t('pages.customerMessages.thread')}</h3>
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
              <textarea className="input" placeholder={t('pages.customerMessages.reply')} value={reply} onChange={(e) => setReply(e.target.value)} style={{ minHeight: 80 }} />
              <button type="button" className="btn btn-primary" style={{ marginTop: 8 }} disabled={sending} onClick={() => void sendReply()}>
                {sending ? t('pages.customerMessages.sending') : t('pages.customerMessages.sendReply')}
              </button>
            </>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
