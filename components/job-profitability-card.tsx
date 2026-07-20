'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAppFeedback } from '@/components/feedback/use-app-feedback';
import { useTranslation } from '@/components/locale-provider';
import { FEEDBACK } from '@/lib/feedback-labels';
import { CLIENT_PAYMENT_METHODS } from '@/lib/finance/job-payments';
import { formatCurrency } from '@/lib/finance-format';
import type { JobPaymentHistoryEntry, JobPaymentStatus, JobProfitability } from '@/lib/finance-types';
import { getJobFinanceCopy, paymentMethodLabel } from '@/lib/i18n/job-finance-copy';

type JobProfitabilityCardProps = {
  jobId: string;
  customerId?: string | null;
  canManage: boolean;
  refreshKey?: number;
};

type PaymentFormState = {
  id?: string;
  amount: string;
  paidDate: string;
  method: string;
  reference: string;
  notes: string;
};

function todayInputValue() {
  return new Date().toISOString().slice(0, 10);
}

function formatPaymentDate(value: string) {
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date.toLocaleDateString() : value;
}

function dateInputValue(value: string) {
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date.toISOString().slice(0, 10) : todayInputValue();
}

function paymentStatusLabel(status: JobPaymentStatus) {
  if (status === 'unpaid') return 'Not paid';
  if (status === 'partially_paid') return 'Partially paid';
  if (status === 'paid') return 'Paid';
  return 'Amount not set';
}

function emptyPaymentForm(): PaymentFormState {
  return {
    amount: '',
    paidDate: todayInputValue(),
    method: CLIENT_PAYMENT_METHODS[0],
    reference: '',
    notes: ''
  };
}

export function JobProfitabilityCard({ jobId, customerId, canManage, refreshKey = 0 }: JobProfitabilityCardProps) {
  const router = useRouter();
  const appFeedback = useAppFeedback();
  const { locale } = useTranslation();
  const copy = getJobFinanceCopy(locale);
  const [profitability, setProfitability] = useState<JobProfitability | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savingPayment, setSavingPayment] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [showPaymentForm, setShowPaymentForm] = useState(false);
  const [paymentForm, setPaymentForm] = useState<PaymentFormState>(emptyPaymentForm());
  const [revenueAmount, setRevenueAmount] = useState('');
  const [revenueNotes, setRevenueNotes] = useState('');

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

  function openAddPayment() {
    setPaymentForm(emptyPaymentForm());
    setShowPaymentForm(true);
  }

  function openEditPayment(payment: JobPaymentHistoryEntry) {
    setPaymentForm({
      id: payment.id,
      amount: String(payment.amount),
      paidDate: dateInputValue(payment.paidAt),
      method: payment.paymentMethod || CLIENT_PAYMENT_METHODS[0],
      reference: payment.paymentReference || '',
      notes: payment.notes || ''
    });
    setShowPaymentForm(true);
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
    if (savingPayment) return;
    const amount = Number.parseFloat(paymentForm.amount);
    if (!Number.isFinite(amount) || amount <= 0) {
      appFeedback.error(copy.invalidAmount);
      return;
    }

    setSavingPayment(true);
    const editing = Boolean(paymentForm.id);
    const endpoint = editing
      ? `/api/jobs/${jobId}/payments/${paymentForm.id}`
      : `/api/jobs/${jobId}/payments`;
    const res = await fetch(endpoint, {
      method: editing ? 'PATCH' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        amount,
        paid_date: paymentForm.paidDate,
        payment_method: paymentForm.method,
        payment_reference: paymentForm.reference.trim() || null,
        payment_notes: paymentForm.notes.trim() || null
      })
    });
    const json = await res.json().catch(() => ({}));
    setSavingPayment(false);

    if (!res.ok) {
      appFeedback.error(json.error || copy.unableToRecord);
      return;
    }

    setProfitability(json.profitability as JobProfitability);
    setShowPaymentForm(false);
    setPaymentForm(emptyPaymentForm());
    appFeedback.success(editing ? 'Client payment updated.' : 'Client payment added.');

    if (!editing) {
      const payments = (json.payments || []) as JobPaymentHistoryEntry[];
      const newestDirectPayment = payments.find((payment) => payment.source === 'job');
      if (newestDirectPayment) {
        router.push(`/jobs/${jobId}/receipts/job/${newestDirectPayment.id}`);
      }
    }
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
    appFeedback.success('Client payment removed.');
  }

  if (loading) {
    return (
      <div className="card finance-card job-financials-card">
        <h3>Payments & Profit</h3>
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
          <h3>Payments & Profit</h3>
          <p className="muted">See what the client should pay, what they paid, expenses, and profit.</p>
        </div>
        {canManage ? (
          <div className="button-row job-financials-actions">
            <button type="button" className="btn btn-primary" onClick={openAddPayment}>
              Add client payment
            </button>
            <button type="button" className="btn" onClick={openCreateInvoice}>
              Create invoice
            </button>
          </div>
        ) : null}
      </div>

      <div className="job-financials-section profit-summary-section">
        <h4>Client payment status</h4>
        <div className="finance-metric-grid financials-summary-grid">
          <div className="finance-metric featured">
            <span className="finance-metric-label">Client payment status</span>
            <strong>{paymentStatusLabel(p?.paymentStatus || 'no_amount_set')}</strong>
          </div>
          <div className="finance-metric">
            <span className="finance-metric-label">Client should pay</span>
            <strong>{formatCurrency(p?.expectedAmount || 0)}</strong>
          </div>
          <div className="finance-metric">
            <span className="finance-metric-label">Client paid</span>
            <strong>{formatCurrency(p?.collectedAmount || 0)}</strong>
          </div>
          <div className="finance-metric">
            <span className="finance-metric-label">Still owed</span>
            <strong>{formatCurrency(p?.outstanding || 0)}</strong>
          </div>
        </div>
        <p className="muted finance-note">Add a client payment even when the invoice was created outside EverittOS.</p>
      </div>

      {canManage ? (
        <div className="job-financials-section">
          <h4>Expected job amount</h4>
          <div className="finance-form-block compact-finance-form">
            <label htmlFor={`client-income-${jobId}`}>What should the client pay?</label>
            <input
              id={`client-income-${jobId}`}
              className="input"
              type="number"
              min="0"
              step="0.01"
              inputMode="decimal"
              placeholder="0.00"
              value={revenueAmount}
              onChange={(event) => setRevenueAmount(event.target.value)}
            />
            <label htmlFor={`client-income-notes-${jobId}`}>Notes (optional)</label>
            <textarea
              id={`client-income-notes-${jobId}`}
              className="input"
              rows={2}
              value={revenueNotes}
              onChange={(event) => setRevenueNotes(event.target.value)}
            />
            <button type="button" className="btn" disabled={saving} onClick={() => void saveRevenue()}>
              {saving ? FEEDBACK.loading : 'Save expected amount'}
            </button>
          </div>
        </div>
      ) : null}

      <div className="job-financials-section">
        <h4>Expenses and profit</h4>
        <div className="finance-metric-grid financials-summary-grid">
          <div className="finance-metric">
            <span className="finance-metric-label">Expenses</span>
            <strong>{formatCurrency(totalExpenses)}</strong>
          </div>
          <div className="finance-metric">
            <span className="finance-metric-label">Expected profit</span>
            <strong>{formatCurrency(p?.expectedProfit || 0)}</strong>
          </div>
          <div className="finance-metric featured">
            <span className="finance-metric-label">Profit from money received</span>
            <strong>{formatCurrency(p?.collectedProfit || 0)}</strong>
          </div>
          <div className="finance-metric">
            <span className="finance-metric-label">Still owed</span>
            <strong>{formatCurrency(p?.outstanding || 0)}</strong>
          </div>
        </div>
      </div>

      <div className="job-financials-section">
        <h4>Client payment history</h4>
        {!p?.payments?.length ? (
          <p className="muted">No client payments added yet.</p>
        ) : (
          <ul className="payment-history-list">
            {p.payments.map((payment) => (
              <li key={`${payment.source}-${payment.id}`} className="payment-history-item">
                <div className="payment-history-main">
                  <strong>{formatCurrency(payment.amount)}</strong>
                  <span>{formatPaymentDate(payment.paidAt)}</span>
                  {payment.paymentMethod ? <span>{paymentMethodLabel(payment.paymentMethod, locale)}</span> : null}
                  {payment.paymentReference ? <span>{payment.paymentReference}</span> : null}
                  <span className="muted">{payment.source === 'invoice' ? 'Paid through invoice' : 'Direct client payment'}</span>
                </div>
                {payment.notes ? <p className="muted payment-history-notes">{payment.notes}</p> : null}
                <div className="button-row">
                  <Link className="btn" href={`/jobs/${jobId}/receipts/${payment.source}/${payment.id}`}>
                    View receipt
                  </Link>
                  {canManage && payment.source === 'job' ? (
                    <button type="button" className="btn" onClick={() => openEditPayment(payment)}>
                      Edit
                    </button>
                  ) : null}
                  {canManage && payment.source === 'job' ? (
                    confirmDeleteId === payment.id ? (
                      <>
                        <button
                          type="button"
                          className="btn btn-primary"
                          disabled={deletingId === payment.id}
                          onClick={() => void removePayment(payment.id)}
                        >
                          {deletingId === payment.id ? FEEDBACK.loading : 'Confirm remove'}
                        </button>
                        <button type="button" className="btn" onClick={() => setConfirmDeleteId(null)}>
                          Cancel
                        </button>
                      </>
                    ) : (
                      <button type="button" className="btn" onClick={() => setConfirmDeleteId(payment.id)}>
                        Remove
                      </button>
                    )
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {showPaymentForm && canManage ? (
        <div className="modal-backdrop job-payment-modal-backdrop" role="presentation" onClick={() => setShowPaymentForm(false)}>
          <div
            className="card job-payment-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby={`client-payment-${jobId}`}
            onClick={(event) => event.stopPropagation()}
          >
            <h4 id={`client-payment-${jobId}`}>{paymentForm.id ? 'Edit client payment' : 'Add client payment'}</h4>
            <div className="finance-form-block compact-finance-form">
              <label htmlFor={`payment-amount-${jobId}`}>Amount</label>
              <input
                id={`payment-amount-${jobId}`}
                className="input"
                type="number"
                min="0"
                step="0.01"
                inputMode="decimal"
                value={paymentForm.amount}
                onChange={(event) => setPaymentForm((current) => ({ ...current, amount: event.target.value }))}
              />
              <label htmlFor={`payment-date-${jobId}`}>Date paid</label>
              <input
                id={`payment-date-${jobId}`}
                className="input"
                type="date"
                value={paymentForm.paidDate}
                onChange={(event) => setPaymentForm((current) => ({ ...current, paidDate: event.target.value }))}
              />
              <label htmlFor={`payment-method-${jobId}`}>How did the client pay?</label>
              <select
                id={`payment-method-${jobId}`}
                className="input"
                value={paymentForm.method}
                onChange={(event) => setPaymentForm((current) => ({ ...current, method: event.target.value }))}
              >
                {CLIENT_PAYMENT_METHODS.map((method) => (
                  <option key={method} value={method}>
                    {paymentMethodLabel(method, locale)}
                  </option>
                ))}
              </select>
              <label htmlFor={`payment-ref-${jobId}`}>Reference (optional)</label>
              <input
                id={`payment-ref-${jobId}`}
                className="input"
                value={paymentForm.reference}
                onChange={(event) => setPaymentForm((current) => ({ ...current, reference: event.target.value }))}
              />
              <label htmlFor={`payment-notes-field-${jobId}`}>Notes (optional)</label>
              <textarea
                id={`payment-notes-field-${jobId}`}
                className="input"
                rows={2}
                value={paymentForm.notes}
                onChange={(event) => setPaymentForm((current) => ({ ...current, notes: event.target.value }))}
              />
              <div className="button-row">
                <button type="button" className="btn btn-primary" disabled={savingPayment} onClick={() => void submitPayment()}>
                  {savingPayment ? FEEDBACK.loading : paymentForm.id ? 'Save changes' : 'Add client payment'}
                </button>
                <button type="button" className="btn" onClick={() => setShowPaymentForm(false)}>
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
