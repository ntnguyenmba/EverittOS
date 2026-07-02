'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { useAppFeedback } from '@/components/feedback/use-app-feedback';
import { cadenceLabel, RECURRING_CADENCES } from '@/lib/recurring-invoices';

type RecurringRun = {
  id: string;
  run_for_date: string;
  status: string;
  invoice_id: string | null;
  created_at: string;
};

type RecurringTemplate = {
  id: string;
  title: string;
  amount: number;
  cadence: string;
  next_run_on: string | null;
  active: boolean;
  recurring_invoice_runs?: RecurringRun[];
};

const EMPTY_FORM = {
  title: '',
  amount: '',
  cadence: 'monthly',
  next_run_on: new Date().toISOString().slice(0, 10)
};

export function RecurringInvoicesPanel({ canManage }: { canManage: boolean }) {
  const appFeedback = useAppFeedback();
  const [templates, setTemplates] = useState<RecurringTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [schemaReady, setSchemaReady] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [runningId, setRunningId] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch('/api/recurring-invoices');
    const json = await res.json();
    setLoading(false);
    if (!res.ok) {
      appFeedback.error(json.error || 'Unable to load recurring invoices.');
      return;
    }
    if (json.schemaReady === false) {
      setSchemaReady(false);
      setTemplates([]);
      return;
    }
    setSchemaReady(true);
    setTemplates(json.templates || []);
  }, [appFeedback]);

  useEffect(() => {
    void load();
  }, [load]);

  async function createTemplate() {
    if (!canManage) return;
    setSaving(true);
    const res = await fetch('/api/recurring-invoices', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form)
    });
    const json = await res.json();
    setSaving(false);
    if (!res.ok) {
      appFeedback.error(json.error || 'Unable to create template.');
      return;
    }
    appFeedback.saved();
    setShowForm(false);
    setForm(EMPTY_FORM);
    void load();
  }

  async function toggleActive(template: RecurringTemplate) {
    const res = await fetch(`/api/recurring-invoices/${template.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ active: !template.active })
    });
    const json = await res.json();
    if (!res.ok) {
      appFeedback.error(json.error || 'Unable to update template.');
      return;
    }
    void load();
  }

  async function runNow(template: RecurringTemplate) {
    setRunningId(template.id);
    const res = await fetch(`/api/recurring-invoices/${template.id}/run-now`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sendEmail: false })
    });
    const json = await res.json();
    setRunningId('');
    if (!res.ok) {
      appFeedback.error(json.error || 'Unable to run template.');
      return;
    }
    appFeedback.success(json.message || 'Draft invoice created. Check the Drafts tab above.');
    void load();
  }

  if (!schemaReady) {
    return (
      <div className="card" role="status">
        <p className="muted">Recurring invoice tables are not set up yet. Run the latest Supabase migrations, then refresh.</p>
      </div>
    );
  }

  return (
    <section className="card" style={{ marginTop: 16 }}>
      <div className="page-header" style={{ marginBottom: 12 }}>
        <div>
          <h2>Recurring invoices</h2>
          <p className="page-subtitle">Generate draft invoices on a schedule. Nothing is auto-charged or auto-sent.</p>
        </div>
        {canManage ? (
          <button type="button" className="btn btn-primary" onClick={() => setShowForm((v) => !v)}>
            {showForm ? 'Close' : 'Add template'}
          </button>
        ) : null}
      </div>

      {showForm && canManage ? (
        <div style={{ marginBottom: 16 }}>
          <input className="input" placeholder="Title" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
          <input className="input" type="number" min="0" step="0.01" placeholder="Amount" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} style={{ marginTop: 8 }} />
          <select className="input" value={form.cadence} onChange={(e) => setForm({ ...form, cadence: e.target.value })} style={{ marginTop: 8 }}>
            {RECURRING_CADENCES.map((c) => (
              <option key={c} value={c}>
                {cadenceLabel(c)}
              </option>
            ))}
          </select>
          <input className="input" type="date" value={form.next_run_on} onChange={(e) => setForm({ ...form, next_run_on: e.target.value })} style={{ marginTop: 8 }} />
          <button type="button" className="btn btn-primary" style={{ marginTop: 8 }} disabled={saving} onClick={() => void createTemplate()}>
            {saving ? 'Saving…' : 'Save template'}
          </button>
        </div>
      ) : null}

      {loading ? <p className="muted">Loading recurring templates…</p> : null}
      {!loading && templates.length === 0 ? <p className="muted">No recurring invoice templates yet.</p> : null}
      {!loading && templates.length > 0 ? (
        <table className="table">
          <thead>
            <tr>
              <th>Title</th>
              <th>Amount</th>
              <th>Cadence</th>
              <th>Next run</th>
              <th>Status</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {templates.map((template) => (
              <tr key={template.id}>
                <td>{template.title}</td>
                <td>{Number(template.amount).toLocaleString(undefined, { style: 'currency', currency: 'USD' })}</td>
                <td>{cadenceLabel(template.cadence)}</td>
                <td>{template.next_run_on || 'Not set'}</td>
                <td>{template.active ? 'Active' : 'Paused'}</td>
                <td className="table-actions">
                  {canManage ? (
                    <>
                      <button type="button" className="btn btn-sm" disabled={runningId === template.id} onClick={() => void runNow(template)}>
                        {runningId === template.id ? 'Running…' : 'Run now'}
                      </button>
                      <button type="button" className="btn btn-sm" onClick={() => void toggleActive(template)}>
                        {template.active ? 'Pause' : 'Resume'}
                      </button>
                    </>
                  ) : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : null}

      {!loading && templates.some((t) => (t.recurring_invoice_runs || []).length) ? (
        <div style={{ marginTop: 16 }}>
          <h3>Recent runs</h3>
          <ul>
            {templates.flatMap((t) =>
              (t.recurring_invoice_runs || []).slice(0, 3).map((run) => (
                <li key={run.id} className="muted">
                  {t.title} · {run.run_for_date} · {run.status}
                  {run.invoice_id ? (
                    <>
                      {' '}
                      · <Link href="/invoices">Invoice created</Link>
                    </>
                  ) : null}
                </li>
              ))
            )}
          </ul>
        </div>
      ) : null}
    </section>
  );
}
