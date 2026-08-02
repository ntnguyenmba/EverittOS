'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAppFeedback } from '@/components/feedback/use-app-feedback';
import { useTranslation } from '@/components/locale-provider';
import { FEEDBACK } from '@/lib/feedback-labels';
import { formatCurrency } from '@/lib/finance-format';
import type { ContractorPaymentStatus, JobLaborRecord } from '@/lib/finance-types';
import { getDashboardFinanceCopy } from '@/lib/i18n/dashboard-finance-copy';
import { getJobFinanceCopy } from '@/lib/i18n/job-finance-copy';
import {
  formatLaborPaymentLabel,
  laborQuantityLabel,
  normalizeLaborPaymentBasis,
  type LaborPaymentBasis
} from '@/lib/job-labor-basis';

type WorkerOption = { id: string; name: string };

type JobLaborSectionProps = {
  jobId: string;
  workers: WorkerOption[];
  canManage: boolean;
  assignedContractorName?: string | null;
  onChange?: () => void;
};

function todayInputValue() {
  return new Date().toISOString().slice(0, 10);
}

function paymentStatusLabel(
  status: ContractorPaymentStatus | null | undefined,
  labels: { paid: string; pending: string; unpaid: string }
) {
  if (status === 'paid') return labels.paid;
  if (status === 'pending') return labels.pending;
  return labels.unpaid;
}

function formatPaidDate(value: string | null | undefined) {
  if (!value) return '';
  return new Date(value).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  });
}

export function JobLaborSection({
  jobId,
  workers,
  canManage,
  assignedContractorName = null,
  onChange
}: JobLaborSectionProps) {
  const { locale } = useTranslation();
  const pageCopy = getDashboardFinanceCopy(locale).contractorPayPage;
  const financeCopy = getJobFinanceCopy(locale);
  const appFeedback = useAppFeedback();

  const [entries, setEntries] = useState<JobLaborRecord[]>([]);
  const [expectedContractorCost, setExpectedContractorCost] = useState(0);
  const [currentProfit, setCurrentProfit] = useState(0);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showAddPayment, setShowAddPayment] = useState(false);
  const [editingExpected, setEditingExpected] = useState(false);
  const [expectedEditAmount, setExpectedEditAmount] = useState('');
  const [updatingPaymentId, setUpdatingPaymentId] = useState<string | null>(null);
  const [editingEntryId, setEditingEntryId] = useState<string | null>(null);
  const [editPaymentBasis, setEditPaymentBasis] = useState<LaborPaymentBasis>('flat');
  const [editQuantity, setEditQuantity] = useState('');
  const [editRate, setEditRate] = useState('');
  const [editNotes, setEditNotes] = useState('');

  const [workerId, setWorkerId] = useState('');
  const [workerName, setWorkerName] = useState('');
  const [paymentBasis, setPaymentBasis] = useState<LaborPaymentBasis>('flat');
  const [quantity, setQuantity] = useState('');
  const [rate, setRate] = useState('');
  const [notes, setNotes] = useState('');

  const statusLabels = {
    paid: financeCopy.statusPaid,
    pending: pageCopy.pending,
    unpaid: financeCopy.statusUnpaid
  };

  const load = useCallback(async () => {
    setLoading(true);
    const [laborRes, profitabilityRes] = await Promise.all([
      fetch(`/api/jobs/${jobId}/labor`),
      fetch(`/api/jobs/${jobId}/profitability`)
    ]);
    const laborJson = await laborRes.json().catch(() => ({}));
    const profitabilityJson = await profitabilityRes.json().catch(() => ({}));
    setLoading(false);

    if (!laborRes.ok) {
      appFeedback.error(laborJson.error || 'Unable to load contractor pay.');
      return;
    }

    const laborRows = (laborJson.labor || []) as JobLaborRecord[];
    setEntries(laborRows);

    if (profitabilityRes.ok) {
      const profitability = profitabilityJson.profitability || {};
      const expected = Number(profitability.expectedContractorCost || 0);
      setExpectedContractorCost(expected);
      setExpectedEditAmount(expected > 0 ? String(expected) : '');
      setCurrentProfit(Number(profitability.estimatedProfit || 0));
    }
  }, [appFeedback, jobId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function refreshAll() {
    await load();
    onChange?.();
  }

  async function saveExpectedPay() {
    if (saving) return;
    const amount = Number.parseFloat(expectedEditAmount || '0');
    if (!Number.isFinite(amount) || amount < 0) {
      appFeedback.error('Enter a valid contractor pay amount.');
      return;
    }

    setSaving(true);
    const res = await fetch(`/api/jobs/${jobId}/profitability`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ expected_contractor_cost: amount })
    });
    const json = await res.json().catch(() => ({}));
    setSaving(false);

    if (!res.ok) {
      appFeedback.error(json.error || 'Unable to update contractor pay.');
      return;
    }

    setEditingExpected(false);
    appFeedback.success('Contractor pay updated.');
    await refreshAll();
  }

  async function markPlannedPayPaid() {
    if (saving || expectedContractorCost <= 0) return;
    setSaving(true);

    const matchedWorker = workers.find(
      (worker) => worker.name.trim().toLowerCase() === (assignedContractorName || '').trim().toLowerCase()
    );

    const laborRes = await fetch(`/api/jobs/${jobId}/labor`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        worker_id: matchedWorker?.id || null,
        worker_name: assignedContractorName || pageCopy.unnamed,
        hours: 1,
        hourly_cost: expectedContractorCost,
        payment_basis: 'flat',
        payment_status: 'paid',
        paid_at: `${todayInputValue()}T12:00:00.000Z`,
        notes: 'Finalized from planned contractor pay'
      })
    });
    const laborJson = await laborRes.json().catch(() => ({}));

    if (!laborRes.ok) {
      setSaving(false);
      appFeedback.error(laborJson.error || 'Unable to mark contractor pay as paid.');
      return;
    }

    const clearRes = await fetch(`/api/jobs/${jobId}/profitability`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ expected_contractor_cost: 0 })
    });
    const clearJson = await clearRes.json().catch(() => ({}));
    setSaving(false);

    if (!clearRes.ok) {
      appFeedback.error(clearJson.error || 'Payment was recorded, but planned pay could not be cleared.');
      await refreshAll();
      return;
    }

    appFeedback.success('Contractor pay marked paid.');
    await refreshAll();
  }

  async function updatePaymentStatus(entryId: string, paymentStatus: ContractorPaymentStatus) {
    if (updatingPaymentId) return;
    setUpdatingPaymentId(entryId);
    const res = await fetch(`/api/jobs/${jobId}/labor/${entryId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        payment_status: paymentStatus,
        paid_at: paymentStatus === 'paid' ? `${todayInputValue()}T12:00:00.000Z` : null
      })
    });
    const json = await res.json().catch(() => ({}));
    setUpdatingPaymentId(null);

    if (!res.ok) {
      appFeedback.error(json.error || 'Unable to update payment status.');
      return;
    }

    appFeedback.success('Payment status updated.');
    await refreshAll();
  }

  function startEditingEntry(entry: JobLaborRecord) {
    const basis = normalizeLaborPaymentBasis(entry.payment_basis);
    setEditingEntryId(entry.id);
    setEditPaymentBasis(basis);
    setEditQuantity(basis === 'flat' ? '1' : String(Number(entry.hours || 0)));
    setEditRate(String(Number(entry.hourly_cost || entry.total_cost || 0)));
    setEditNotes(entry.notes || '');
  }

  function cancelEditingEntry() {
    setEditingEntryId(null);
    setEditPaymentBasis('flat');
    setEditQuantity('');
    setEditRate('');
    setEditNotes('');
  }

  async function saveLaborEdit(entryId: string) {
    if (saving) return;
    const parsedQuantity = editPaymentBasis === 'flat' ? 1 : Number.parseFloat(editQuantity);
    const parsedRate = Number.parseFloat(editRate || '0');

    if (editPaymentBasis !== 'flat' && (!Number.isFinite(parsedQuantity) || parsedQuantity <= 0)) {
      appFeedback.error('Enter a quantity greater than zero.');
      return;
    }
    if (!Number.isFinite(parsedRate) || parsedRate < 0) {
      appFeedback.error('Enter a valid contractor pay amount.');
      return;
    }

    setSaving(true);
    const res = await fetch(`/api/jobs/${jobId}/labor/${entryId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        hours: parsedQuantity,
        hourly_cost: parsedRate,
        payment_basis: editPaymentBasis,
        notes: editNotes.trim() || null
      })
    });
    const json = await res.json().catch(() => ({}));
    setSaving(false);

    if (!res.ok) {
      appFeedback.error(json.error || 'Unable to update contractor pay.');
      return;
    }

    cancelEditingEntry();
    appFeedback.success('Contractor pay updated.');
    await refreshAll();
  }

  async function addLabor() {
    if (saving) return;
    const parsedQuantity = paymentBasis === 'flat' ? 1 : Number.parseFloat(quantity);
    const parsedRate = Number.parseFloat(rate || '0');

    if (paymentBasis !== 'flat' && (!Number.isFinite(parsedQuantity) || parsedQuantity <= 0)) {
      appFeedback.error('Enter a quantity greater than zero.');
      return;
    }
    if (!Number.isFinite(parsedRate) || parsedRate <= 0) {
      appFeedback.error('Enter a valid contractor pay amount.');
      return;
    }

    setSaving(true);
    const selected = workers.find((worker) => worker.id === workerId);
    const res = await fetch(`/api/jobs/${jobId}/labor`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        worker_id: workerId || null,
        worker_name: selected?.name || workerName.trim() || assignedContractorName || pageCopy.unnamed,
        hours: parsedQuantity,
        hourly_cost: parsedRate,
        payment_basis: paymentBasis,
        notes: notes.trim() || null
      })
    });
    const json = await res.json().catch(() => ({}));
    setSaving(false);

    if (!res.ok) {
      appFeedback.error(json.error || 'Unable to save contractor pay.');
      return;
    }

    setWorkerId('');
    setWorkerName('');
    setPaymentBasis('flat');
    setQuantity('');
    setRate('');
    setNotes('');
    setShowAddPayment(false);
    appFeedback.success(pageCopy.added);
    await refreshAll();
  }

  const totalLabor = useMemo(
    () => entries.reduce((sum, entry) => sum + Number(entry.total_cost || 0), 0),
    [entries]
  );
  const effectiveContractorCost = entries.length > 0 ? totalLabor : expectedContractorCost;
  const previewQuantity = paymentBasis === 'flat' ? 1 : Number.parseFloat(quantity);
  const previewRate = Number.parseFloat(rate || '0');
  const previewTotal =
    Number.isFinite(previewQuantity) && Number.isFinite(previewRate) ? previewQuantity * previewRate : 0;
  const editPreviewQuantity = editPaymentBasis === 'flat' ? 1 : Number.parseFloat(editQuantity);
  const editPreviewRate = Number.parseFloat(editRate || '0');
  const editPreviewTotal =
    Number.isFinite(editPreviewQuantity) && Number.isFinite(editPreviewRate)
      ? editPreviewQuantity * editPreviewRate
      : 0;

  return (
    <section className="card finance-section">
      <div className="section-heading">
        <h3>{pageCopy.title}</h3>
        <p className="muted">Review contractor pay already linked to this job.</p>
      </div>

      {loading ? <p className="muted">{FEEDBACK.loading}</p> : null}

      {!loading ? (
        <div className="finance-metric-grid financials-summary-grid" style={{ marginBottom: 16 }}>
          <div className="finance-metric">
            <span className="finance-metric-label">Contractor cost</span>
            <strong>{formatCurrency(effectiveContractorCost)}</strong>
          </div>
          <div className="finance-metric featured">
            <span className="finance-metric-label">Current profit</span>
            <strong>{formatCurrency(currentProfit)}</strong>
          </div>
        </div>
      ) : null}

      {!loading && expectedContractorCost > 0 && entries.length === 0 ? (
        <div className="finance-list-card" style={{ marginBottom: 16 }}>
          {editingExpected ? (
            <div className="finance-form-block compact-finance-form" style={{ width: '100%' }}>
              <label>Flat-rate contractor pay</label>
              <input
                className="input"
                type="number"
                min="0"
                step="0.01"
                value={expectedEditAmount}
                onChange={(event) => setExpectedEditAmount(event.target.value)}
              />
              <div className="job-detail-actions">
                <button type="button" className="btn btn-primary" disabled={saving} onClick={() => void saveExpectedPay()}>
                  {saving ? FEEDBACK.loading : 'Save contractor pay'}
                </button>
                <button type="button" className="btn" disabled={saving} onClick={() => setEditingExpected(false)}>
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <>
              <div>
                <strong>{assignedContractorName || pageCopy.unnamed}</strong>
                <p className="muted" style={{ margin: '6px 0' }}>
                  Flat rate: {formatCurrency(expectedContractorCost)}
                </p>
                <p className="muted" style={{ margin: '6px 0' }}>
                  Status: Planned. This amount is already included in profit and does not need to be entered again.
                </p>
              </div>
              {canManage ? (
                <div className="job-detail-actions">
                  <button type="button" className="btn btn-primary" disabled={saving} onClick={() => void markPlannedPayPaid()}>
                    {saving ? FEEDBACK.loading : pageCopy.markPaid}
                  </button>
                  <button type="button" className="btn" disabled={saving} onClick={() => setEditingExpected(true)}>
                    Edit
                  </button>
                </div>
              ) : null}
            </>
          )}
        </div>
      ) : null}

      {!loading && entries.length > 0 ? (
        <div className="finance-list" style={{ marginTop: 4 }}>
          <h4>Saved contractor pay</h4>
          {entries.map((entry) => {
            const paymentStatus = entry.payment_status || 'unpaid';
            const editing = editingEntryId === entry.id;
            return (
              <div key={entry.id} className="finance-list-card">
                {editing ? (
                  <div className="finance-form-block compact-finance-form" style={{ width: '100%' }}>
                    <strong>{entry.worker_name || pageCopy.unnamed}</strong>
                    <label>Payment type</label>
                    <select
                      className="input"
                      value={editPaymentBasis}
                      onChange={(event) => setEditPaymentBasis(event.target.value as LaborPaymentBasis)}
                    >
                      <option value="flat">{pageCopy.flatRate}</option>
                      <option value="hourly">{pageCopy.hourly}</option>
                      <option value="visit">Per visit</option>
                    </select>

                    <div className="grid-2">
                      {editPaymentBasis !== 'flat' ? (
                        <div className="form-group">
                          <label>{laborQuantityLabel(editPaymentBasis, locale)}</label>
                          <input
                            className="input"
                            type="number"
                            min="0"
                            step="0.25"
                            value={editQuantity}
                            onChange={(event) => setEditQuantity(event.target.value)}
                          />
                        </div>
                      ) : null}
                      <div className="form-group">
                        <label>{editPaymentBasis === 'flat' ? pageCopy.amount : pageCopy.hourlyRate}</label>
                        <input
                          className="input"
                          type="number"
                          min="0"
                          step="0.01"
                          value={editRate}
                          onChange={(event) => setEditRate(event.target.value)}
                        />
                      </div>
                    </div>

                    <div className="finance-metric" style={{ marginBottom: 12 }}>
                      <span className="finance-metric-label">{pageCopy.calculatedTotal}</span>
                      <strong>{formatCurrency(editPreviewTotal)}</strong>
                    </div>

                    <label>{pageCopy.notesOptional}</label>
                    <input className="input" value={editNotes} onChange={(event) => setEditNotes(event.target.value)} />

                    <div className="job-detail-actions">
                      <button
                        type="button"
                        className="btn btn-primary"
                        disabled={saving}
                        onClick={() => void saveLaborEdit(entry.id)}
                      >
                        {saving ? FEEDBACK.loading : 'Save contractor pay'}
                      </button>
                      <button type="button" className="btn" disabled={saving} onClick={cancelEditingEntry}>
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div>
                      <strong>{entry.worker_name || pageCopy.unnamed}</strong>
                      <p className="muted" style={{ margin: '6px 0' }}>
                        {formatLaborPaymentLabel({
                          paymentBasis: entry.payment_basis,
                          quantity: entry.hours,
                          rate: entry.hourly_cost,
                          total: entry.total_cost,
                          locale
                        })}
                      </p>
                      <p className="muted" style={{ margin: '6px 0' }}>
                        {financeCopy.paymentStatus}: {paymentStatusLabel(paymentStatus, statusLabels)}
                        {entry.paid_at ? ` · ${pageCopy.paid} ${formatPaidDate(entry.paid_at)}` : ''}
                      </p>
                      {entry.notes ? <p className="muted" style={{ margin: '6px 0' }}>{entry.notes}</p> : null}
                    </div>
                    {canManage ? (
                      <div className="job-detail-actions">
                        <button type="button" className="btn" disabled={saving} onClick={() => startEditingEntry(entry)}>
                          Edit
                        </button>
                        {paymentStatus !== 'paid' ? (
                          <button
                            type="button"
                            className="btn btn-primary"
                            disabled={updatingPaymentId === entry.id}
                            onClick={() => void updatePaymentStatus(entry.id, 'paid')}
                          >
                            {updatingPaymentId === entry.id ? FEEDBACK.loading : pageCopy.markPaid}
                          </button>
                        ) : (
                          <button
                            type="button"
                            className="btn"
                            disabled={updatingPaymentId === entry.id}
                            onClick={() => void updatePaymentStatus(entry.id, 'unpaid')}
                          >
                            {updatingPaymentId === entry.id ? FEEDBACK.loading : pageCopy.stillOwed}
                          </button>
                        )}
                        {paymentStatus === 'unpaid' ? (
                          <button
                            type="button"
                            className="btn"
                            disabled={updatingPaymentId === entry.id}
                            onClick={() => void updatePaymentStatus(entry.id, 'pending')}
                          >
                            {pageCopy.markPending}
                          </button>
                        ) : null}
                      </div>
                    ) : null}
                  </>
                )}
              </div>
            );
          })}
        </div>
      ) : null}

      {canManage && !showAddPayment ? (
        <button type="button" className="btn" style={{ marginTop: 16 }} onClick={() => setShowAddPayment(true)}>
          Add a separate payment
        </button>
      ) : null}

      {canManage && showAddPayment ? (
        <div className="finance-form-block compact-finance-form" style={{ marginTop: 20 }}>
          <h4>Add a separate payment</h4>
          <p className="muted">Use this only for an additional cleaner, bonus, or separate labor payment.</p>

          <label>{pageCopy.contractorOrCleaner}</label>
          {workers.length > 0 ? (
            <select className="input" value={workerId} onChange={(event) => setWorkerId(event.target.value)}>
              <option value="">{assignedContractorName || pageCopy.unnamed}</option>
              {workers.map((worker) => (
                <option key={worker.id} value={worker.id}>
                  {worker.name}
                </option>
              ))}
            </select>
          ) : (
            <input
              className="input"
              value={workerName}
              placeholder={assignedContractorName || pageCopy.contractorNamePlaceholder}
              onChange={(event) => setWorkerName(event.target.value)}
            />
          )}

          <label>Payment type</label>
          <select
            className="input"
            value={paymentBasis}
            onChange={(event) => setPaymentBasis(event.target.value as LaborPaymentBasis)}
          >
            <option value="flat">{pageCopy.flatRate}</option>
            <option value="hourly">{pageCopy.hourly}</option>
            <option value="visit">Per visit</option>
          </select>

          <div className="grid-2">
            {paymentBasis !== 'flat' ? (
              <div className="form-group">
                <label>{laborQuantityLabel(paymentBasis, locale)}</label>
                <input
                  className="input"
                  type="number"
                  min="0"
                  step="0.25"
                  value={quantity}
                  onChange={(event) => setQuantity(event.target.value)}
                />
              </div>
            ) : null}
            <div className="form-group">
              <label>{paymentBasis === 'flat' ? pageCopy.amount : pageCopy.hourlyRate}</label>
              <input
                className="input"
                type="number"
                min="0"
                step="0.01"
                value={rate}
                onChange={(event) => setRate(event.target.value)}
              />
            </div>
          </div>

          <div className="finance-metric" style={{ marginBottom: 12 }}>
            <span className="finance-metric-label">{pageCopy.calculatedTotal}</span>
            <strong>{formatCurrency(previewTotal)}</strong>
          </div>

          <label>{pageCopy.notesOptional}</label>
          <input className="input" value={notes} onChange={(event) => setNotes(event.target.value)} />

          <div className="job-detail-actions">
            <button type="button" className="btn btn-primary" disabled={saving} onClick={() => void addLabor()}>
              {saving ? FEEDBACK.loading : 'Save separate payment'}
            </button>
            <button type="button" className="btn" disabled={saving} onClick={() => setShowAddPayment(false)}>
              Cancel
            </button>
          </div>
        </div>
      ) : null}
    </section>
  );
}
