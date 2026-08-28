'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { useAppFeedback } from '@/components/feedback/use-app-feedback';
import { useTranslation } from '@/components/locale-provider';
import { OutboundComposer } from '@/components/outbound/outbound-composer';
import { OutboundDocumentList } from '@/components/outbound/outbound-document-list';
import { OutboundStatusTabs } from '@/components/outbound/outbound-status-tabs';
import { useOutboundAutosave } from '@/components/outbound/use-outbound-autosave';
import type { InvoicePaymentFilter } from '@/components/outbound/outbound-document-list';
import { resolveApiError } from '@/lib/i18n/api-error-copy';
import { getBillingOpsCopy } from '@/lib/i18n/billing-ops-copy';
import type { OutboundDocType, OutboundDocument, OutboundTab } from '@/lib/outbound/types';

type OutboundHubProps = {
  docType: OutboundDocType;
  canManage: boolean;
  showAmount?: boolean;
  initialJobId?: string;
  initialCustomerId?: string;
  initialInvoiceId?: string;
  initialPaymentId?: string;
  forceNew?: boolean;
  paymentFilter?: InvoicePaymentFilter;
  focusOutstanding?: boolean;
  returnTo?: string;
  footer?: React.ReactNode;
};

function safeReturnPath(value?: string): string {
  if (!value || !value.startsWith('/') || value.startsWith('//')) return '';
  return value;
}

export function OutboundHub({
  docType,
  canManage,
  showAmount = false,
  initialJobId,
  initialCustomerId,
  initialInvoiceId,
  initialPaymentId,
  forceNew = false,
  paymentFilter = 'all',
  focusOutstanding = false,
  returnTo,
  footer
}: OutboundHubProps) {
  const router = useRouter();
  const { locale } = useTranslation();
  const billingCopy = getBillingOpsCopy(locale);
  const appFeedback = useAppFeedback();
  const [tab, setTab] = useState<OutboundTab>('sent');
  const [documents, setDocuments] = useState<OutboundDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [schemaReady, setSchemaReady] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const resolvedReturnTo = safeReturnPath(returnTo);

  const autosave = useOutboundAutosave({
    docType,
    initialJobId,
    initialCustomerId,
    initialInvoiceId,
    initialPaymentId,
    forceNew,
    enabled: canManage
  });

  const loadDocuments = useCallback(async () => {
    setLoading(true);
    const res = await fetch(`/api/outbound?docType=${docType}&tab=${tab}`);
    const json = await res.json();
    setLoading(false);
    if (!res.ok) {
      appFeedback.error(resolveApiError(json, locale));
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
  }, [appFeedback, docType, locale, tab]);

  useEffect(() => {
    void loadDocuments();
  }, [loadDocuments]);

  async function handleSendFromComposer() {
    if (autosave.sending) return;
    if (!autosave.fields.recipient_email.trim()) {
      appFeedback.error(billingCopy.enterRecipientEmail);
      return;
    }
    try {
      const result = await autosave.sendNow();
      if (!result) return;
      if (result.document?.status === 'failed' || result.deliveryNote) {
        appFeedback.error(
          result.deliveryNote || result.message || billingCopy.emailFailed
        );
        setTab('failed');
        void loadDocuments();
        return;
      }
      appFeedback.sent();
      if (resolvedReturnTo) {
        router.replace(resolvedReturnTo);
        return;
      }
      setTab('sent');
      void loadDocuments();
    } catch (err) {
      appFeedback.error(
        err instanceof Error
          ? resolveApiError({ error: err.message }, locale)
          : billingCopy.sendFailed
      );
      setTab('failed');
      void loadDocuments();
    }
  }

  async function handleSendExisting(id: string) {
    if (autosave.sending) return;
    const res = await fetch(`/api/outbound/${id}/send`, { method: 'POST' });
    const json = await res.json();
    if (!res.ok) {
      appFeedback.error(resolveApiError(json, locale));
      setTab('failed');
      void loadDocuments();
      return;
    }
    if (json.document?.status === 'failed' || json.deliveryNote) {
      appFeedback.error(json.deliveryNote || json.message || billingCopy.emailFailed);
      setTab('failed');
      void loadDocuments();
      return;
    }
    appFeedback.sent();
    if (resolvedReturnTo) {
      router.replace(resolvedReturnTo);
      return;
    }
    setTab('sent');
    void loadDocuments();
  }

  async function handleDelete(id: string) {
    if (deletingId) return;
    if (!window.confirm(billingCopy.removeItemConfirm)) return;
    setDeletingId(id);
    const res = await fetch(`/api/outbound/${id}`, { method: 'DELETE' });
    const json = await res.json();
    setDeletingId(null);
    if (!res.ok) {
      appFeedback.error(resolveApiError(json, locale));
      return;
    }
    appFeedback.deleted();
    void loadDocuments();
  }

  function handleEdit(doc: OutboundDocument) {
    autosave.loadDocument(doc);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  const historyTitle =
    docType === 'invoice'
      ? focusOutstanding
        ? paymentFilter === 'overdue'
          ? billingCopy.overdueInvoices
          : billingCopy.whoStillOwesYou
        : billingCopy.invoices
      : docType === 'receipt'
        ? billingCopy.receipts
        : billingCopy.sentHistory;

  const composer = canManage && schemaReady ? (
    <OutboundComposer
      docType={docType}
      fields={autosave.fields}
      saveState={autosave.saveState}
      sending={autosave.sending}
      showAmount={showAmount}
      amountMissing={autosave.amountMissing}
      prefillNotice={autosave.prefillNotice}
      prefillReady={autosave.prefillReady}
      onFieldChange={autosave.updateField}
      onSend={() => void handleSendFromComposer()}
      onReset={autosave.resetComposer}
    />
  ) : null;

  const history = (
    <div className="card outbound-history-card">
      <div className="outbound-history-head">
        <h3>{historyTitle}</h3>
        {docType === 'invoice' && paymentFilter !== 'all' ? (
          <p className="muted" style={{ margin: '6px 0 0' }}>
            {focusOutstanding ? billingCopy.outstandingRowHint : billingCopy.paymentFilterHint}
          </p>
        ) : null}
        {focusOutstanding ? (
          <div className="inline-actions" style={{ marginTop: 12 }}>
            <Link className="btn btn-sm" href="/jobs?status=completed">
              {billingCopy.reviewUninvoicedJobs}
            </Link>
            <Link className="btn btn-sm" href="/invoices">
              {billingCopy.createAnInvoice}
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
          <p>{billingCopy.schemaNotice}</p>
        </div>
      ) : null}

      {focusOutstanding ? history : composer}
      {focusOutstanding ? composer : history}
      {footer}
    </>
  );
}
