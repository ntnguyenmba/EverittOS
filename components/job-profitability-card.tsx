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
};

export function JobProfitabilityCard({ jobId, customerId, canManage }: JobProfitabilityCardProps) {
  const router = useRouter();
  const appFeedback = useAppFeedback();
  const [profitability, setProfitability] = useState<JobProfitability | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [revenueAmount, setRevenueAmount] = useState('');
  const [revenueNotes, setRevenueNotes] = useState('');
  const [contractorName, setContractorName] = useState('');
  const [contractorPay, setContractorPay] = useState('');
  const [contractorNotes, setContractorNotes] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch(`/api/jobs/${jobId}/profitability`);
    const json = await res.json();
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
    void load();
  }, [load]);

  function openSendInvoice() {
    const params = new URLSearchParams({ jobId });
    if (customerId) params.set('customerId', customerId);
    router.push(`/invoices?${params.toString()}`);
  }

  async function saveRevenue() {
    if (saving) return;
    const amount = revenueAmount.trim() ? Number.parseFloat(revenueAmount) : null;
    if (amount !== null && (!Number.isFinite(amount) || amount < 0)) {
      appFeedback.error('Enter a valid client revenue amount.');
      return;
    }
    setSaving(true);
    const res = await fetch(`/api/jobs/${jobId}/profitability`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ revenue_amount: amount, revenue_notes: revenueNotes })
    });
    const json = await res.json();
    setSaving(false);
    if (!res.ok) {
      appFeedback.error(json.error || 'Unable to save revenue.');
      return;
    }
    setProfitability(json.profitability as JobProfitability);
    appFeedback.success('Client income saved.');
  }

  async function saveContractorPay() {
    if (saving) return;
    const amount = Number.parseFloat(contractorPay);
    if (!Number.isFinite(amount) || amount <= 0) {
      appFeedback.error('Enter a valid contractor pay amount.');
      return;
    }

    setSaving(true);
    const res = await fetch(`/api/jobs/${jobId}/labor`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        worker_name: contractorName.trim() || 'Contractor',
        hours: 1,
        hourly_cost: amount,
        notes: contractorNotes.trim() || 'Contractor pay entered from Job Financials'
      })
    });
    const json = await res.json();
    setSaving(false);
    if (!res.ok) {
      appFeedback.error(json.error || 'Unable to save contractor pay.');
      return;
    }
    setContractorName('');
    setContractorPay('');
    setContractorNotes('');
    appFeedback.success('Contractor pay saved.');
    void load();
  }

  async function recordPayment() {
    if (saving) return;
    const paid = Number.parseFloat(paymentAmount);
    if (!Number.isFinite(paid) || paid <= 0) {
      appFeedback.error('Enter a valid payment amount.');
      return;
    }

    const invRes = await fetch(`/api/invoices?jobId=${jobId}`);
    const invJson = await invRes.json();
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
    const json = await res.json();
    setSaving(false);

    if (!res.ok) {
      appFeedback.error(json.error || 'Unable to record payment.');
      return;
    }

    appFeedback.label('paymentRecorded');
    setPaymentAmount('');
    void load();
  }

  if (loading) {
    return (
      <div className="card finance-card job-financials-card">
        <h3>Job Financials</h3>
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

  return (
    <div className="card finance-card job-financials-card">
      <div className="job-financials-head">
        <div>
          <h3>Job Financials</h3>
          <p className="muted">Track what the client pays, what contractors cost, and the estimated profit for this job.</p>
        </div>
        {canManage ? <button type="button" className="btn" onClick={openSendInvoice}>Send invoice</button> : null}
      </div>

      <div className="job-financials-section">
        <h4>Income</h4>
        {canManage ? (
          <div className="finance-form-block compact-finance-form">
            <label>Client income</label>
            <div className="finance-inline-form">
              <input
                className="input"
                type="number"
                min="0"
                step="0.01"
                placeholder="0.00"
                value={revenueAmount}
                onChange={(e) => setRevenueAmount(e.target.value)}
              />
              <button type="button" className="btn btn-primary" disabled={saving} onClick={() => void saveRevenue()}>
                {saving ? FEEDBACK.loading : 'Save income'}
              </button>
            </div>
            <textarea
              className="input"
              rows={2}
              placeholder="Optional income notes"
              value={revenueNotes}
              onChange={(e) => setRevenueNotes(e.target.value)}
            />
            {!p?.hasInvoice ? <p className="muted finance-note">Use this when there is no invoice yet.</p> : null}
          </div>
        ) : null}

        {!hasRevenue ? (
          <div className="finance-empty-block">
            <p>No client income or invoice yet. Add income or send an invoice to calculate profit.</p>
          </div>
        ) : (
          <div className="finance-metric-grid financials-summary-grid">
            {p?.hasInvoice ? (
              <>
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
              </>
            ) : (
              <div className="finance-metric">
                <span className="finance-metric-label">Client income</span>
                <strong>{formatCurrency(p?.manualRevenue || 0)}</strong>
              </div>
            )}
          </div>
        )}
      </div>

      {canManage ? (
        <div className="job-financials-section">
          <h4>Contractor pay</h4>
          <div className="finance-form-block compact-finance-form">
            <label>Contractor or cleaner name</label>
            <input className="input" placeholder="Chelsea Garcia" value={contractorName} onChange={(e) => setContractorName(e.target.value)} />
            <label>Amount paid</label>
            <input className="input" type="number" min="0" step="0.01" placeholder="0.00" value={contractorPay} onChange={(e) => setContractorPay(e.target.value)} />
            <label>Notes</label>
            <input className="input" placeholder="Optional notes" value={contractorNotes} onChange={(e) => setContractorNotes(e.target.value)} />
            <button type="button" className="btn btn-primary" disabled={saving} onClick={() => void saveContractorPay()}>
              {saving ? FEEDBACK.loading : 'Add contractor pay'}
            </button>
          </div>
        </div>
      ) : null}

      <div className="job-financials-section">
        <h4>Costs</h4>
        <div className="finance-metric-grid financials-summary-grid">
          <div className="finance-metric">
            <span className="finance-metric-label">Contractor / labor</span>
            <strong>{formatCurrency(laborCost)}</strong>
          </div>
          <div className="finance-metric">
            <span className="finance-metric-label">Materials / supplies</span>
            <strong>{formatCurrency(materialCost)}</strong>
          </div>
          <div className="finance-metric">
            <span className="finance-metric-label">Other expenses</span>
            <strong>{formatCurrency(otherExpenses)}</strong>
          </div>
          <div className="finance-metric">
            <span className="finance-metric-label">Total costs</span>
            <strong>{formatCurrency(totalCosts)}</strong>
          </div>
        </div>
      </div>

      <div className="job-financials-section">
        <h4>Summary</h4>
        <div className="finance-metric-grid financials-summary-grid">
          <div className="finance-metric">
            <span className="finance-metric-label">Revenue</span>
            <strong>{formatCurrency(revenue)}</strong>
          </div>
          <div className="finance-metric">
            <span className="finance-metric-label">Total costs</span>
            <strong>{formatCurrency(totalCosts)}</strong>
          </div>
          <div className="finance-metric finance-metric-highlight">
            <span className="finance-metric-label">Estimated profit</span>
            <strong className={estimatedProfit >= 0 ? 'finance-positive' : 'finance-negative'}>{formatCurrency(estimatedProfit)}</strong>
          </div>
          <div className="finance-metric finance-metric-highlight">
            <span className="finance-metric-label">Profit margin</span>
            <strong className={estimatedProfit >= 0 ? 'finance-positive' : 'finance-negative'}>{revenue > 0 ? `${profitMargin.toFixed(1)}%` : 'Not ready'}</strong>
          </div>
        </div>
      </div>

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
              {saving ? FEEDBACK.loading : 'Record payment'}
            </button>
          </div>
        </div>
      ) : null}

      <div className="finance-actions financials-link-row">
        <Link className="btn" href={`/expenses?jobId=${jobId}`}>View expenses</Link>
        <Link className="btn" href={`/invoices?jobId=${jobId}${customerId ? `&customerId=${customerId}` : ''}`}>Invoice history</Link>
      </div>
    </div>
  );
}
