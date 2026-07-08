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
  const [workerId, setWorkerId] = useState('');
  const [workerName, setWorkerName] = useState('');
  const [hours, setHours] = useState('');
  const [hourlyCost, setHourlyCost] = useState('');
  const [notes, setNotes] = useState('');

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
    appFeedback.deleted();
    await load();
    onChange?.();
  }

  const totalLabor = entries.reduce((s, e) => s + Number(e.total_cost || 0), 0);

  return (
    <div className="card finance-card">
      <h3>Labor cost</h3>
      <p className="muted">Track hours and hourly cost for this job.</p>

      {loading ? <p className="loading-state">Loading...</p> : null}

      {!loading && entries.length === 0 ? (
        <p className="muted">No labor entries yet.</p>
      ) : null}

      {!loading && entries.length > 0 ? (
        <div className="finance-list">
          {entries.map((entry) => (
            <div key={entry.id} className="finance-list-card">
              <div>
                <strong>{entry.worker_name || 'Team member'}</strong>
                <p className="muted">
                  {entry.hours} hrs x {formatCurrency(entry.hourly_cost)} = {formatCurrency(entry.total_cost)}
                </p>
                {entry.notes ? <p className="muted">{entry.notes}</p> : null}
              </div>
              {canManage ? (
                <button
                  type="button"
                  className="btn"
                  disabled={deletingId === entry.id}
                  onClick={() => void removeEntry(entry.id)}
                >
                  {deletingId === entry.id ? FEEDBACK.loading : 'Delete'}
                </button>
              ) : null}
            </div>
          ))}
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
