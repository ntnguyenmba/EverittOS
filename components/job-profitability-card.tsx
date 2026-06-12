'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { ActionFeedbackBanner } from '@/components/action-feedback';
import { errorFeedback, successFeedback, type ActionFeedback } from '@/lib/action-messages';
import { formatCurrency } from '@/lib/finance-format';
import type { JobProfitability } from '@/lib/finance-types';

type JobProfitabilityCardProps = {
  jobId: string;
  customerId?: string | null;
  canManage: boolean;
};

export function JobProfitabilityCard({ jobId, customerId, canManage }: JobProfitabilityCardProps) {
  const [profitability, setProfitability] = useState<JobProfitability | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showInvoiceForm, setShowInvoiceForm] = useState(false);
  const [invoiceAmount, setInvoiceAmount] = useState('');
  const [paymentAmount, setPaymentAmount] = useState('');
  const [feedback, setFeedback] = useState<ActionFeedback | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch(`/api/jobs/${jobId}/profitability`);
    const json = await res.json();
    setLoading(false);
    if (!res.ok) {
      setFeedback(errorFeedback(json.error || 'Unable to load profitability.'));
      return;
    }
    setProfitability(json.profitability);
  }, [jobId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function saveInvoice() {
    if (saving) return;
    const amount = Number.parseFloat(invoiceAmount);
    const paid = Number.parseFloat(paymentAmount || '0');
    if (!Number.isFinite(amount) || amount <= 0) {
      setFeedback(errorFeedback('Enter a valid invoice amount.'));
      return;
    }

    setSaving(true);
    setFeedback(null);
    const res = await fetch('/api/invoices', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        job_id: jobId,
        customer_id: customerId || null,
        amount,
        amount_paid: Number.isFinite(paid) ? paid : 0
      })
    });
    const json = await res.json();
    setSaving(false);

    if (!res.ok) {
      setFeedback(errorFeedback(json.error || 'Unable to save invoice.'));
      return;
    }

    setFeedback(successFeedback('Invoice saved.'));
    setShowInvoiceForm(false);
    setInvoiceAmount('');
    setPaymentAmount('');
    void load();
  }

  async function recordPayment() {
    if (saving) return;
    const paid = Number.parseFloat(paymentAmount);
    if (!Number.isFinite(paid) || paid <= 0) {
      setFeedback(errorFeedback('Enter a valid payment amount.'));
      return;
    }

    const invRes = await fetch(`/api/invoices?jobId=${jobId}`);
    const invJson = await invRes.json();
    const invoice = invJson.invoices?.[0];
    if (!invoice) {
      setFeedback(errorFeedback('Add an invoice before recording a payment.'));
      return;
    }

    setSaving(true);
    setFeedback(null);
    const newPaid = Number(invoice.amount_paid || 0) + paid;
    const res = await fetch(`/api/invoices/${invoice.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ amount_paid: newPaid })
    });
    const json = await res.json();
    setSaving(false);

    if (!res.ok) {
      setFeedback(errorFeedback(json.error || 'Unable to record payment.'));
      return;
    }

    setFeedback(successFeedback('Payment recorded.'));
    setPaymentAmount('');
    void load();
  }

  if (loading) {
    return (
      <div className="card finance-card">
        <h3>Job profitability</h3>
        <p className="loading-state">Loading...</p>
      </div>
    );
  }

  const p = profitability;
  const hasCosts = Boolean(p && (p.laborCost > 0 || p.materialCost > 0 || p.otherExpenses > 0));

  return (
    <div className="card finance-card">
      <h3>Job profitability</h3>
      <p className="muted">Simple estimated profit for this job. Not full accounting.</p>

      <ActionFeedbackBanner feedback={feedback} onDismiss={() => setFeedback(null)} />

      {!p?.hasInvoice ? (
        <div className="finance-empty-block">
          <p>No invoice yet. Add invoice or payment to calculate profit.</p>
          {canManage ? (
            <button type="button" className="btn btn-primary" onClick={() => setShowInvoiceForm((v) => !v)}>
              {showInvoiceForm ? 'Cancel' : 'Add invoice'}
            </button>
          ) : null}
        </div>
      ) : (
        <div className="finance-metric-grid">
          <div className="finance-metric">
            <span className="finance-metric-label">Invoice total</span>
            <strong>{formatCurrency(p.invoiceTotal)}</strong>
          </div>
          <div className="finance-metric">
            <span className="finance-metric-label">Payments received</span>
            <strong>{formatCurrency(p.paymentsReceived)}</strong>
          </div>
          <div className="finance-metric">
            <span className="finance-metric-label">Outstanding</span>
            <strong>{formatCurrency(p.outstanding)}</strong>
          </div>
          <div className="finance-metric">
            <span className="finance-metric-label">Labor cost</span>
            <strong>{formatCurrency(p.laborCost)}</strong>
          </div>
          <div className="finance-metric">
            <span className="finance-metric-label">Material cost</span>
            <strong>{formatCurrency(p.materialCost)}</strong>
          </div>
          <div className="finance-metric">
            <span className="finance-metric-label">Other expenses</span>
            <strong>{formatCurrency(p.otherExpenses)}</strong>
          </div>
          <div className="finance-metric finance-metric-highlight">
            <span className="finance-metric-label">Estimated profit</span>
            <strong className={p.estimatedProfit >= 0 ? 'finance-positive' : 'finance-negative'}>
              {formatCurrency(p.estimatedProfit)}
            </strong>
          </div>
        </div>
      )}

      {p?.hasInvoice && !hasCosts ? (
        <p className="muted finance-note">No expenses added for this job.</p>
      ) : null}

      {canManage && p?.hasInvoice ? (
        <div className="finance-actions">
          <label>Record payment</label>
          <div className="finance-inline-form">
            <input
              className="input"
              type="number"
              min="0"
              step="0.01"
              placeholder="0.00"
              value={paymentAmount}
              onChange={(e) => setPaymentAmount(e.target.value)}
            />
            <button type="button" className="btn btn-primary" disabled={saving} onClick={() => void recordPayment()}>
              {saving ? 'Saving...' : 'Record payment'}
            </button>
          </div>
        </div>
      ) : null}

      {canManage && showInvoiceForm ? (
        <div className="finance-form-block">
          <label>Invoice amount</label>
          <input
            className="input"
            type="number"
            min="0"
            step="0.01"
            value={invoiceAmount}
            onChange={(e) => setInvoiceAmount(e.target.value)}
          />
          <label>Payment received (optional)</label>
          <input
            className="input"
            type="number"
            min="0"
            step="0.01"
            value={paymentAmount}
            onChange={(e) => setPaymentAmount(e.target.value)}
          />
          <button type="button" className="btn btn-primary" disabled={saving} onClick={() => void saveInvoice()}>
            {saving ? 'Saving...' : 'Save invoice'}
          </button>
        </div>
      ) : null}

      <div className="finance-actions">
        <Link className="btn" href={`/expenses?jobId=${jobId}`}>
          View job expenses
        </Link>
      </div>
    </div>
  );
}
