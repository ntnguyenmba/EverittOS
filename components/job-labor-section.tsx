'use client';

import { useCallback, useEffect, useState } from 'react';
import { useAppFeedback } from '@/components/feedback/use-app-feedback';
import { FEEDBACK } from '@/lib/feedback-labels';
import { formatCurrency } from '@/lib/finance-format';
import type { JobLaborRecord } from '@/lib/finance-types';

type WorkerOption = { id: string; name: string };

type JobLaborSectionProps = {
  jobId: string;
  workers: WorkerOption[];
  canManage: boolean;
  onChange?: () => void;
};

export function JobLaborSection({ jobId, workers, canManage, onChange }: JobLaborSectionProps) {
  const appFeedback = useAppFeedback();
  const [entries, setEntries] = useState<JobLaborRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [workerId, setWorkerId] = useState('');
  const [workerName, setWorkerName] = useState('');
  const [hours, setHours] = useState('');
  const [hourlyCost, setHourlyCost] = useState('');
  const [notes, setNotes] = useState('');
  const [editWorkerId, setEditWorkerId] = useState('');
  const [editWorkerName, setEditWorkerName] = useState('');
  const [editHours, setEditHours] = useState('');
  const [editHourlyCost, setEditHourlyCost] = useState('');
  const [editNotes, setEditNotes] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch(`/api/jobs/${jobId}/labor`);
    const json = await res.json();
    setLoading(false);
    if (!res.ok) {
      appFeedback.error(json.error || 'Unable to load labor entries.');
      return;
    }
    setEntries(json.labor || []);
  }, [appFeedback, jobId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function addLabor() {
    if (saving) return;
    const h = Number.parseFloat(hours);
    const rate = Number.parseFloat(hourlyCost || '0');
    if (!Number.isFinite(h) || h <= 0) {
      appFeedback.error('Enter hours worked.');
      return;
    }

    setSaving(true);
    const selected = workers.find((w) => w.id === workerId);
    const res = await fetch(`/api/jobs/${jobId}/labor`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        worker_id: workerId || null,
        worker_name: selected?.name || workerName.trim() || null,
        hours: h,
        hourly_cost: Number.isFinite(rate) ? rate : 0,
        notes: notes.trim() || null
      })
    });
    const json = await res.json();
    setSaving(false);

    if (!res.ok) {
      appFeedback.error(json.error || 'Unable to save labor entry.');
      return;
    }

    appFeedback.saved();
    setWorkerId('');
    setWorkerName('');
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
    setEditHours(String(entry.hours ?? ''));
    setEditHourlyCost(String(entry.hourly_cost ?? ''));
    setEditNotes(entry.notes || '');
  }

  function cancelEdit() {
    setEditingId(null);
    setEditWorkerId('');
    setEditWorkerName('');
    setEditHours('');
    setEditHourlyCost('');
    setEditNotes('');
  }

  async function updateEntry(id: string) {
    if (saving) return;
    const h = Number.parseFloat(editHours);
    const rate = Number.parseFloat(editHourlyCost || '0');
    if (!Number.isFinite(h) || h <= 0) {
      appFeedback.error('Enter hours worked.');
      return;
    }

    setSaving(true);
    const selected = workers.find((w) => w.id === editWorkerId);
    const res = await fetch(`/api/jobs/${jobId}/labor/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        worker_id: editWorkerId || null,
        worker_name: selected?.name || editWorkerName.trim() || null,
        hours: h,
        hourly_cost: Number.isFinite(rate) ? rate : 0,
        notes: editNotes.trim() || null
      })
    });
    const json = await res.json().catch(() => ({}));
    setSaving(false);

    if (!res.ok) {
      appFeedback.error(json.error || 'Unable to update labor entry.');
      return;
    }

    appFeedback.success('Labor entry updated.');
    cancelEdit();
    await load();
    onChange?.();
  }

  async function removeEntry(id: string) {
    if (deletingId) return;
    if (!window.confirm('Delete this labor entry?')) return;
    setDeletingId(id);
    const res = await fetch(`/api/jobs/${jobId}/labor/${id}`, { method: 'DELETE' });
    const json = await res.json().catch(() => ({}));
    setDeletingId(null);
    if (!res.ok) {
      appFeedback.error(json.error || 'Unable to delete labor entry.');
      return;
    }
    if (editingId === id) cancelEdit();
    appFeedback.deleted();
    await load();
    onChange?.();
  }

  const totalLabor = entries.reduce((s, e) => s + Number(e.total_cost || 0), 0);

  return (
    <div className="card finance-card">
      <h3>Labor cost</h3>
      <p className="muted">Track hours and contractor pay for this job.</p>

      {loading ? <p className="loading-state">Loading...</p> : null}

      {!loading && entries.length === 0 ? (
        <p className="muted">No labor entries yet.</p>
      ) : null}

      {!loading && entries.length > 0 ? (
        <div className="finance-list">
          {entries.map((entry) => {
            const isEditing = editingId === entry.id;
            return (
              <div key={entry.id} className="finance-list-card">
                {isEditing ? (
                  <div className="finance-form-block compact-finance-form" style={{ width: '100%' }}>
                    <label>Team member</label>
                    {workers.length > 0 ? (
                      <select className="input" value={editWorkerId} onChange={(e) => setEditWorkerId(e.target.value)}>
                        <option value="">Manual name</option>
                        {workers.map((w) => (
                          <option key={w.id} value={w.id}>
                            {w.name}
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
                      <button type="button" className="btn btn-primary" disabled={saving} onClick={() => void updateEntry(entry.id)}>
                        {saving ? FEEDBACK.loading : 'Save changes'}
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
                      <p className="muted">
                        {entry.hours} x {formatCurrency(entry.hourly_cost)} = {formatCurrency(entry.total_cost)}
                      </p>
                      {entry.notes ? <p className="muted">{entry.notes}</p> : null}
                    </div>
                    {canManage ? (
                      <div className="job-detail-actions">
                        <button type="button" className="btn" disabled={saving || Boolean(deletingId)} onClick={() => startEdit(entry)}>
                          Edit
                        </button>
                        <button
                          type="button"
                          className="btn"
                          disabled={deletingId === entry.id}
                          onClick={() => void removeEntry(entry.id)}
                        >
                          {deletingId === entry.id ? FEEDBACK.loading : 'Delete'}
                        </button>
                      </div>
                    ) : null}
                  </>
                )}
              </div>
            );
          })}
          <p>
            <strong>Total labor:</strong> {formatCurrency(totalLabor)}
          </p>
        </div>
      ) : null}

      {canManage ? (
        <div className="finance-form-block">
          <label>Team member</label>
          {workers.length > 0 ? (
            <select className="input" value={workerId} onChange={(e) => setWorkerId(e.target.value)}>
              <option value="">Select team member</option>
              {workers.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.name}
                </option>
              ))}
            </select>
          ) : (
            <input
              className="input"
              placeholder="Team member name"
              value={workerName}
              onChange={(e) => setWorkerName(e.target.value)}
            />
          )}
          <label>Hours worked</label>
          <input className="input" type="number" min="0" step="0.25" value={hours} onChange={(e) => setHours(e.target.value)} />
          <label>Hourly cost</label>
          <input
            className="input"
            type="number"
            min="0"
            step="0.01"
            value={hourlyCost}
            onChange={(e) => setHourlyCost(e.target.value)}
          />
          <label>Notes (optional)</label>
          <input className="input" value={notes} onChange={(e) => setNotes(e.target.value)} />
          <button type="button" className="btn btn-primary" disabled={saving} onClick={() => void addLabor()}>
            {saving ? FEEDBACK.loading : 'Add labor'}
          </button>
        </div>
      ) : null}
    </div>
  );
}
