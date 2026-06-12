'use client';

import { useCallback, useEffect, useState } from 'react';
import { ActionFeedbackBanner } from '@/components/action-feedback';
import { errorFeedback, successFeedback, type ActionFeedback } from '@/lib/action-messages';
import { formatCurrency } from '@/lib/finance-format';
import type { JobLaborRecord } from '@/lib/finance-types';

type WorkerOption = { id: string; name: string };

type JobLaborSectionProps = {
  jobId: string;
  workers: WorkerOption[];
  canManage: boolean;
};

export function JobLaborSection({ jobId, workers, canManage }: JobLaborSectionProps) {
  const [entries, setEntries] = useState<JobLaborRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<ActionFeedback | null>(null);
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
      setFeedback(errorFeedback(json.error || 'Unable to load labor entries.'));
      return;
    }
    setEntries(json.labor || []);
  }, [jobId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function addLabor() {
    if (saving) return;
    const h = Number.parseFloat(hours);
    const rate = Number.parseFloat(hourlyCost || '0');
    if (!Number.isFinite(h) || h <= 0) {
      setFeedback(errorFeedback('Enter hours worked.'));
      return;
    }

    setSaving(true);
    setFeedback(null);
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
      setFeedback(errorFeedback(json.error || 'Unable to save labor entry.'));
      return;
    }

    setFeedback(successFeedback('Labor entry saved.'));
    setWorkerId('');
    setWorkerName('');
    setHours('');
    setHourlyCost('');
    setNotes('');
    void load();
  }

  async function removeEntry(id: string) {
    if (!window.confirm('Delete this labor entry?')) return;
    const res = await fetch(`/api/jobs/${jobId}/labor/${id}`, { method: 'DELETE' });
    if (!res.ok) {
      const json = await res.json();
      setFeedback(errorFeedback(json.error || 'Unable to delete labor entry.'));
      return;
    }
    setFeedback(successFeedback('Labor entry deleted.'));
    void load();
  }

  const totalLabor = entries.reduce((s, e) => s + Number(e.total_cost || 0), 0);

  return (
    <div className="card finance-card">
      <h3>Labor cost</h3>
      <p className="muted">Track hours and hourly cost for this job.</p>

      <ActionFeedbackBanner feedback={feedback} onDismiss={() => setFeedback(null)} />

      {loading ? <p className="loading-state">Loading...</p> : null}

      {!loading && entries.length === 0 ? (
        <p className="muted">No labor entries yet.</p>
      ) : null}

      {!loading && entries.length > 0 ? (
        <div className="finance-list">
          {entries.map((entry) => (
            <div key={entry.id} className="finance-list-card">
              <div>
                <strong>{entry.worker_name || 'Worker'}</strong>
                <p className="muted">
                  {entry.hours} hrs x {formatCurrency(entry.hourly_cost)} = {formatCurrency(entry.total_cost)}
                </p>
                {entry.notes ? <p className="muted">{entry.notes}</p> : null}
              </div>
              {canManage ? (
                <button type="button" className="btn" onClick={() => void removeEntry(entry.id)}>
                  Delete
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
          <label>Worker</label>
          {workers.length > 0 ? (
            <select className="input" value={workerId} onChange={(e) => setWorkerId(e.target.value)}>
              <option value="">Select worker</option>
              {workers.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.name}
                </option>
              ))}
            </select>
          ) : (
            <input
              className="input"
              placeholder="Worker name"
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
            {saving ? 'Saving...' : 'Add labor'}
          </button>
        </div>
      ) : null}
    </div>
  );
}
