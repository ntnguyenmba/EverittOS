'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useTranslation } from '@/components/locale-provider';
import { getBillingOpsCopy } from '@/lib/i18n/billing-ops-copy';
import { invoiceDeliveryPaymentLabel, INVOICE_PAYMENT_METHODS } from '@/lib/outbound/invoice-payment';
import type { OutboundDocument, OutboundTab } from '@/lib/outbound/types';

export type InvoicePaymentFilter = 'all' | 'unpaid' | 'overdue' | 'paid' | 'history';

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

function formatWhen(doc: OutboundDocument): string {
  const iso = doc.sent_at || doc.scheduled_at || doc.failed_at || doc.updated_at;
  if (!iso) return '';
  return new Date(iso).toLocaleString();
}

function amountLabel(doc: OutboundDocument): string {
  if (doc.amount == null) return '';
  const amount = Number(doc.amount);
  if (!Number.isFinite(amount)) return '';
  return amount.toLocaleString(undefined, { style: 'currency', currency: 'USD' });
}

function statusLabel(doc: OutboundDocument): string {
  if (doc.doc_type === 'invoice') {
    return invoiceDeliveryPaymentLabel({
      deliveryStatus: doc.status,
      paymentStatus: doc.payment_status as import('@/lib/outbound/invoice-payment').InvoicePaymentStatus | null,
      amount: doc.amount,
      amountPaid: doc.amount_paid
    });
  }
  if (doc.status === 'failed') return 'Delivery failed';
  if (doc.status === 'scheduled') return 'Scheduled';
  if (doc.status === 'draft') return 'Draft';
  return 'Sent';
}

function removeLabel(tab: OutboundTab): string {
  if (tab === 'sent') return 'Hide from history';
  if (tab === 'scheduled') return 'Cancel schedule';
  return 'Delete draft';
}

function money(value: number): string {
  return value.toLocaleString(undefined, { style: 'currency', currency: 'USD' });
}

function RecordPaymentForm({
  doc,
  onDone
}: {
  doc: OutboundDocument;
  onDone: () => void;
}) {
  const { locale } = useTranslation();
  const billingCopy = getBillingOpsCopy(locale);
  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState('Cash');
  const [reference, setReference] = useState('');
  const [note, setNote] = useState('');
  const [paidDate, setPaidDate] = useState(new Date().toISOString().slice(0, 10));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [receiptPrompt, setReceiptPrompt] = useState<{
    invoiceId: string;
    paymentId: string;
  } | null>(null);

  const invoiceTotal = Math.max(0, Number(doc.amount || 0));
  const paid = Math.max(0, Number(doc.amount_paid || 0));
  const stillOwed = Math.max(0, invoiceTotal - paid);

  async function submit() {
    setSaving(true);
    setError('');
    const res = await fetch(`/api/outbound/${doc.id}/payment`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        amount: Number(amount),
        payment_method: method,
        payment_reference: reference,
        payment_notes: note,
        paid_date: paidDate
      })
    });
    const json = await res.json();
    setSaving(false);
    if (!res.ok) {
      setError(json.error || 'Unable to record payment');
      return;
    }
    const invoiceId =
      (json.invoice?.id as string | undefined) ||
      (doc.source_entity_id as string | undefined) ||
      doc.id;
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
          <Link className="btn btn-primary" href={`/receipts?${params.toString()}`}>
            {billingCopy.sendReceipt}
          </Link>
          <button type="button" className="btn" onClick={() => onDone()}>
            {billingCopy.later}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="outbound-payment-form" style={{ marginTop: 8 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: 8 }}>
        <div>
          <span className="muted" style={{ display: 'block' }}>Invoice total</span>
          <strong>{money(invoiceTotal)}</strong>
        </div>
        <div>
          <span className="muted" style={{ display: 'block' }}>Paid</span>
          <strong>{money(paid)}</strong>
        </div>
        <div>
          <span className="muted" style={{ display: 'block' }}>Still owed</span>
          <strong>{money(stillOwed)}</strong>
        </div>
      </div>
      <p className="muted" style={{ marginTop: 8 }}>
        Record this payment once. Dashboard, reports, and cash metrics update automatically.
      </p>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 8 }}>
        <input
          className="input"
          type="number"
          min="0"
          step="0.01"
          placeholder="Payment amount"
          aria-label="Payment amount"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
        />
        <input
          className="input"
          type="date"
          aria-label="Payment date"
          value={paidDate}
          onChange={(e) => setPaidDate(e.target.value)}
        />
        <select className="input" aria-label="Payment method" value={method} onChange={(e) => setMethod(e.target.value)}>
          {INVOICE_PAYMENT_METHODS.map((m) => (
            <option key={m} value={m}>
              {m}
            </option>
          ))}
        </select>
        <input
          className="input"
          placeholder="Reference number"
          aria-label="Reference number"
          value={reference}
          onChange={(e) => setReference(e.target.value)}
        />
      </div>
      <input
        className="input"
        style={{ marginTop: 8, width: '100%' }}
        placeholder="Notes"
        aria-label="Payment notes"
        value={note}
        onChange={(e) => setNote(e.target.value)}
      />
      {error ? <span className="outbound-document-error">{error}</span> : null}
      <button type="button" className="btn btn-sm btn-primary" style={{ marginTop: 8 }} disabled={saving} onClick={() => void submit()}>
        {saving ? 'Saving…' : 'Save payment'}
      </button>
    </div>
  );
}

export function OutboundDocumentList({
  documents,
  tab,
  loading,
  canManage,
  paymentFilter = 'all',
  onEdit,
  onSend,
  onDelete,
  onRetry,
  onPaymentRecorded
}: OutboundDocumentListProps) {
  const [recordingId, setRecordingId] = useState<string | null>(null);
  const visibleDocuments = documents.filter((doc) => matchesPaymentFilter(doc, paymentFilter));

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
  if (!visibleDocuments.length) {
    return <p className="muted">No invoices match this payment filter.</p>;
  }

  return (
    <div className="outbound-document-list">
      {tab === 'sent' ? (
        <p className="muted" style={{ marginBottom: 12 }}>
          Sent items cannot be unsent. Hiding an item only removes it from this history list. Use Record payment when a customer pays.
        </p>
      ) : null}
      {tab === 'failed' ? (
        <p className="muted" style={{ marginBottom: 12 }}>
          Failed deliveries were not sent. Fix the recipient or email settings, then retry.
        </p>
      ) : null}
      {visibleDocuments.map((doc) => {
        const amount = amountLabel(doc);
        const stillOwed = Math.max(0, Number(doc.amount || 0) - Number(doc.amount_paid || 0));
        const showPayment =
          canManage &&
          tab === 'sent' &&
          doc.doc_type === 'invoice' &&
          doc.payment_status !== 'paid' &&
          doc.payment_status !== 'cancelled' &&
          stillOwed > 0 &&
          !['draft', 'cancelled', 'canceled'].includes(String(doc.status || '').toLowerCase());
        return (
          <div key={doc.id} className="outbound-document-row">
            <div className="outbound-document-main">
              <strong>{doc.subject || doc.recipient_email || 'Untitled'}</strong>
              <span className="muted">
                {doc.recipient_email || 'No recipient'}
                {amount ? ` · Invoice total ${amount}` : ''}
                {doc.amount_paid != null && Number(doc.amount_paid) > 0
                  ? ` · Paid ${Number(doc.amount_paid).toLocaleString(undefined, { style: 'currency', currency: 'USD' })}`
                  : ''}
                {doc.doc_type === 'invoice' && stillOwed > 0
                  ? ` · Still owed ${stillOwed.toLocaleString(undefined, { style: 'currency', currency: 'USD' })}`
                  : ''}
              </span>
              <span className="muted">{statusLabel(doc)}</span>
              <span className="muted outbound-document-time">{formatWhen(doc)}</span>
              {doc.failure_reason ? <span className="outbound-document-error">Reason: {doc.failure_reason}</span> : null}
              {showPayment && recordingId === doc.id ? (
                <RecordPaymentForm
                  doc={doc}
                  onDone={() => {
                    setRecordingId(null);
                    onPaymentRecorded?.();
                  }}
                />
              ) : null}
            </div>
            {canManage ? (
              <div className="outbound-document-actions">
                {showPayment && recordingId !== doc.id ? (
                  <button type="button" className="btn btn-sm" onClick={() => setRecordingId(doc.id)}>
                    Record payment
                  </button>
                ) : null}
                {tab === 'drafts' || tab === 'scheduled' ? (
                  <button type="button" className="btn btn-sm btn-primary" onClick={() => onSend(doc.id)}>
                    Send
                  </button>
                ) : null}
                {tab === 'failed' ? (
                  <button type="button" className="btn btn-sm btn-primary" onClick={() => onRetry(doc.id)}>
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
        );
      })}
    </div>
  );
}
