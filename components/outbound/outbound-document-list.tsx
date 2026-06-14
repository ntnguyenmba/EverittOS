'use client';

import type { OutboundDocument, OutboundTab } from '@/lib/outbound/types';

type OutboundDocumentListProps = {
  documents: OutboundDocument[];
  tab: OutboundTab;
  loading: boolean;
  canManage: boolean;
  onEdit: (doc: OutboundDocument) => void;
  onSend: (id: string) => void;
  onDelete: (id: string) => void;
  onRetry: (id: string) => void;
};

function formatWhen(doc: OutboundDocument): string {
  const iso = doc.sent_at || doc.scheduled_at || doc.failed_at || doc.updated_at;
  if (!iso) return '';
  return new Date(iso).toLocaleString();
}

function removeLabel(tab: OutboundTab): string {
  if (tab === 'sent') return 'Hide from history';
  if (tab === 'scheduled') return 'Cancel schedule';
  return 'Delete draft';
}

export function OutboundDocumentList({
  documents,
  tab,
  loading,
  canManage,
  onEdit,
  onSend,
  onDelete,
  onRetry
}: OutboundDocumentListProps) {
  if (loading) return <p className="muted">Loading…</p>;
  if (!documents.length) {
    const empty: Record<OutboundTab, string> = {
      sent: 'Nothing sent yet. Compose above and tap Send.',
      scheduled: 'No scheduled items.',
      drafts: 'No drafts. Your work saves automatically while you type.',
      failed: 'No failed deliveries.'
    };
    return <p className="muted">{empty[tab]}</p>;
  }

  return (
    <div className="outbound-document-list">
      {tab === 'sent' ? (
        <p className="muted" style={{ marginBottom: 12 }}>
          Sent items cannot be unsent. Hiding an item only removes it from this history list.
        </p>
      ) : null}
      {documents.map((doc) => (
        <div key={doc.id} className="outbound-document-row">
          <div className="outbound-document-main">
            <strong>{doc.subject || doc.recipient_email || 'Untitled'}</strong>
            <span className="muted">
              {doc.recipient_email || 'No recipient'}
              {doc.amount != null ? ` · $${Number(doc.amount).toFixed(2)}` : ''}
            </span>
            <span className="muted outbound-document-time">{formatWhen(doc)}</span>
            {doc.failure_reason ? <span className="outbound-document-error">{doc.failure_reason}</span> : null}
          </div>
          {canManage ? (
            <div className="outbound-document-actions">
              {tab === 'drafts' || tab === 'scheduled' || tab === 'failed' ? (
                <button type="button" className="btn btn-sm btn-primary" onClick={() => onSend(doc.id)}>
                  Send
                </button>
              ) : null}
              {tab === 'failed' ? (
                <button type="button" className="btn btn-sm" onClick={() => onRetry(doc.id)}>
                  Retry
                </button>
              ) : null}
              {tab !== 'sent' ? (
                <button type="button" className="btn btn-sm" onClick={() => onEdit(doc)}>
                  Edit
                </button>
              ) : null}
              <button type="button" className="btn btn-sm btn-danger" onClick={() => onDelete(doc.id)}>
                {removeLabel(tab)}
              </button>
            </div>
          ) : null}
        </div>
      ))}
    </div>
  );
}
