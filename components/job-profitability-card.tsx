'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAppFeedback } from '@/components/feedback/use-app-feedback';
import { FEEDBACK } from '@/lib/feedback-labels';
import { formatCurrency } from '@/lib/finance-format';
import type { JobProfitability } from '@/lib/finance-types';

type JobProfitabilityCardProps = {
  jobId: string;
  customerId?: string | null;
  canManage: boolean;
  refreshKey?: number;
};

export function JobProfitabilityCard({ jobId, customerId, canManage, refreshKey = 0 }: JobProfitabilityCardProps) {
  const router = useRouter();
  const appFeedback = useAppFeedback();
  const [profitability, setProfitability] = useState<JobProfitability | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [revenueAmount, setRevenueAmount] = useState('');
  const [revenueNotes, setRevenueNotes] = useState('');

  const loadFinancials = useCallback(async () => {
    setLoading(true);
    const res = await fetch(`/api/jobs/${jobId}/profitability`);
    const json = await res.json().catch(() => ({}));
    setLoading(false);
    if (!res.ok) {
      appFeedback.error(json.error || 'Unable to load job financials.');
      return;
    }
    const next = json.profitability as JobProfitability;
    setProfitability(next);
    setRevenueAmount(next.manualRevenue ? String(next.manualRevenue) : '');
    setRevenueNotes(next.revenueNotes || '');
  }, [appFeedback, jobId]);

  useEffect(() => {
    void loadFinancials();
  }, [loadFinancials, refreshKey]);

  function openSendInvoice() {
    const params = new URLSearchParams({ jobId });
    if (customerId) params.set('customerId', customerId);
    router.push(`/invoices?${params.toString()}`);
  }

  async function saveRevenue() {
    if (saving) return;
    const amount = revenueAmount.trim() ? Number.parseFloat(revenueAmount) : null;
    if (amount !== null && (!Number.isFinite(amount) || amount < 0)) {
      appFeedback.error('Enter a valid client income amount.');
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
      appFeedback.error(json.error || 'Unable to save client income.');
      return;
    }

    const next = json.profitability as JobProfitability;
    setProfitability(next);
    setRevenueAmount(next.manualRevenue ? String(next.manualRevenue) : '');
    setRevenueNotes(next.revenueNotes || '');
    appFeedback.success('Client income saved.');
  }

  async function recordPayment() {
    if (saving) return;
    const paid = Number.parseFloat(paymentAmount);
    if (!Number.isFinite(paid) || paid <= 0) {
      appFeedback.error('Enter a valid payment amount.');
      return;
    }

    const invRes = await fetch(`/api/invoices?jobId=${jobId}`);
    const invJson = await invRes.json().catch(() => ({}));
    const invoice = invJson.invoices?.[0];
    if (!invoice) {
      appFeedback.error('Add an invoice before recording a payment.');
      return;
    }

    setSaving(true);
    const newPaid = Number(invoice.amount_paid || 0) + paid;
    const res = await fetch(`/api/invoices/${invoice.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ amount_paid: newPaid })
    });
    const json = await res.json().catch(() => ({}));
    setSaving(false);

    if (!res.ok) {
      appFeedback.error(json.error || 'Unable to record payment.');
      return;
    }

    appFeedback.label('paymentRecorded');
    setPaymentAmount('');
    void loadFinancials();
  }

  if (loading) {
    return (
      <div className="card finance-card job-financials-card">
        <h3>Client income and profit</h3>
        <p className="loading-state">Loading...</p>
      </div>
    );
  }

  const p = profitability;
  const revenue = p?.revenueBasis || 0;
  const laborCost = p?.laborCost || 0;
  const materialCost = p?.materialCost || 0;
  const otherExpenses = p?.otherExpenses || 0;
  const totalCosts = laborCost + materialCost + otherExpenses;
  const estimatedProfit = p?.estimatedProfit || 0;
  const profitMargin = revenue > 0 ? (estimatedProfit / revenue) * 100 : 0;
  const hasRevenue = Boolean(p && (p.hasInvoice || p.manualRevenue > 0));
  const typedRevenue = revenueAmount.trim() ? Number.parseFloat(revenueAmount) : 0;
  const liveRevenue = Number.isFinite(typedRevenue) ? typedRevenue : revenue;
  const liveProfit = liveRevenue - totalCosts;
  const liveMargin = liveRevenue > 0 ? (liveProfit / liveRevenue) * 100 : 0;

  return (
    <div className="card finance-card job-financials-card">
      <div className="job-financials-head">
        <div>
          <h3>Client income and profit</h3>
          <p className="muted">Client income is the amount the customer pays your business. Contractor pay is entered separately in the Contractor pay card below.</p>
        </div>
        {canManage ? <button type="button" className="btn" onClick={openSendInvoice}>Send invoice</button> : null}
      </div>

      <div className="job-financials-section">
        <h4>Client income</h4>
        {canManage ? (
          <div className="finance-form-block compact-finance-form">
            <label htmlFor={`client-income-${jobId}`}>Amount customer pays you</label>
            <div className="finance-inline-form">
              <input
                id={`client-income-${jobId}`}
                className="input"
                type="number"
                min="0"
                step="0.01"
                placeholder="0.00"
                value={revenueAmount}
                onChange={(e) => setRevenueAmount(e.target.value)}
              />
              <button type="button" className="btn btn-primary" disabled={saving} onClick={() => void saveRevenue()}>
                {saving ? FEEDBACK.loading : 'Save client income'}
              </button>
            </div>
            <textarea
              className="input"
              rows={2}
              placeholder="Optional client income notes"
              value={revenueNotes}
              onChange={(e) => setRevenueNotes(e.target.value)}
            />
            {!p?.hasInvoice ? <p className="muted finance-note">Use this only when there is no invoice yet.</p> : null}
          </div>
        ) : null}

        {!hasRevenue ? (
          <div className="finance-empty-block">
            <p>No client income or invoice yet.</p>
          </div>
        ) : (
          <div className="finance-metric-grid financials-summary-grid">
            {p?.hasInvoice ? (
              <>
                <div className="finance-metric"><span className="finance-metric-label">Invoice total</span><strong>{formatCurrency(p.invoiceTotal)}</strong></div>
                <div className="finance-metric"><span className="finance-metric-label">Payments received</span><strong>{formatCurrency(p.paymentsReceived)}</strong></div>
                <div className="finance-metric"><span className="finance-metric-label">Outstanding</span><strong>{formatCurrency(p.outstanding)}</strong></div>
              </>
            ) : (
              <div className="finance-metric"><span className="finance-metric-label">Saved client income</span><strong>{formatCurrency(p?.manualRevenue || 0)}</strong></div>
            )}
          </div>
        )}
      </div>

      <div className="job-financials-section">
        <h4>Costs already recorded</h4>
        <div className="finance-metric-grid financials-summary-grid">
          <div className="finance-metric"><span className="finance-metric-label">Contractor pay</span><strong>{formatCurrency(laborCost)}</strong></div>
          <div className="finance-metric"><span className="finance-metric-label">Materials and supplies</span><strong>{formatCurrency(materialCost)}</strong></div>
          <div className="finance-metric"><span className="finance-metric-label">Other expenses</span><strong>{formatCurrency(otherExpenses)}</strong></div>
          <div className="finance-metric"><span className="finance-metric-label">Total costs</span><strong>{formatCurrency(totalCosts)}</strong></div>
        </div>
      </div>

      <div className="job-financials-section profit-summary-section">
        <h4>Profit summary</h4>
        <div className="finance-metric-grid financials-summary-grid">
          <div className="finance-metric featured"><span className="finance-metric-label">Saved estimated profit</span><strong>{formatCurrency(estimatedProfit)}</strong></div>
          <div className="finance-metric"><span className="finance-metric-label">Saved margin</span><strong>{revenue > 0 ? `${profitMargin.toFixed(1)}%` : '0%'}</strong></div>
          {canManage && revenueAmount.trim() ? (
            <>
              <div className="finance-metric"><span className="finance-metric-label">Live profit preview</span><strong>{formatCurrency(liveProfit)}</strong></div>
              <div className="finance-metric"><span className="finance-metric-label">Live margin preview</span><strong>{liveRevenue > 0 ? `${liveMargin.toFixed(1)}%` : '0%'}</strong></div>
            </>
          ) : null}
        </div>
        <p className="muted finance-note">Profit equals client income minus contractor pay and other job costs.</p>
      </div>

      {p?.hasInvoice ? (
        <div className="job-financials-section">
          <h4>Record client payment</h4>
          <div className="finance-inline-form">
            <input className="input" type="number" min="0" step="0.01" placeholder="Payment amount" value={paymentAmount} onChange={(e) => setPaymentAmount(e.target.value)} />
            <button type="button" className="btn" disabled={saving} onClick={() => void recordPayment()}>Record payment</button>
          </div>
          <Link className="muted-link" href="/invoices">View invoices</Link>
        </div>
      ) : null}
    </div>
  );
}
