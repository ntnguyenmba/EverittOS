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
  onChange?: () => void;
};

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
  return new Date(value).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

function todayInputValue() {
  return new Date().toISOString().slice(0, 10);
}

function rateLabel(basis: LaborPaymentBasis) {
  if (basis === 'flat') return 'Flat amount';
  if (basis === 'visit') return 'Rate per visit';
  return 'Hourly rate';
}

export function JobLaborSection({ jobId, workers, canManage, onChange }: JobLaborSectionProps) {
  const { locale } = useTranslation();
  const pageCopy = getDashboardFinanceCopy(locale).contractorPayPage;
  const financeCopy = getJobFinanceCopy(locale);
  const statusLabels = {
    paid: financeCopy.statusPaid,
    pending: pageCopy.pending,
    unpaid: financeCopy.statusUnpaid
  };
  const appFeedback = useAppFeedback();
  const [entries, setEntries] = useState<JobLaborRecord[]>([]);
  const [currentProfit, setCurrentProfit] = useState(0);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [duplicatingId, setDuplicatingId] = useState<string | null>(null);
  const [updatingPaymentId, setUpdatingPaymentId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [workerId, setWorkerId] = useState('');
  const [workerName, setWorkerName] = useState('');
  const [paymentBasis, setPaymentBasis] = useState<LaborPaymentBasis>('hourly');
  const [hours, setHours] = useState('');
  const [hourlyCost, setHourlyCost] = useState('');
  const [notes, setNotes] = useState('');
  const [editWorkerId, setEditWorkerId] = useState('');
  const [editWorkerName, setEditWorkerName] = useState('');
  const [editPaymentBasis, setEditPaymentBasis] = useState<LaborPaymentBasis>('hourly');
  const [editHours, setEditHours] = useState('');
  const [editHourlyCost, setEditHourlyCost] = useState('');
  const [editNotes, setEditNotes] = useState('');

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
    setEntries(laborJson.labor || []);
    if (profitabilityRes.ok) {
      setCurrentProfit(Number(profitabilityJson.profitability?.estimatedProfit || 0));
    }
  }, [appFeedback, jobId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function addLabor() {
    if (saving) return;
    const quantity = paymentBasis === 'flat' ? 1 : Number.parseFloat(hours);
    const rate = Number.parseFloat(hourlyCost || '0');
    if (paymentBasis !== 'flat' && (!Number.isFinite(quantity) || quantity <= 0)) {
      appFeedback.error('Enter a quantity greater than zero.');
      return;
    }
    if (!Number.isFinite(rate) || rate < 0) {
      appFeedback.error('Enter a valid amount.');
      return;
    }

    setSaving(true);
    const selected = workers.find((w) => w.id === workerId);
    const res = await fetch(`/api/jobs/${jobId}/labor`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        worker_id: workerId || null,
        worker_name: selected?.name || workerName.trim() || 'Contractor',
        hours: quantity,
        hourly_cost: rate,
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

    appFeedback.success('Contractor pay added.');
    setWorkerId('');
    setWorkerName('');
    setPaymentBasis('hourly');
    setHours('');
    setHourlyCost('');
    setNotes('');
    await load();
    onChange?.();
  }

  function startEdit(entry: JobLaborRecord) {
    setEditingId(entry.id);
    setEditWorkerId(entry.worker_id || '');
    setEditWorkerName(entry.worker_name || '');
    setEditPaymentBasis(normalizeLaborPaymentBasis(entry.payment_basis, entry.hours));
    setEditHours(String(entry.hours ?? ''));
    setEditHourlyCost(String(entry.hourly_cost ?? ''));
    setEditNotes(entry.notes || '');
  }

  function cancelEdit() {
    setEditingId(null);
  }

  async function updateEntry(entryId: string) {
    if (saving) return;
    const quantity = editPaymentBasis === 'flat' ? 1 : Number.parseFloat(editHours);
    const rate = Number.parseFloat(editHourlyCost || '0');
    if (editPaymentBasis !== 'flat' && (!Number.isFinite(quantity) || quantity <= 0)) {
      appFeedback.error('Enter a quantity greater than zero.');
      return;
    }
    if (!Number.isFinite(rate) || rate < 0) {
      appFeedback.error('Enter a valid amount.');
      return;
    }

    setSaving(true);
    const selected = workers.find((w) => w.id === editWorkerId);
    const res = await fetch(`/api/jobs/${jobId}/labor/${entryId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        worker_id: editWorkerId || null,
        worker_name: selected?.name || editWorkerName.trim() || 'Contractor',
        hours: quantity,
        hourly_cost: rate,
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

    appFeedback.success(json.migrationWarning || 'Contractor pay updated.');
    setEditingId(null);
    await load();
    onChange?.();
  }

  async function removeEntry(entryId: string) {
    if (deletingId) return;
    setDeletingId(entryId);
    const res = await fetch(`/api/jobs/${jobId}/labor/${entryId}`, { method: 'DELETE' });
    const json = await res.json().catch(() => ({}));
    setDeletingId(null);
    if (!res.ok) {
      appFeedback.error(json.error || 'Unable to remove contractor pay.');
      return;
    }
    appFeedback.success('Contractor pay removed.');
    await load();
    onChange?.();
  }

  async function duplicateEntry(entryId: string) {
    const entry = entries.find((row) => row.id === entryId);
    if (!entry || duplicatingId) return;
    setDuplicatingId(entryId);
    const res = await fetch(`/api/jobs/${jobId}/labor`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        worker_id: entry.worker_id,
        worker_name: entry.worker_name,
        hours: entry.hours,
        hourly_cost: entry.hourly_cost,
        payment_basis: normalizeLaborPaymentBasis(entry.payment_basis, entry.hours),
        notes: entry.notes
      })
    });
    const json = await res.json().catch(() => ({}));
    setDuplicatingId(null);
    if (!res.ok) {
      appFeedback.error(json.error || 'Unable to duplicate contractor pay.');
      return;
    }
    appFeedback.success('Contractor pay duplicated.');
    await load();
    onChange?.();
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
    appFeedback.success(json.migrationWarning || 'Payment status updated.');
    await load();
    onChange?.();
  }

  const totalLabor = entries.reduce((sum, entry) => sum + Number(entry.total_cost || 0), 0);
  const unpaidLabor = entries
    .filter((entry) => (entry.payment_status || 'unpaid') === 'unpaid')
    .reduce((sum, entry) => sum + Number(entry.total_cost || 0), 0);
  const pendingLabor = entries
    .filter((entry) => entry.payment_status === 'pending')
    .reduce((sum, entry) => sum + Number(entry.total_cost || 0), 0);
  const paidLabor = entries
    .filter((entry) => entry.payment_status === 'paid')
    .reduce((sum, entry) => sum + Number(entry.total_cost || 0), 0);

  const previewQuantity = paymentBasis === 'flat' ? 1 : Number.parseFloat(hours);
  const previewRate = Number.parseFloat(hourlyCost || '0');
  const previewTotal =
    Number.isFinite(previewQuantity) && Number.isFinite(previewRate) ? previewQuantity * previewRate : 0;

  const contractorTotals = useMemo(() => {
    const map = new Map<string, { name: string; total: number }>();
    for (const row of entries) {
      const name = row.worker_name || 'Contractor';
      const key = name.toLowerCase();
      const current = map.get(key) || { name, total: 0 };
      current.total += Number(row.total_cost || 0);
      map.set(key, current);
    }
    return Array.from(map.values()).sort((a, b) => b.total - a.total);
  }, [entries]);

  return (
    <section className="card finance-section">
      <div className="section-heading">
        <h3>{pageCopy.title}</h3>
        <p className="muted">{pageCopy.subtitle}</p>
      </div>

      {loading ? <p className="muted">{FEEDBACK.loading}</p> : null}

      {!loading && entries.length > 0 ? (
        <div className="finance-metric-grid financials-summary-grid" style={{ marginBottom: 16 }}>
          <div className="finance-metric">
            <span className="finance-metric-label">Unpaid</span>
            <strong>{formatCurrency(unpaidLabor)}</strong>
          </div>
          <div className="finance-metric">
            <span className="finance-metric-label">Pending</span>
            <strong>{formatCurrency(pendingLabor)}</strong>
          </div>
          <div className="finance-metric">
            <span className="finance-metric-label">Paid</span>
            <strong>{formatCurrency(paidLabor)}</strong>
          </div>
          <div className="finance-metric featured">
            <span className="finance-metric-label">Total contractor cost</span>
            <strong>{formatCurrency(totalLabor)}</strong>
          </div>
        </div>
      ) : null}

      {!loading && contractorTotals.length > 0 ? (
        <div className="finance-metric-grid financials-summary-grid" style={{ marginBottom: 24 }}>
          {contractorTotals.map((contractor) => (
            <div key={contractor.name.toLowerCase()} className="finance-metric">
              <span className="finance-metric-label">{contractor.name}</span>
              <strong>{formatCurrency(contractor.total)}</strong>
            </div>
          ))}
        </div>
      ) : null}

      {!loading && entries.length > 0 ? (
        <div className="finance-list" style={{ marginTop: 4 }}>
          <h4>Saved contractor pay</h4>
          {entries.map((entry) => {
            const isEditing = editingId === entry.id;
            const editedQuantity = editPaymentBasis === 'flat' ? 1 : Number.parseFloat(editHours);
            const editedRate = Number.parseFloat(editHourlyCost);
            const editedCost =
              Number.isFinite(editedQuantity) && Number.isFinite(editedRate) ? editedQuantity * editedRate : 0;
            const editedProfit = currentProfit + Number(entry.total_cost || 0) - editedCost;
            const paymentStatus = entry.payment_status || 'unpaid';
            return (
              <div key={entry.id} className="finance-list-card">
                {isEditing ? (
                  <div className="finance-form-block compact-finance-form" style={{ width: '100%' }}>
                    <label>Contractor or cleaner</label>
                    {workers.length > 0 ? (
                      <select className="input" value={editWorkerId} onChange={(e) => setEditWorkerId(e.target.value)}>
                        <option value="">Manual name</option>
                        {workers.map((worker) => (
                          <option key={worker.id} value={worker.id}>
                            {worker.name}
                          </option>
                        ))}
                      </select>
                    ) : null}
                    <input
                      className="input"
                      placeholder="Contractor name"
                      value={editWorkerName}
                      onChange={(e) => setEditWorkerName(e.target.value)}
                    />
                    <label>Payment basis</label>
                    <select
                      className="input"
                      value={editPaymentBasis}
                      onChange={(e) => setEditPaymentBasis(e.target.value as LaborPaymentBasis)}
                    >
                      <option value="flat">Flat amount</option>
                      <option value="hourly">Hourly</option>
                      <option value="visit">Per visit</option>
                    </select>
                    <div className="grid-2">
                      {editPaymentBasis !== 'flat' ? (
                        <div className="form-group">
                          <label>{laborQuantityLabel(editPaymentBasis)}</label>
                          <input
                            className="input"
                            type="number"
                            min="0"
                            step="0.25"
                            value={editHours}
                            onChange={(e) => setEditHours(e.target.value)}
                          />
                        </div>
                      ) : null}
                      <div className="form-group">
                        <label>{rateLabel(editPaymentBasis)}</label>
                        <input
                          className="input"
                          type="number"
                          min="0"
                          step="0.01"
                          value={editHourlyCost}
                          onChange={(e) => setEditHourlyCost(e.target.value)}
                        />
                      </div>
                    </div>
                    <div className="finance-metric-grid financials-summary-grid">
                      <div className="finance-metric">
                        <span className="finance-metric-label">Updated contractor pay</span>
                        <strong>{formatCurrency(editedCost)}</strong>
                      </div>
                      <div className="finance-metric featured">
                        <span className="finance-metric-label">Profit after update</span>
                        <strong>{formatCurrency(editedProfit)}</strong>
                      </div>
                    </div>
                    <label>Notes</label>
                    <input className="input" value={editNotes} onChange={(e) => setEditNotes(e.target.value)} />
                    <div className="job-detail-actions">
                      <button type="button" className="btn btn-primary" disabled={saving} onClick={() => void updateEntry(entry.id)}>
                        {saving ? FEEDBACK.loading : 'Save contractor pay'}
                      </button>
                      <button type="button" className="btn" disabled={saving} onClick={cancelEdit}>
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div>
                      <strong>{entry.worker_name || 'Contractor'}</strong>
                      <p className="muted" style={{ margin: '6px 0' }}>
                        {formatLaborPaymentLabel({
                          paymentBasis: entry.payment_basis,
                          quantity: entry.hours,
                          rate: entry.hourly_cost,
                          total: entry.total_cost
                        })}
                      </p>
                      <p className="muted" style={{ margin: '6px 0' }}>
                        {financeCopy.paymentStatus}: {paymentStatusLabel(paymentStatus, statusLabels)}
                        {entry.paid_at ? ` · ${pageCopy.paid} ${formatPaidDate(entry.paid_at)}` : ''}
                      </p>
                      {entry.payment_method ? (
                        <p className="muted" style={{ margin: '6px 0' }}>
                          Method: {entry.payment_method}
                        </p>
                      ) : null}
                      {entry.payment_reference ? (
                        <p className="muted" style={{ margin: '6px 0' }}>
                          Reference: {entry.payment_reference}
                        </p>
                      ) : null}
                      {entry.notes ? <p className="muted" style={{ margin: '6px 0' }}>{entry.notes}</p> : null}
                    </div>
                    {canManage ? (
                      <div className="job-detail-actions">
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
                        <button
                          type="button"
                          className="btn"
                          disabled={saving || Boolean(deletingId) || Boolean(duplicatingId)}
                          onClick={() => startEdit(entry)}
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          className="btn"
                          disabled={duplicatingId === entry.id || Boolean(deletingId)}
                          onClick={() => void duplicateEntry(entry.id)}
                        >
                          {duplicatingId === entry.id ? FEEDBACK.loading : 'Duplicate'}
                        </button>
                        <button
                          type="button"
                          className="btn"
                          disabled={deletingId === entry.id || Boolean(duplicatingId)}
                          onClick={() => void removeEntry(entry.id)}
                        >
                          {deletingId === entry.id ? FEEDBACK.loading : 'Remove'}
                        </button>
                      </div>
                    ) : null}
                  </>
                )}
              </div>
            );
          })}
        </div>
      ) : null}

      {canManage ? (
        <div className="finance-form-block compact-finance-form" style={{ marginTop: 20 }}>
          <h4>Add contractor pay</h4>
          <label>Contractor or cleaner</label>
          {workers.length > 0 ? (
            <select className="input" value={workerId} onChange={(e) => setWorkerId(e.target.value)}>
              <option value="">Manual name</option>
              {workers.map((worker) => (
                <option key={worker.id} value={worker.id}>
                  {worker.name}
                </option>
              ))}
            </select>
          ) : null}
          <input
            className="input"
            placeholder="Contractor name"
            value={workerName}
            onChange={(e) => setWorkerName(e.target.value)}
          />
          <label>Payment basis</label>
          <select
            className="input"
            value={paymentBasis}
            onChange={(e) => setPaymentBasis(e.target.value as LaborPaymentBasis)}
          >
            <option value="flat">Flat amount</option>
            <option value="hourly">Hourly</option>
            <option value="visit">Per visit</option>
          </select>
          <div className="grid-2">
            {paymentBasis !== 'flat' ? (
              <div className="form-group">
                <label>{laborQuantityLabel(paymentBasis)}</label>
                <input
                  className="input"
                  type="number"
                  min="0"
                  step="0.25"
                  value={hours}
                  onChange={(e) => setHours(e.target.value)}
                />
              </div>
            ) : null}
            <div className="form-group">
              <label>{rateLabel(paymentBasis)}</label>
              <input
                className="input"
                type="number"
                min="0"
                step="0.01"
                value={hourlyCost}
                onChange={(e) => setHourlyCost(e.target.value)}
              />
            </div>
          </div>
          <div className="finance-metric" style={{ marginBottom: 12 }}>
            <span className="finance-metric-label">Calculated total</span>
            <strong>{formatCurrency(previewTotal)}</strong>
          </div>
          <label>Notes</label>
          <input className="input" value={notes} onChange={(e) => setNotes(e.target.value)} />
          <button type="button" className="btn btn-primary" disabled={saving} onClick={() => void addLabor()}>
            {saving ? FEEDBACK.loading : 'Add contractor pay'}
          </button>
        </div>
      ) : null}
    </section>
  );
}
