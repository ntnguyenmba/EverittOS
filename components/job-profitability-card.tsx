'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAppFeedback } from '@/components/feedback/use-app-feedback';
import { useTranslation } from '@/components/locale-provider';
import { FEEDBACK } from '@/lib/feedback-labels';
import { CLIENT_PAYMENT_METHODS } from '@/lib/finance/job-payments';
import { formatCurrency } from '@/lib/finance-format';
import type { JobPaymentStatus, JobProfitability } from '@/lib/finance-types';
import { getJobFinanceCopy, paymentMethodLabel } from '@/lib/i18n/job-finance-copy';

type JobProfitabilityCardProps = {
  jobId: string;
  customerId?: string | null;
  canManage: boolean;
  refreshKey?: number;
};

function todayInputValue() {
  return new Date().toISOString().slice(0, 10);
}

function formatPaymentDate(value: string) {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return value;
  return date.toLocaleDateString();
}

function paymentStatusLabel(status: JobPaymentStatus, copy: ReturnType<typeof getJobFinanceCopy>) {
  if (status === 'unpaid') return copy.statusUnpaid;
  if (status === 'partially_paid') return copy.statusPartiallyPaid;
  if (status === 'paid') return copy.statusPaid;
  return copy.statusNoAmountSet;
}

export function JobProfitabilityCard({ jobId, customerId, canManage, refreshKey = 0 }: JobProfitabilityCardProps) {
  const router = useRouter();
  const appFeedback = useAppFeedback();
  const { locale } = useTranslation();
  const copy = getJobFinanceCopy(locale);
  const [profitability, setProfitability] = useState<JobProfitability | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [recording, setRecording] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [showPaymentForm, setShowPaymentForm] = useState(false);
  const [revenueAmount, setRevenueAmount] = useState('');
  const [revenueNotes, setRevenueNotes] = useState('');
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentDate, setPaymentDate] = useState(todayInputValue());
  const [paymentMethod, setPaymentMethod] = useState<string>(CLIENT_PAYMENT_METHODS[0]);
  const [paymentReference, setPaymentReference] = useState('');
  const [paymentNotes, setPaymentNotes] = useState('');

  const loadFinancials = useCallback(async () => {
    setLoading(true);
    const res = await fetch(`/api/jobs/${jobId}/profitability`);
    const json = await res.json().catch(() => ({}));
    setLoading(false);
    if (!res.ok) {
      appFeedback.error(json.error || copy.unableToLoad);
      return;
    }
    const next = json.profitability as JobProfitability;
    setProfitability(next);
    setRevenueAmount(next.manualRevenue ? String(next.manualRevenue) : '');
    setRevenueNotes(next.revenueNotes || '');
  }, [appFeedback, copy.unableToLoad, jobId]);

  useEffect(() => {
    void loadFinancials();
  }, [loadFinancials, refreshKey]);

  function invoiceParams(extra?: Record<string, string>) {
    const params = new URLSearchParams({ jobId, ...extra });
    if (customerId) params.set('customerId', customerId);
    return params;
  }

  function openCreateInvoice() {
    router.push(`/invoices?${invoiceParams({ action: 'new' }).toString()}`);
  }

  async function saveRevenue() {
    if (saving) return;
    const amount = revenueAmount.trim() ? Number.parseFloat(revenueAmount) : null;
    if (amount !== null && (!Number.isFinite(amount) || amount < 0)) {
      appFeedback.error(copy.invalidAmount);
      return;
    }

    setSaving(true);
    const res = await fetch(`/api/jobs/${jobId}/profitability`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ revenue_amount: amount, revenue_notes: revenueNotes })
    });
    const json = await res.json().catch(() => ({}));
    setSaving(false);

    if (!res.ok) {
      appFeedback.error(json.error || copy.unableToSave);
      return;
    }

    const next = json.profitability as JobProfitability;
    setProfitability(next);
    setRevenueAmount(next.manualRevenue ? String(next.manualRevenue) : '');
    setRevenueNotes(next.revenueNotes || '');
    appFeedback.success(copy.saveExpectedAmount);
  }

  async function submitPayment() {
    if (recording) return;
    const amount = Number.parseFloat(paymentAmount);
    if (!Number.isFinite(amount) || amount <= 0) {
      appFeedback.error(copy.invalidAmount);
      return;
    }

    setRecording(true);
    const res = await fetch(`/api/jobs/${jobId}/payments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        amount,
        paid_date: paymentDate,
        payment_method: paymentMethod,
        payment_reference: paymentReference.trim() || null,
        payment_notes: paymentNotes.trim() || null
      })
    });
    const json = await res.json().catch(() => ({}));
    setRecording(false);

    if (!res.ok) {
      appFeedback.error(json.error || copy.unableToRecord);
      return;
    }

    setProfitability(json.profitability as JobProfitability);
    setPaymentAmount('');
    setPaymentReference('');
    setPaymentNotes('');
    setShowPaymentForm(false);
    appFeedback.success(copy.paymentSaved);
  }

  async function removePayment(paymentId: string) {
    if (deletingId) return;
    setDeletingId(paymentId);
    const res = await fetch(`/api/jobs/${jobId}/payments/${paymentId}`, { method: 'DELETE' });
    const json = await res.json().catch(() => ({}));
    setDeletingId(null);
    setConfirmDeleteId(null);

    if (!res.ok) {
      appFeedback.error(json.error || copy.unableToRecord);
      return;
    }

    setProfitability(json.profitability as JobProfitability);
    appFeedback.success(copy.paymentDeleted);
  }

  if (loading) {
    return (
      <div className="card finance-card job-financials-card">
        <h3>{copy.sectionTitle}</h3>
        <p className="loading-state">{copy.loading}</p>
      </div>
    );
  }

  const p = profitability;
  const totalExpenses = p?.totalExpenses ?? (p?.laborCost || 0) + (p?.materialCost || 0) + (p?.otherExpenses || 0);

  return (
    <div className="card finance-card job-financials-card">
      <div className="job-financials-head">
        <div>
          <h3>{copy.sectionTitle}</h3>
          <p className="muted">{copy.sectionCopy}</p>
        </div>
        {canManage ? (
          <div className="button-row job-financials-actions">
            <button type="button" className="btn btn-primary" onClick={() => setShowPaymentForm(true)}>
              {copy.recordPayment}
            </button>
            <button type="button" className="btn" onClick={openCreateInvoice}>
              {copy.createInvoice}
            </button>
          </div>
        ) : null}
      </div>

      <div className="job-financials-section profit-summary-section">
        <h4>{copy.paymentStatus}</h4>
        <div className="finance-metric-grid financials-summary-grid">
          <div className="finance-metric featured">
            <span className="finance-metric-label">{copy.paymentStatus}</span>
            <strong>{paymentStatusLabel(p?.paymentStatus || 'no_amount_set', copy)}</strong>
          </div>
          <div className="finance-metric">
            <span className="finance-metric-label">{copy.expectedRevenue}</span>
            <strong>{formatCurrency(p?.expectedAmount || 0)}</strong>
          </div>
          <div className="finance-metric">
            <span className="finance-metric-label">{copy.collected}</span>
            <strong>{formatCurrency(p?.collectedAmount || 0)}</strong>
          </div>
          <div className="finance-metric">
            <span className="finance-metric-label">{copy.outstanding}</span>
            <strong>{formatCurrency(p?.outstanding || 0)}</strong>
          </div>
        </div>
        <p className="muted finance-note">{copy.paymentHelper}</p>
      </div>

      {canManage ? (
        <div className="job-financials-section">
          <h4>{copy.expectedJobAmount}</h4>
          <div className="finance-form-block compact-finance-form">
            <label htmlFor={`client-income-${jobId}`}>{copy.expectedJobAmount}</label>
            <input
              id={`client-income-${jobId}`}
              className="input"
              type="number"
              min="0"
              step="0.01"
              inputMode="decimal"
              placeholder="0.00"
              value={revenueAmount}
              onChange={(e) => setRevenueAmount(e.target.value)}
            />
            <label htmlFor={`client-income-notes-${jobId}`}>{copy.paymentNotes}</label>
            <textarea
              id={`client-income-notes-${jobId}`}
              className="input"
              rows={2}
              value={revenueNotes}
              onChange={(e) => setRevenueNotes(e.target.value)}
            />
            <p className="muted finance-note">{copy.saveExpectedAmountHelper}</p>
            <button type="button" className="btn" disabled={saving} onClick={() => void saveRevenue()}>
              {saving ? FEEDBACK.loading : copy.saveExpectedAmount}
            </button>
          </div>
        </div>
      ) : null}

      <div className="job-financials-section">
        <h4>{copy.expenses}</h4>
        <div className="finance-metric-grid financials-summary-grid">
          <div className="finance-metric">
            <span className="finance-metric-label">{copy.expenses}</span>
            <strong>{formatCurrency(totalExpenses)}</strong>
          </div>
          <div className="finance-metric">
            <span className="finance-metric-label">{copy.expectedProfit}</span>
            <strong>{formatCurrency(p?.expectedProfit || 0)}</strong>
          </div>
          <div className="finance-metric featured">
            <span className="finance-metric-label">{copy.collectedProfit}</span>
            <strong>{formatCurrency(p?.collectedProfit || 0)}</strong>
          </div>
          <div className="finance-metric">
            <span className="finance-metric-label">{copy.balanceDue}</span>
            <strong>{formatCurrency(p?.outstanding || 0)}</strong>
          </div>
        </div>
      </div>

      <div className="job-financials-section">
        <h4>{copy.paymentHistory}</h4>
        {!p?.payments?.length ? (
          <p className="muted">{copy.noPaymentsYet}</p>
        ) : (
          <ul className="payment-history-list">
            {p.payments.map((payment) => (
              <li key={`${payment.source}-${payment.id}`} className="payment-history-item">
                <div className="payment-history-main">
                  <strong>{formatCurrency(payment.amount)}</strong>
                  <span>{formatPaymentDate(payment.paidAt)}</span>
                  {payment.paymentMethod ? (
                    <span>{paymentMethodLabel(payment.paymentMethod, locale)}</span>
                  ) : null}
                  {payment.paymentReference ? <span>{payment.paymentReference}</span> : null}
                  <span className="muted">
                    {payment.source === 'invoice' ? copy.paymentViaInvoice : copy.paymentDirect}
                  </span>
                </div>
                {payment.notes ? <p className="muted payment-history-notes">{payment.notes}</p> : null}
                {canManage && payment.source === 'job' ? (
                  confirmDeleteId === payment.id ? (
                    <div className="payment-delete-confirm">
                      <p>{copy.deletePaymentConfirm}</p>
                      <div className="button-row">
                        <button
                          type="button"
                          className="btn btn-primary"
                          disabled={deletingId === payment.id}
                          onClick={() => void removePayment(payment.id)}
                        >
                          {deletingId === payment.id ? FEEDBACK.loading : copy.deletePayment}
                        </button>
                        <button type="button" className="btn" onClick={() => setConfirmDeleteId(null)}>
                          {copy.cancel}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button type="button" className="btn" onClick={() => setConfirmDeleteId(payment.id)}>
                      {copy.deletePayment}
                    </button>
                  )
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </div>

      {p?.hasInvoice ? (
        <div className="job-financials-section">
          <div className="button-row">
            <Link className="btn" href="/invoices">
              {copy.createInvoice}
            </Link>
          </div>
        </div>
      ) : null}

      {showPaymentForm && canManage ? (
        <div className="modal-backdrop job-payment-modal-backdrop" role="presentation" onClick={() => setShowPaymentForm(false)}>
          <div
            className="card job-payment-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby={`record-payment-${jobId}`}
            onClick={(e) => e.stopPropagation()}
          >
            <h4 id={`record-payment-${jobId}`}>{copy.recordPayment}</h4>
            <div className="finance-form-block compact-finance-form">
              <label htmlFor={`payment-amount-${jobId}`}>{copy.paymentAmount}</label>
              <input
                id={`payment-amount-${jobId}`}
                className="input"
                type="number"
                min="0"
                step="0.01"
                inputMode="decimal"
                value={paymentAmount}
                onChange={(e) => setPaymentAmount(e.target.value)}
              />
              <label htmlFor={`payment-date-${jobId}`}>{copy.paymentDate}</label>
              <input
                id={`payment-date-${jobId}`}
                className="input"
                type="date"
                value={paymentDate}
                onChange={(e) => setPaymentDate(e.target.value)}
              />
              <label htmlFor={`payment-method-${jobId}`}>{copy.paymentMethod}</label>
              <select
                id={`payment-method-${jobId}`}
                className="input"
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value)}
              >
                {CLIENT_PAYMENT_METHODS.map((method) => (
                  <option key={method} value={method}>
                    {paymentMethodLabel(method, locale)}
                  </option>
                ))}
              </select>
              <label htmlFor={`payment-ref-${jobId}`}>{copy.paymentReference}</label>
              <input
                id={`payment-ref-${jobId}`}
                className="input"
                value={paymentReference}
                onChange={(e) => setPaymentReference(e.target.value)}
              />
              <label htmlFor={`payment-notes-field-${jobId}`}>{copy.paymentNotes}</label>
              <textarea
                id={`payment-notes-field-${jobId}`}
                className="input"
                rows={2}
                value={paymentNotes}
                onChange={(e) => setPaymentNotes(e.target.value)}
              />
              <div className="button-row">
                <button type="button" className="btn btn-primary" disabled={recording} onClick={() => void submitPayment()}>
                  {recording ? FEEDBACK.loading : copy.recordPayment}
                </button>
                <button type="button" className="btn" onClick={() => setShowPaymentForm(false)}>
                  {copy.cancel}
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
