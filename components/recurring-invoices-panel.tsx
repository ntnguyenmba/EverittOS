'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { useAppFeedback } from '@/components/feedback/use-app-feedback';
import { useTranslation } from '@/components/locale-provider';
import { RECURRING_CADENCES } from '@/lib/recurring-invoices';

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
  const { t } = useTranslation();
  const appFeedback = useAppFeedback();
  const [templates, setTemplates] = useState<RecurringTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [schemaReady, setSchemaReady] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [runningId, setRunningId] = useState('');

  const cadenceLabel = useCallback(
    (cadence: string) => {
      const key = `pages.recurring.cadence.${cadence}` as const;
      const translated = t(key);
      return translated === key ? t('pages.recurring.cadence.monthly') : translated;
    },
    [t]
  );

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch('/api/recurring-invoices');
    const json = await res.json();
    setLoading(false);
    if (!res.ok) {
      appFeedback.error(json.error || t('pages.recurring.loadError'));
      return;
    }
    if (json.schemaReady === false) {
      setSchemaReady(false);
      setTemplates([]);
      return;
    }
    setSchemaReady(true);
    setTemplates(json.templates || []);
  }, [appFeedback, t]);

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
      appFeedback.error(json.error || t('pages.recurring.createError'));
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
      appFeedback.error(json.error || t('pages.recurring.updateError'));
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
      appFeedback.error(json.error || t('pages.recurring.runError'));
      return;
    }
    appFeedback.success(json.message || t('pages.recurring.draftCreated'));
    void load();
  }

  if (!schemaReady) {
    return (
      <div className="card" role="status">
        <p className="muted">{t('pages.recurring.schemaNotReady')}</p>
      </div>
    );
  }

  return (
    <section className="card" style={{ marginTop: 16 }}>
      <div className="page-header" style={{ marginBottom: 12 }}>
        <div>
          <h2>{t('pages.recurring.title')}</h2>
          <p className="page-subtitle">{t('pages.recurring.subtitle')}</p>
        </div>
        {canManage ? (
          <button type="button" className="btn btn-primary" onClick={() => setShowForm((v) => !v)}>
            {showForm ? t('pages.recurring.close') : t('pages.recurring.addTemplate')}
          </button>
        ) : null}
      </div>

      {showForm && canManage ? (
        <div style={{ marginBottom: 16 }}>
          <input className="input" placeholder={t('pages.recurring.titleField')} value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
          <input className="input" type="number" min="0" step="0.01" placeholder={t('pages.recurring.amount')} value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} style={{ marginTop: 8 }} />
          <select className="input" value={form.cadence} onChange={(e) => setForm({ ...form, cadence: e.target.value })} style={{ marginTop: 8 }}>
            {RECURRING_CADENCES.map((c) => (
              <option key={c} value={c}>
                {cadenceLabel(c)}
              </option>
            ))}
          </select>
          <input className="input" type="date" value={form.next_run_on} onChange={(e) => setForm({ ...form, next_run_on: e.target.value })} style={{ marginTop: 8 }} />
          <button type="button" className="btn btn-primary" style={{ marginTop: 8 }} disabled={saving} onClick={() => void createTemplate()}>
            {saving ? t('pages.recurring.saving') : t('pages.recurring.saveTemplate')}
          </button>
        </div>
      ) : null}

      {loading ? <p className="muted">{t('pages.recurring.loading')}</p> : null}
      {!loading && templates.length === 0 ? <p className="muted">{t('pages.recurring.empty')}</p> : null}
      {!loading && templates.length > 0 ? (
        <table className="table">
          <thead>
            <tr>
              <th>{t('pages.recurring.colTitle')}</th>
              <th>{t('pages.recurring.colAmount')}</th>
              <th>{t('pages.recurring.colCadence')}</th>
              <th>{t('pages.recurring.colNextRun')}</th>
              <th>{t('pages.recurring.colStatus')}</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {templates.map((template) => (
              <tr key={template.id}>
                <td>{template.title}</td>
                <td>{Number(template.amount).toLocaleString(undefined, { style: 'currency', currency: 'USD' })}</td>
                <td>{cadenceLabel(template.cadence)}</td>
                <td>{template.next_run_on || t('pages.recurring.notSet')}</td>
                <td>{template.active ? t('pages.recurring.active') : t('pages.recurring.paused')}</td>
                <td className="table-actions">
                  {canManage ? (
                    <>
                      <button type="button" className="btn btn-sm" disabled={runningId === template.id} onClick={() => void runNow(template)}>
                        {runningId === template.id ? t('pages.recurring.running') : t('pages.recurring.runNow')}
                      </button>
                      <button type="button" className="btn btn-sm" onClick={() => void toggleActive(template)}>
                        {template.active ? t('pages.recurring.pause') : t('pages.recurring.resume')}
                      </button>
                    </>
                  ) : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : null}

      {!loading && templates.some((row) => (row.recurring_invoice_runs || []).length) ? (
        <div style={{ marginTop: 16 }}>
          <h3>{t('pages.recurring.recentRuns')}</h3>
          <ul>
            {templates.flatMap((row) =>
              (row.recurring_invoice_runs || []).slice(0, 3).map((run) => (
                <li key={run.id} className="muted">
                  {row.title} · {run.run_for_date} · {run.status}
                  {run.invoice_id ? (
                    <>
                      {' '}
                      · <Link href={`/invoices?invoiceId=${encodeURIComponent(run.invoice_id)}`} target="_blank" rel="noopener noreferrer">{t('pages.recurring.invoiceCreated')}</Link>
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
