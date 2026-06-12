'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AppShell } from '@/components/app-shell';
import { LocalizedEmptyState } from '@/components/localized-empty-state';
import { useAppFeedback } from '@/components/feedback/use-app-feedback';
import { useAsyncAction } from '@/hooks/use-async-action';
import { FEEDBACK } from '@/lib/feedback-labels';
import { normalizePlan, type EverittosPlan } from '@/lib/everittos-plans';
import { isManagerRole, normalizeRole, type UserRole } from '@/lib/roles';
import { supabase } from '@/lib/supabase';
import type { EverittForm, FormType } from '@/lib/os-types';

const FORM_TYPES: { value: FormType; label: string }[] = [
  { value: 'contact', label: 'Contact' },
  { value: 'estimate', label: 'Estimate request' },
  { value: 'lead_capture', label: 'Lead capture' },
  { value: 'client_intake', label: 'Client intake' },
  { value: 'booking', label: 'Booking request' },
  { value: 'custom', label: 'Custom' }
];

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

  async function load() {
    setLoading(true);
    const {
      data: { user }
    } = await supabase.auth.getUser();
    if (!user) {
      router.push('/login');
      return;
    }
    const { data: profile } = await supabase.from('profiles').select('plan, role').eq('id', user.id).maybeSingle();
    const userRole = normalizeRole(profile?.role);
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
  }

  useEffect(() => {
    void load();
  }, [router]);

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
    if (!window.confirm(`Delete form ${formName}?`)) return;
    const res = await runResponse(() => fetch(`/api/forms/${id}`, { method: 'DELETE' }), 'deleted');
    if (res) void load();
  }

  return (
    <AppShell plan={plan} role={role}>
      <header className="page-header">
        <h1>Forms</h1>
        <p className="page-subtitle">Public forms that create CRM leads, tasks, and notifications on submit.</p>
      </header>

      {canManage ? (
        <div className="card form" style={{ marginBottom: 18 }}>
          <h3>New form</h3>
          <input className="input" placeholder="Form name" value={name} onChange={(e) => setName(e.target.value)} />
          <select className="input" value={formType} onChange={(e) => setFormType(e.target.value as FormType)}>
            {FORM_TYPES.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
          <button type="button" className="btn btn-primary" disabled={busy} onClick={() => void createForm()}>
            {buttonLabel('Create form', FEEDBACK.loading)}
          </button>
        </div>
      ) : null}

      {loading ? <p>Loading forms…</p> : null}
      {!loading && forms.length === 0 ? <LocalizedEmptyState emptyKey="forms" compact /> : null}

      <div className="card-list">
        {forms.map((form) => (
          <div key={form.id} className="card">
            <div className="card-link-head">
              <Link href={`/forms/${form.id}`}>
                <strong>{form.name}</strong>
              </Link>
              <span className={`status-pill ${form.active ? 'status-pill-success' : 'status-pill-muted'}`}>
                {form.active ? 'Active' : 'Inactive'}
              </span>
            </div>
            <p className="muted">{form.form_type.replace('_', ' ')} · /f/{form.slug}</p>
            {canManage ? (
              <button
                type="button"
                className="btn btn-sm btn-danger"
                disabled={busy}
                onClick={() => void deleteForm(form.id, form.name)}
              >
                Remove
              </button>
            ) : null}
          </div>
        ))}
      </div>
    </AppShell>
  );
}
