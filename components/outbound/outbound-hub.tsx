'use client';

import { useCallback, useEffect, useState } from 'react';
import { ActionFeedbackBanner } from '@/components/action-feedback';
import { OutboundComposer } from '@/components/outbound/outbound-composer';
import { OutboundDocumentList } from '@/components/outbound/outbound-document-list';
import { OutboundStatusTabs } from '@/components/outbound/outbound-status-tabs';
import { useOutboundAutosave } from '@/components/outbound/use-outbound-autosave';
import { errorFeedback, successFeedback, type ActionFeedback } from '@/lib/action-messages';
import type { OutboundDocType, OutboundDocument, OutboundTab } from '@/lib/outbound/types';

type OutboundHubProps = {
  docType: OutboundDocType;
  canManage: boolean;
  showAmount?: boolean;
  initialJobId?: string;
  initialCustomerId?: string;
  footer?: React.ReactNode;
};

export function OutboundHub({
  docType,
  canManage,
  showAmount = false,
  initialJobId,
  initialCustomerId,
  footer
}: OutboundHubProps) {
  const [tab, setTab] = useState<OutboundTab>('sent');
  const [documents, setDocuments] = useState<OutboundDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [feedback, setFeedback] = useState<ActionFeedback | null>(null);

  const autosave = useOutboundAutosave({
    docType,
    initialJobId,
    initialCustomerId,
    enabled: canManage
  });

  const loadDocuments = useCallback(async () => {
    setLoading(true);
    const res = await fetch(`/api/outbound?docType=${docType}&tab=${tab}`);
    const json = await res.json();
    setLoading(false);
    if (!res.ok) {
      setFeedback(errorFeedback(json.error || 'Unable to load documents'));
      return;
    }
    setDocuments((json.documents || []) as OutboundDocument[]);
  }, [docType, tab]);

  useEffect(() => {
    void loadDocuments();
  }, [loadDocuments]);

  async function handleSendFromComposer() {
    if (!autosave.fields.recipient_email.trim()) {
      setFeedback(errorFeedback('Enter a recipient email before sending.'));
      return;
    }
    try {
      const result = await autosave.sendNow();
      if (!result) return;
      const note = result.deliveryNote ? ` ${result.deliveryNote}` : '';
      setFeedback(successFeedback(`${result.message || 'Sent successfully.'}${note}`));
      setTab('sent');
      void loadDocuments();
    } catch (err) {
      setFeedback(errorFeedback(err instanceof Error ? err.message : 'Send failed'));
      setTab('failed');
      void loadDocuments();
    }
  }

  async function handleSendExisting(id: string) {
    setFeedback(null);
    const res = await fetch(`/api/outbound/${id}/send`, { method: 'POST' });
    const json = await res.json();
    if (!res.ok) {
      setFeedback(errorFeedback(json.error || 'Send failed'));
      setTab('failed');
      void loadDocuments();
      return;
    }
    const note = json.deliveryNote ? ` ${json.deliveryNote}` : '';
    setFeedback(successFeedback(`${json.message || 'Sent successfully.'}${note}`));
    setTab('sent');
    void loadDocuments();
  }

  async function handleDelete(id: string) {
    if (!window.confirm('Remove this item?')) return;
    const res = await fetch(`/api/outbound/${id}`, { method: 'DELETE' });
    const json = await res.json();
    if (!res.ok) {
      setFeedback(errorFeedback(json.error || 'Delete failed'));
      return;
    }
    setFeedback(successFeedback('Removed.'));
    void loadDocuments();
  }

  function handleEdit(doc: OutboundDocument) {
    autosave.loadDocument(doc);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  return (
    <>
      {canManage ? (
        <OutboundComposer
          docType={docType}
          fields={autosave.fields}
          saveState={autosave.saveState}
          sending={autosave.sending}
          showAmount={showAmount}
          onFieldChange={autosave.updateField}
          onSend={() => void handleSendFromComposer()}
          onReset={autosave.resetComposer}
        />
      ) : null}

      <ActionFeedbackBanner feedback={feedback} onDismiss={() => setFeedback(null)} />

      <div className="card outbound-history-card">
        <div className="outbound-history-head">
          <h3>Sent history</h3>
        </div>
        <OutboundStatusTabs active={tab} onChange={setTab} />
        <OutboundDocumentList
          documents={documents}
          tab={tab}
          loading={loading}
          canManage={canManage}
          onEdit={handleEdit}
          onSend={(id) => void handleSendExisting(id)}
          onRetry={(id) => void handleSendExisting(id)}
          onDelete={(id) => void handleDelete(id)}
        />
      </div>

      {footer}
    </>
  );
}
