'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { useAppFeedback } from '@/components/feedback/use-app-feedback';
import { OutboundComposer } from '@/components/outbound/outbound-composer';
import { OutboundDocumentList } from '@/components/outbound/outbound-document-list';
import { OutboundStatusTabs } from '@/components/outbound/outbound-status-tabs';
import { useOutboundAutosave } from '@/components/outbound/use-outbound-autosave';
import type { InvoicePaymentFilter } from '@/components/outbound/outbound-document-list';
import type { OutboundDocType, OutboundDocument, OutboundTab } from '@/lib/outbound/types';

type OutboundHubProps = {
  docType: OutboundDocType;
  canManage: boolean;
  showAmount?: boolean;
  initialJobId?: string;
  initialCustomerId?: string;
  paymentFilter?: InvoicePaymentFilter;
  focusOutstanding?: boolean;
  footer?: React.ReactNode;
};

export function OutboundHub({
  docType,
  canManage,
  showAmount = false,
  initialJobId,
  initialCustomerId,
  paymentFilter = 'all',
  focusOutstanding = false,
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
      if (result.document?.status === 'failed' || result.deliveryNote) {
        appFeedback.error(result.deliveryNote || result.message || 'Email failed. Check the Failed tab to retry.');
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
    if (json.document?.status === 'failed' || json.deliveryNote) {
      appFeedback.error(json.deliveryNote || json.message || 'Email failed. Check the Failed tab to retry.');
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

  const composer = canManage && schemaReady ? (
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
  ) : null;

  const history = (
    <div className="card outbound-history-card">
      <div className="outbound-history-head">
        <h3>
          {docType === 'invoice'
            ? focusOutstanding
              ? paymentFilter === 'overdue'
                ? 'Overdue invoices'
                : 'Who still owes you'
              : 'Invoices'
            : 'Sent history'}
        </h3>
        {docType === 'invoice' && paymentFilter !== 'all' ? (
          <p className="muted" style={{ margin: '6px 0 0' }}>
            {focusOutstanding
              ? 'Each row below shows the customer, invoice, amount billed, amount paid, and remaining balance.'
              : `Showing ${paymentFilter === 'history' ? 'payment history' : paymentFilter} invoices. Record payment here once and every dashboard metric updates from this.`}
          </p>
        ) : null}
        {focusOutstanding ? (
          <div className="inline-actions" style={{ marginTop: 12 }}>
            <Link className="btn btn-sm" href="/jobs?status=completed">
              Review uninvoiced jobs
            </Link>
            <Link className="btn btn-sm" href="/invoices">
              Create an invoice
            </Link>
          </div>
        ) : null}
      </div>
      <OutboundStatusTabs active={tab} onChange={setTab} />
      <OutboundDocumentList
        documents={documents}
        tab={tab}
        loading={loading}
        canManage={canManage}
        paymentFilter={docType === 'invoice' ? paymentFilter : 'all'}
        onEdit={handleEdit}
        onSend={(id) => void handleSendExisting(id)}
        onRetry={(id) => void handleSendExisting(id)}
        onDelete={(id) => void handleDelete(id)}
        onPaymentRecorded={() => void loadDocuments()}
      />
    </div>
  );

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

      {focusOutstanding ? history : composer}
      {focusOutstanding ? composer : history}
      {footer}
    </>
  );
}
