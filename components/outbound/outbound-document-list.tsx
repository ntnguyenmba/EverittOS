'use client';

import { useState } from 'react';
import { invoiceDeliveryPaymentLabel, INVOICE_PAYMENT_METHODS } from '@/lib/outbound/invoice-payment';
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
  onPaymentRecorded?: () => void;
};

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

function RecordPaymentForm({
  doc,
  onDone
}: {
  doc: OutboundDocument;
  onDone: () => void;
}) {
  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState('Cash');
  const [reference, setReference] = useState('');
  const [note, setNote] = useState('');
  const [paidDate, setPaidDate] = useState(new Date().toISOString().slice(0, 10));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const balance = Math.max(0, Number(doc.amount || 0) - Number(doc.amount_paid || 0));

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
    onDone();
  }

  return (
    <div className="outbound-payment-form" style={{ marginTop: 8 }}>
      <p className="muted">Balance due: {balance.toLocaleString(undefined, { style: 'currency', currency: 'USD' })}</p>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 8 }}>
        <input
          className="input"
          type="number"
          min="0"
          step="0.01"
          placeholder="Payment amount"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
        />
        <select className="input" value={method} onChange={(e) => setMethod(e.target.value)}>
          {INVOICE_PAYMENT_METHODS.map((m) => (
            <option key={m} value={m}>
              {m}
            </option>
          ))}
        </select>
        <input
          className="input"
          placeholder="Reference"
          value={reference}
          onChange={(e) => setReference(e.target.value)}
        />
        <input className="input" type="date" value={paidDate} onChange={(e) => setPaidDate(e.target.value)} />
      </div>
      <input
        className="input"
        style={{ marginTop: 8, width: '100%' }}
        placeholder="Payment note"
        value={note}
        onChange={(e) => setNote(e.target.value)}
      />
      {error ? <span className="outbound-document-error">{error}</span> : null}
      <button type="button" className="btn btn-sm btn-primary" style={{ marginTop: 8 }} disabled={saving} onClick={() => void submit()}>
        {saving ? 'Saving…' : 'Record payment'}
      </button>
    </div>
  );
}

export function OutboundDocumentList({
  documents,
  tab,
  loading,
  canManage,
  onEdit,
  onSend,
  onDelete,
  onRetry,
  onPaymentRecorded
}: OutboundDocumentListProps) {
  const [recordingId, setRecordingId] = useState<string | null>(null);

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
      {tab === 'failed' ? (
        <p className="muted" style={{ marginBottom: 12 }}>
          Failed deliveries were not sent. Fix the recipient or email settings, then retry.
        </p>
      ) : null}
      {documents.map((doc) => {
        const amount = amountLabel(doc);
        const showPayment =
          canManage &&
          tab === 'sent' &&
          doc.doc_type === 'invoice' &&
          doc.status === 'sent' &&
          doc.payment_status !== 'paid' &&
          doc.payment_status !== 'cancelled';
        return (
          <div key={doc.id} className="outbound-document-row">
            <div className="outbound-document-main">
              <strong>{doc.subject || doc.recipient_email || 'Untitled'}</strong>
              <span className="muted">
                {doc.recipient_email || 'No recipient'}
                {amount ? ` · ${amount}` : ''}
                {doc.amount_paid != null && Number(doc.amount_paid) > 0
                  ? ` · Paid ${Number(doc.amount_paid).toLocaleString(undefined, { style: 'currency', currency: 'USD' })}`
                  : ''}
                {doc.doc_type === 'invoice' && Number(doc.amount || 0) - Number(doc.amount_paid || 0) > 0
                  ? ` · Still owed ${Math.max(0, Number(doc.amount || 0) - Number(doc.amount_paid || 0)).toLocaleString(undefined, { style: 'currency', currency: 'USD' })}`
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
