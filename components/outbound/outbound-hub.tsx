'use client';

import { useCallback, useEffect, useState } from 'react';
import { useAppFeedback } from '@/components/feedback/use-app-feedback';
import { OutboundComposer } from '@/components/outbound/outbound-composer';
import { OutboundDocumentList } from '@/components/outbound/outbound-document-list';
import { OutboundStatusTabs } from '@/components/outbound/outbound-status-tabs';
import { useOutboundAutosave } from '@/components/outbound/use-outbound-autosave';
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
  const appFeedback = useAppFeedback();
  const [tab, setTab] = useState<OutboundTab>('sent');
  const [documents, setDocuments] = useState<OutboundDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [schemaReady, setSchemaReady] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);

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
      appFeedback.error(json.error || 'Unable to load documents');
      setSchemaReady(true);
      return;
    }
    if (json.schemaReady === false) {
      setSchemaReady(false);
      setDocuments([]);
      return;
    }
    setSchemaReady(true);
    setDocuments((json.documents || []) as OutboundDocument[]);
  }, [appFeedback, docType, tab]);

  useEffect(() => {
    void loadDocuments();
  }, [loadDocuments]);

  async function handleSendFromComposer() {
    if (autosave.sending) return;
    if (!autosave.fields.recipient_email.trim()) {
      appFeedback.error('Enter a recipient email before sending.');
      return;
    }
    try {
      const result = await autosave.sendNow();
      if (!result) return;
      if (result.emailSent === false || result.document?.status === 'failed') {
        appFeedback.error(result.deliveryNote || 'Email failed. Check the Failed tab to retry.');
        setTab('failed');
        void loadDocuments();
        return;
      }
      appFeedback.sent();
      setTab('sent');
      void loadDocuments();
    } catch (err) {
      appFeedback.error(err instanceof Error ? err.message : 'Send failed');
      setTab('failed');
      void loadDocuments();
    }
  }

  async function handleSendExisting(id: string) {
    if (autosave.sending) return;
    const res = await fetch(`/api/outbound/${id}/send`, { method: 'POST' });
    const json = await res.json();
    if (!res.ok) {
      appFeedback.error(json.error || 'Send failed');
      setTab('failed');
      void loadDocuments();
      return;
    }
    if (json.emailSent === false || json.document?.status === 'failed') {
      appFeedback.error(json.deliveryNote || 'Email failed. Check the Failed tab to retry.');
      setTab('failed');
      void loadDocuments();
      return;
    }
    appFeedback.sent();
    setTab('sent');
    void loadDocuments();
  }

  async function handleDelete(id: string) {
    if (deletingId) return;
    if (!window.confirm('Remove this item?')) return;
    setDeletingId(id);
    const res = await fetch(`/api/outbound/${id}`, { method: 'DELETE' });
    const json = await res.json();
    setDeletingId(null);
    if (!res.ok) {
      appFeedback.error(json.error || 'Delete failed');
      return;
    }
    appFeedback.deleted();
    void loadDocuments();
  }

  function handleEdit(doc: OutboundDocument) {
    autosave.loadDocument(doc);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  return (
    <>
      {!schemaReady ? (
        <div className="card outbound-schema-notice" role="status">
          <p>
            Outbound tables are not set up in this database yet. Run{' '}
            <code>supabase/manual_schema_repair.sql</code> in the Supabase SQL Editor, then refresh this page.
          </p>
        </div>
      ) : null}

      {canManage && schemaReady ? (
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
