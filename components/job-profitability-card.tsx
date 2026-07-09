'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAppFeedback } from '@/components/feedback/use-app-feedback';
import { FEEDBACK } from '@/lib/feedback-labels';
import { formatCurrency } from '@/lib/finance-format';
import type { JobLaborRecord, JobProfitability } from '@/lib/finance-types';

type JobProfitabilityCardProps = {
  jobId: string;
  customerId?: string | null;
  canManage: boolean;
  refreshKey?: number;
};

type PayMode = 'hourly' | 'flat';

export function JobProfitabilityCard({ jobId, customerId, canManage, refreshKey = 0 }: JobProfitabilityCardProps) {
  const router = useRouter();
  const appFeedback = useAppFeedback();
  const [profitability, setProfitability] = useState<JobProfitability | null>(null);
  const [laborEntries, setLaborEntries] = useState<JobLaborRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [revenueAmount, setRevenueAmount] = useState('');
  const [revenueNotes, setRevenueNotes] = useState('');
  const [contractorName, setContractorName] = useState('');
  const [payMode, setPayMode] = useState<PayMode>('flat');
  const [contractorPay, setContractorPay] = useState('');
  const [contractorHours, setContractorHours] = useState('');
  const [visitCount, setVisitCount] = useState('1');
  const [contractorNotes, setContractorNotes] = useState('');
  const [editWorkerName, setEditWorkerName] = useState('');
  const [editHours, setEditHours] = useState('');
  const [editHourlyCost, setEditHourlyCost] = useState('');
  const [editNotes, setEditNotes] = useState('');

  const loadFinancials = useCallback(async () => {
    const res = await fetch(`/api/jobs/${jobId}/profitability`);
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      appFeedback.error(json.error || 'Unable to load job financials.');
      return;
    }
    const next = json.profitability as JobProfitability;
    setProfitability(next);
    setRevenueAmount(next.manualRevenue ? String(next.manualRevenue) : '');
    setRevenueNotes(next.revenueNotes || '');
  }, [appFeedback, jobId]);

  const loadLabor = useCallback(async () => {
    const res = await fetch(`/api/jobs/${jobId}/labor`);
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      appFeedback.error(json.error || 'Unable to load contractor pay.');
      return;
    }
    setLaborEntries(json.labor || []);
  }, [appFeedback, jobId]);

  const load = useCallback(async () => {
    setLoading(true);
    await Promise.all([loadFinancials(), loadLabor()]);
    setLoading(false);
  }, [loadFinancials, loadLabor]);

  useEffect(() => {
    void load();
  }, [load, refreshKey]);

  function openSendInvoice() {
    const params = new URLSearchParams({ jobId });
    if (customerId) params.set('customerId', customerId);
    router.push(`/invoices?${params.toString()}`);
  }

  async function refreshAfterLaborChange() {
    await Promise.all([loadFinancials(), loadLabor()]);
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
    void loadFinancials();
  }

  async function saveContractorPay() {
    if (saving) return;
    const rateOrFlatAmount = Number.parseFloat(contractorPay);
    if (!Number.isFinite(rateOrFlatAmount) || rateOrFlatAmount <= 0) {
      appFeedback.error(payMode === 'hourly' ? 'Enter a valid hourly rate.' : 'Enter a valid flat amount.');
      return;
    }

    const hours = payMode === 'hourly' ? Number.parseFloat(contractorHours) : Math.max(1, Number.parseFloat(visitCount) || 1);
    if (!Number.isFinite(hours) || hours <= 0) {
      appFeedback.error(payMode === 'hourly' ? 'Enter valid hours worked.' : 'Enter a valid number of visits.');
      return;
    }

    const calculatedTotal = hours * rateOrFlatAmount;
    const notePrefix = payMode === 'hourly' ? `${hours} hours at ${formatCurrency(rateOrFlatAmount)}/hr` : `${hours} visit${hours === 1 ? '' : 's'} at ${formatCurrency(rateOrFlatAmount)} flat`;

    setSaving(true);
    const res = await fetch(`/api/jobs/${jobId}/labor`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        worker_name: contractorName.trim() || 'Contractor',
        hours,
        hourly_cost: rateOrFlatAmount,
        notes: [notePrefix, contractorNotes.trim()].filter(Boolean).join(' · ')
      })
    });
    const json = await res.json().catch(() => ({}));
    setSaving(false);
    if (!res.ok) {
      appFeedback.error(json.error || 'Unable to save contractor pay.');
      return;
    }
    setContractorName('');
    setContractorPay('');
    setContractorHours('');
    setVisitCount('1');
    setContractorNotes('');
    appFeedback.success(`Contractor pay saved: ${formatCurrency(calculatedTotal)}.`);
    void refreshAfterLaborChange();
  }

  function startEditLabor(entry: JobLaborRecord) {
    setEditingId(entry.id);
    setEditWorkerName(entry.worker_name || '');
    setEditHours(String(entry.hours ?? ''));
    setEditHourlyCost(String(entry.hourly_cost ?? ''));
    setEditNotes(entry.notes || '');
  }

  function cancelEditLabor() {
    setEditingId(null);
    setEditWorkerName('');
    setEditHours('');
    setEditHourlyCost('');
    setEditNotes('');
  }

  async function updateLabor(entryId: string) {
    if (saving) return;
    const hours = Number.parseFloat(editHours);
    const hourlyCost = Number.parseFloat(editHourlyCost || '0');
    if (!Number.isFinite(hours) || hours <= 0) {
      appFeedback.error('Enter valid hours or visits.');
      return;
    }

    setSaving(true);
    const res = await fetch(`/api/jobs/${jobId}/labor/${entryId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        worker_name: editWorkerName.trim() || 'Contractor',
        hours,
        hourly_cost: Number.isFinite(hourlyCost) ? hourlyCost : 0,
        notes: editNotes.trim() || null
      })
    });
    const json = await res.json().catch(() => ({}));
    setSaving(false);
    if (!res.ok) {
      appFeedback.error(json.error || 'Unable to update contractor pay.');
      return;
    }
    cancelEditLabor();
    appFeedback.success('Contractor pay updated.');
    void refreshAfterLaborChange();
  }

  async function removeLabor(entryId: string) {
    if (deletingId) return;
    if (!window.confirm('Delete this contractor pay entry?')) return;
    setDeletingId(entryId);
    const res = await fetch(`/api/jobs/${jobId}/labor/${entryId}`, { method: 'DELETE' });
    const json = await res.json().catch(() => ({}));
    setDeletingId(null);
    if (!res.ok) {
      appFeedback.error(json.error || 'Unable to delete contractor pay.');
      return;
    }
    if (editingId === entryId) cancelEditLabor();
    appFeedback.deleted();
    void refreshAfterLaborChange();
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
  const previewUnits = payMode === 'hourly' ? Number.parseFloat(contractorHours) : Math.max(1, Number.parseFloat(visitCount) || 1);
  const previewRate = Number.parseFloat(contractorPay);
  const previewTotal = Number.isFinite(previewUnits) && Number.isFinite(previewRate) ? previewUnits * previewRate : 0;

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
          {laborEntries.length > 0 ? (
            <div className="finance-list" style={{ marginBottom: 16 }}>
              {laborEntries.map((entry) => {
                const isEditing = editingId === entry.id;
                return (
                  <div key={entry.id} className="finance-list-card">
                    {isEditing ? (
                      <div className="finance-form-block compact-finance-form" style={{ width: '100%' }}>
                        <label>Contractor or cleaner name</label>
                        <input className="input" value={editWorkerName} onChange={(e) => setEditWorkerName(e.target.value)} />
                        <div className="grid-2">
                          <div className="form-group">
                            <label>Hours or visits</label>
                            <input className="input" type="number" min="0" step="0.25" value={editHours} onChange={(e) => setEditHours(e.target.value)} />
                          </div>
                          <div className="form-group">
                            <label>Rate</label>
                            <input className="input" type="number" min="0" step="0.01" value={editHourlyCost} onChange={(e) => setEditHourlyCost(e.target.value)} />
                          </div>
                        </div>
                        <label>Notes</label>
                        <input className="input" value={editNotes} onChange={(e) => setEditNotes(e.target.value)} />
                        <div className="job-detail-actions">
                          <button type="button" className="btn btn-primary" disabled={saving} onClick={() => void updateLabor(entry.id)}>
                            {saving ? FEEDBACK.loading : 'Save changes'}
                          </button>
                          <button type="button" className="btn" disabled={saving} onClick={cancelEditLabor}>Cancel</button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <div>
                          <strong>{entry.worker_name || 'Contractor'}</strong>
                          <p className="muted">
                            {entry.hours} x {formatCurrency(entry.hourly_cost)} = {formatCurrency(entry.total_cost)}
                          </p>
                          {entry.notes ? <p className="muted">{entry.notes}</p> : null}
                        </div>
                        <div className="job-detail-actions">
                          <button type="button" className="btn" disabled={saving || Boolean(deletingId)} onClick={() => startEditLabor(entry)}>Edit</button>
                          <button type="button" className="btn" disabled={deletingId === entry.id} onClick={() => void removeLabor(entry.id)}>
                            {deletingId === entry.id ? FEEDBACK.loading : 'Delete'}
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          ) : null}
          <div className="finance-form-block compact-finance-form">
            <label>Contractor or cleaner name</label>
            <input className="input" placeholder="Name" value={contractorName} onChange={(e) => setContractorName(e.target.value)} />
            <label>Pay type</label>
            <select className="input" value={payMode} onChange={(e) => setPayMode(e.target.value as PayMode)}>
              <option value="flat">Flat rate by visit</option>
              <option value="hourly">Hourly</option>
            </select>
            {payMode === 'hourly' ? (
              <div className="grid-2">
                <div className="form-group">
                  <label>Hours worked</label>
                  <input className="input" type="number" min="0" step="0.25" placeholder="0" value={contractorHours} onChange={(e) => setContractorHours(e.target.value)} />
                </div>
                <div className="form-group">
                  <label>Hourly rate</label>
                  <input className="input" type="number" min="0" step="0.01" placeholder="0.00" value={contractorPay} onChange={(e) => setContractorPay(e.target.value)} />
                </div>
              </div>
            ) : (
              <div className="grid-2">
                <div className="form-group">
                  <label>Visits</label>
                  <input className="input" type="number" min="1" step="1" placeholder="1" value={visitCount} onChange={(e) => setVisitCount(e.target.value)} />
                </div>
                <div className="form-group">
                  <label>Flat rate per visit</label>
                  <input className="input" type="number" min="0" step="0.01" placeholder="0.00" value={contractorPay} onChange={(e) => setContractorPay(e.target.value)} />
                </div>
              </div>
            )}
            <p className="muted finance-note">Calculated contractor cost: {formatCurrency(previewTotal)}</p>
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

      <div className="job-financials-section profit-summary-section">
        <h4>Profit summary</h4>
        <div className="finance-metric-grid financials-summary-grid">
          <div className="finance-metric featured">
            <span className="finance-metric-label">Estimated profit</span>
            <strong>{formatCurrency(estimatedProfit)}</strong>
          </div>
          <div className="finance-metric">
            <span className="finance-metric-label">Margin</span>
            <strong>{revenue > 0 ? `${profitMargin.toFixed(1)}%` : '0%'}</strong>
          </div>
        </div>
        <p className="muted finance-note">
          Profit is based on client income or invoices minus contractor pay and linked expenses.
        </p>
      </div>

      {p?.hasInvoice ? (
        <div className="job-financials-section">
          <h4>Record payment</h4>
          <div className="finance-inline-form">
            <input
              className="input"
              type="number"
              min="0"
              step="0.01"
              placeholder="Payment amount"
              value={paymentAmount}
              onChange={(e) => setPaymentAmount(e.target.value)}
            />
            <button type="button" className="btn" disabled={saving} onClick={() => void recordPayment()}>
              Record payment
            </button>
          </div>
          <Link className="muted-link" href="/invoices">
            View invoices
          </Link>
        </div>
      ) : null}
    </div>
  );
}
