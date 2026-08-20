'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useTranslation } from '@/components/locale-provider';
import { resolveApiError } from '@/lib/i18n/api-error-copy';
import {
  deliveryStatusLabel,
  emptyTabMessage,
  getBillingOpsCopy,
  invoiceDeliveryPaymentLabelLocalized,
  removeActionLabel
} from '@/lib/i18n/billing-ops-copy';
import { formatDateTimeLocale, formatMoneyUsd } from '@/lib/i18n/locale-format';
import { INVOICE_PAYMENT_METHODS } from '@/lib/outbound/invoice-payment';
import type { OutboundDocument, OutboundTab } from '@/lib/outbound/types';

export type InvoicePaymentFilter = 'all' | 'unpaid' | 'overdue' | 'paid' | 'history';

const PAGE_SIZE = 10;

type OutboundDocumentListProps = {
  documents: OutboundDocument[];
  tab: OutboundTab;
  loading: boolean;
  canManage: boolean;
  paymentFilter?: InvoicePaymentFilter;
  onEdit: (doc: OutboundDocument) => void;
  onSend: (id: string) => void;
  onDelete: (id: string) => void;
  onRetry: (id: string) => void;
  onPaymentRecorded?: () => void;
};

function matchesPaymentFilter(doc: OutboundDocument, filter: InvoicePaymentFilter | undefined): boolean {
  if (!filter || filter === 'all' || doc.doc_type !== 'invoice') return true;
  const status = String(doc.payment_status || '').toLowerCase();
  const stillOwed = Math.max(0, Number(doc.amount || 0) - Number(doc.amount_paid || 0));
  if (filter === 'unpaid') return stillOwed > 0 && status !== 'cancelled';
  if (filter === 'overdue') return status === 'overdue' || (stillOwed > 0 && Boolean(doc.due_date) && String(doc.due_date).slice(0, 10) < new Date().toISOString().slice(0, 10));
  if (filter === 'paid') return status === 'paid' || (stillOwed <= 0 && Number(doc.amount_paid || 0) > 0);
  if (filter === 'history') return Number(doc.amount_paid || 0) > 0;
  return true;
}

function RecordPaymentForm({ doc, onDone }: { doc: OutboundDocument; onDone: () => void }) {
  const { locale } = useTranslation();
  const billingCopy = getBillingOpsCopy(locale);
  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState('Cash');
  const [reference, setReference] = useState('');
  const [note, setNote] = useState('');
  const [paidDate, setPaidDate] = useState(new Date().toISOString().slice(0, 10));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [receiptPrompt, setReceiptPrompt] = useState<{ invoiceId: string; paymentId: string } | null>(null);

  const invoiceTotal = Math.max(0, Number(doc.amount || 0));
  const paid = Math.max(0, Number(doc.amount_paid || 0));
  const stillOwed = Math.max(0, invoiceTotal - paid);

  async function submit() {
    setSaving(true);
    setError('');
    const res = await fetch(`/api/outbound/${doc.id}/payment`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ amount: Number(amount), payment_method: method, payment_reference: reference, payment_notes: note, paid_date: paidDate })
    });
    const json = await res.json();
    setSaving(false);
    if (!res.ok) {
      setError(resolveApiError(json, locale));
      return;
    }
    const invoiceId = (json.invoice?.id as string | undefined) || (doc.source_entity_id as string | undefined) || doc.id;
    const paymentId = (json.payment_id as string | undefined) || '';
    setReceiptPrompt({ invoiceId, paymentId });
  }

  if (receiptPrompt) {
    const params = new URLSearchParams({ invoiceId: receiptPrompt.invoiceId });
    if (receiptPrompt.paymentId) params.set('paymentId', receiptPrompt.paymentId);
    if (doc.job_id) params.set('jobId', doc.job_id);
    if (doc.customer_id) params.set('customerId', doc.customer_id);
    return (
      <div className="outbound-payment-prompt card" style={{ marginTop: 8, padding: 12 }}>
        <strong>{billingCopy.paymentRecorded}</strong>
        <div className="button-row" style={{ marginTop: 10 }}>
          <Link className="btn btn-primary" href={`/receipts?${params.toString()}`}>{billingCopy.sendReceipt}</Link>
          <button type="button" className="btn" onClick={() => onDone()}>{billingCopy.later}</button>
        </div>
      </div>
    );
  }

  return (
    <div className="outbound-payment-form" style={{ marginTop: 8 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: 8 }}>
        <div><span className="muted" style={{ display: 'block' }}>{billingCopy.invoiceTotal}</span><strong>{formatMoneyUsd(invoiceTotal, locale)}</strong></div>
        <div><span className="muted" style={{ display: 'block' }}>{billingCopy.paid}</span><strong>{formatMoneyUsd(paid, locale)}</strong></div>
        <div><span className="muted" style={{ display: 'block' }}>{billingCopy.stillOwed}</span><strong>{formatMoneyUsd(stillOwed, locale)}</strong></div>
      </div>
      <p className="muted" style={{ marginTop: 8 }}>{billingCopy.recordPaymentOnce}</p>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 8 }}>
        <input className="input" type="number" min="0" step="0.01" placeholder={billingCopy.paymentAmount} aria-label={billingCopy.paymentAmount} value={amount} onChange={(e) => setAmount(e.target.value)} />
        <input className="input" type="date" aria-label={billingCopy.paymentDate} value={paidDate} onChange={(e) => setPaidDate(e.target.value)} />
        <select className="input" aria-label={billingCopy.paymentMethod} value={method} onChange={(e) => setMethod(e.target.value)}>
          {INVOICE_PAYMENT_METHODS.map((m) => <option key={m} value={m}>{billingCopy.paymentMethods[m] || m}</option>)}
        </select>
        <input className="input" placeholder={billingCopy.referenceNumber} aria-label={billingCopy.referenceNumber} value={reference} onChange={(e) => setReference(e.target.value)} />
      </div>
      <input className="input" style={{ marginTop: 8, width: '100%' }} placeholder={billingCopy.notes} aria-label={billingCopy.notes} value={note} onChange={(e) => setNote(e.target.value)} />
      {error ? <span className="outbound-document-error">{error}</span> : null}
      <button type="button" className="btn btn-sm btn-primary" style={{ marginTop: 8 }} disabled={saving} onClick={() => void submit()}>{saving ? billingCopy.savingEllipsis : billingCopy.savePayment}</button>
    </div>
  );
}

export function OutboundDocumentList({ documents, tab, loading, canManage, paymentFilter = 'all', onEdit, onSend, onDelete, onRetry, onPaymentRecorded }: OutboundDocumentListProps) {
  const { locale } = useTranslation();
  const billingCopy = getBillingOpsCopy(locale);
  const [recordingId, setRecordingId] = useState<string | null>(null);
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const visibleDocuments = documents.filter((doc) => matchesPaymentFilter(doc, paymentFilter));
  const pagedDocuments = visibleDocuments.slice(0, visibleCount);

  useEffect(() => {
    setVisibleCount(PAGE_SIZE);
    setRecordingId(null);
  }, [tab, paymentFilter, documents.length]);

  if (loading) return <p className="muted">{billingCopy.loading}</p>;
  if (!documents.length) return <p className="muted">{emptyTabMessage(billingCopy, tab)}</p>;
  if (!visibleDocuments.length) return <p className="muted">{billingCopy.noInvoicesMatchFilter}</p>;

  return (
    <div className="outbound-document-list">
      {tab === 'sent' ? <p className="muted" style={{ marginBottom: 12 }}>{billingCopy.sentHistoryHint}</p> : null}
      {tab === 'failed' ? <p className="muted" style={{ marginBottom: 12 }}>{billingCopy.failedHistoryHint}</p> : null}
      {pagedDocuments.map((doc) => {
        const amount = doc.amount == null || !Number.isFinite(Number(doc.amount)) ? '' : formatMoneyUsd(Number(doc.amount), locale);
        const stillOwed = Math.max(0, Number(doc.amount || 0) - Number(doc.amount_paid || 0));
        const whenIso = doc.sent_at || doc.scheduled_at || doc.failed_at || doc.updated_at;
        const status = doc.doc_type === 'invoice'
          ? invoiceDeliveryPaymentLabelLocalized(locale, { deliveryStatus: doc.status, paymentStatus: doc.payment_status, amount: doc.amount, amountPaid: doc.amount_paid })
          : deliveryStatusLabel(locale, doc.status);
        const showPayment = canManage && tab === 'sent' && doc.doc_type === 'invoice' && doc.payment_status !== 'paid' && doc.payment_status !== 'cancelled' && stillOwed > 0 && !['draft', 'cancelled', 'canceled'].includes(String(doc.status || '').toLowerCase());
        const invoiceHref = `/invoices?invoiceId=${encodeURIComponent(doc.source_entity_id || doc.id)}`;

        return (
          <div key={doc.id} className={`outbound-document-row${doc.doc_type === 'invoice' ? ' open-in-new-tab-card' : ''}`}>
            {doc.doc_type === 'invoice' ? <Link href={invoiceHref} target="_blank" rel="noopener noreferrer" className="record-card-overlay-link" aria-label={`Open ${doc.subject || doc.recipient_email || billingCopy.untitled} in a new tab`}><span className="record-card-overlay-label">Open {doc.subject || doc.recipient_email || billingCopy.untitled} in a new tab</span></Link> : null}
            <div className="outbound-document-main">
              {doc.doc_type === 'invoice' ? <Link href={invoiceHref} target="_blank" rel="noopener noreferrer"><strong>{doc.subject || doc.recipient_email || billingCopy.untitled}</strong></Link> : <strong>{doc.subject || doc.recipient_email || billingCopy.untitled}</strong>}
              <span className="muted">{doc.recipient_email || billingCopy.noRecipient}</span>
              {doc.doc_type === 'invoice' ? (
                <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', marginTop: 7 }}>
                  {amount ? <span><strong>{amount}</strong> <span className="muted">total</span></span> : null}
                  <span><strong>{formatMoneyUsd(Number(doc.amount_paid || 0), locale)}</strong> <span className="muted">paid</span></span>
                  <span><strong>{formatMoneyUsd(stillOwed, locale)}</strong> <span className="muted">owed</span></span>
                </div>
              ) : null}
              <span className="muted" style={{ marginTop: 6 }}>{status}</span>
              <span className="muted outbound-document-time">{formatDateTimeLocale(whenIso, locale)}</span>
              {doc.job_id ? <Link href={`/jobs/${doc.job_id}`} className="btn btn-sm" style={{ width: 'fit-content', marginTop: 8, position: 'relative', zIndex: 2 }}>Open job</Link> : null}
              {doc.failure_reason ? <span className="outbound-document-error">{billingCopy.reasonPrefix} {doc.failure_reason}</span> : null}
              {showPayment && recordingId === doc.id ? <RecordPaymentForm doc={doc} onDone={() => { setRecordingId(null); onPaymentRecorded?.(); }} /> : null}
            </div>
            {canManage ? (
              <div className="outbound-document-actions">
                {showPayment && recordingId !== doc.id ? <button type="button" className="btn btn-sm btn-primary" onClick={() => setRecordingId(doc.id)}>{billingCopy.recordPayment}</button> : null}
                {tab === 'drafts' || tab === 'scheduled' ? <button type="button" className="btn btn-sm btn-primary" onClick={() => onSend(doc.id)}>{billingCopy.send}</button> : null}
                {tab === 'failed' ? <button type="button" className="btn btn-sm btn-primary" onClick={() => onRetry(doc.id)}>{billingCopy.retry}</button> : null}
                {tab !== 'sent' ? <button type="button" className="btn btn-sm" onClick={() => onEdit(doc)}>{billingCopy.edit}</button> : null}
                <button type="button" className="btn btn-sm btn-danger" onClick={() => onDelete(doc.id)}>{removeActionLabel(billingCopy, tab)}</button>
              </div>
            ) : null}
          </div>
        );
      })}
      <div style={{ display: 'grid', gap: 8, marginTop: 14 }}>
        <p className="muted" style={{ margin: 0 }}>Showing {Math.min(visibleCount, visibleDocuments.length)} / {visibleDocuments.length}</p>
        {visibleCount < visibleDocuments.length ? <button type="button" className="btn" onClick={() => setVisibleCount((count) => count + PAGE_SIZE)}>Show 10 more</button> : null}
      </div>
    </div>
  );
}
