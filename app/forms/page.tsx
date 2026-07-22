'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AppShell } from '@/components/app-shell';
import { LocalizedEmptyState } from '@/components/localized-empty-state';
import { PageHeader } from '@/components/page-header';
import { useAppFeedback } from '@/components/feedback/use-app-feedback';
import { useAsyncAction } from '@/hooks/use-async-action';
import { FEEDBACK } from '@/lib/feedback-labels';
import { fetchOrganizationContext } from '@/lib/organization';
import { normalizePlan, type EverittosPlan } from '@/lib/everittos-plans';
import { isManagerRole, normalizeRole, type UserRole } from '@/lib/roles';
import { supabase } from '@/lib/supabase';
import type { EverittForm, FormType } from '@/lib/os-types';

const FORM_TYPES: { value: FormType; label: string }[] = [
  { value: 'contact', label: 'Contact' },
  { value: 'estimate', label: 'Estimate request' },
  { value: 'lead_capture', label: 'Lead form' },
  { value: 'client_intake', label: 'Customer intake' },
  { value: 'booking', label: 'Booking request' },
  { value: 'custom', label: 'Custom' }
];

function formTypeLabel(value: FormType) {
  return FORM_TYPES.find((type) => type.value === value)?.label || value.replaceAll('_', ' ');
}

export default function FormsPage() {
  const router = useRouter();
  const feedback = useAppFeedback();
  const { busy, runResponse, buttonLabel } = useAsyncAction();
  const [plan, setPlan] = useState<EverittosPlan>('free');
  const [role, setRole] = useState<UserRole>('owner');
  const [forms, setForms] = useState<EverittForm[]>([]);
  const [name, setName] = useState('');
  const [formType, setFormType] = useState<FormType>('contact');
  const [loading, setLoading] = useState(true);
  const [canManage, setCanManage] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const {
      data: { user }
    } = await supabase.auth.getUser();
    if (!user) {
      router.push('/login');
      return;
    }
    const { data: profile } = await supabase.from('profiles').select('plan, role').eq('id', user.id).maybeSingle();
    const org = await fetchOrganizationContext(user.id);
    const userRole = normalizeRole(org?.role || profile?.role);
    setPlan(normalizePlan(profile?.plan));
    setRole(userRole);
    setCanManage(isManagerRole(userRole));

    const res = await fetch('/api/forms');
    const json = await res.json();
    setLoading(false);
    if (!res.ok) {
      feedback.error(json.error || 'Unable to load forms');
      return;
    }
    setForms(json.forms || []);
  }, [feedback, router]);

  useEffect(() => {
    void load();
  }, [load]);

  async function createForm() {
    if (!name.trim() || busy) return;
    const res = await runResponse(
      () =>
        fetch('/api/forms', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: name.trim(), form_type: formType })
        }),
      'created'
    );
    if (!res) return;
    setName('');
    void load();
  }

  async function deleteForm(id: string, formName: string) {
    if (!window.confirm(`Remove ${formName}?`)) return;
    const res = await runResponse(() => fetch(`/api/forms/${id}`, { method: 'DELETE' }), 'deleted');
    if (res) void load();
  }

  return (
    <AppShell plan={plan} role={role}>
      <PageHeader title="Forms" />

      {canManage ? (
        <details className="card" style={{ marginBottom: 18 }}>
          <summary><strong>New form</strong></summary>
          <div className="form" style={{ marginTop: 16 }}>
            <label>Name</label>
            <input className="input" placeholder="Example: Free quote" value={name} onChange={(event) => setName(event.target.value)} />
            <label>Type</label>
            <select className="input" value={formType} onChange={(event) => setFormType(event.target.value as FormType)}>
              {FORM_TYPES.map((type) => (
                <option key={type.value} value={type.value}>{type.label}</option>
              ))}
            </select>
            <button type="button" className="btn btn-primary" disabled={busy || !name.trim()} onClick={() => void createForm()}>
              {buttonLabel('Create', FEEDBACK.loading)}
            </button>
          </div>
        </details>
      ) : null}

      {loading ? <div className="card"><p className="loading-state">Loading...</p></div> : null}
      {!loading && forms.length === 0 ? <LocalizedEmptyState emptyKey="forms" compact /> : null}

      {!loading && forms.length > 0 ? (
        <div style={{ display: 'grid', gap: 14 }}>
          {forms.map((form) => (
            <article key={form.id} className="card">
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'flex-start' }}>
                <div>
                  <h3 style={{ marginBottom: 6 }}>{form.name}</h3>
                  <p className="muted" style={{ marginBottom: 0 }}>{formTypeLabel(form.form_type)}</p>
                </div>
                <span className={`status-pill ${form.active ? 'status-pill-success' : 'status-pill-muted'}`}>
                  {form.active ? 'Active' : 'Off'}
                </span>
              </div>

              <div className="button-row" style={{ marginTop: 14, flexWrap: 'wrap' }}>
                <Link className="btn btn-primary" href={`/forms/${form.id}`}>Open</Link>
                <a className="btn" href={`/f/${form.slug}`} target="_blank" rel="noreferrer">View public form</a>
              </div>

              {canManage ? (
                <details style={{ marginTop: 14 }}>
                  <summary><strong>More</strong></summary>
                  <div className="button-row" style={{ marginTop: 12 }}>
                    <button
                      type="button"
                      className="btn btn-danger"
                      disabled={busy}
                      onClick={() => void deleteForm(form.id, form.name)}
                    >
                      Remove
                    </button>
                  </div>
                </details>
              ) : null}
            </article>
          ))}
        </div>
      ) : null}
    </AppShell>
  );
}
