'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { AppShell } from '@/components/app-shell';
import { normalizePlan, type EverittosPlan } from '@/lib/everittos-plans';
import { isManagerRole, normalizeRole, type UserRole } from '@/lib/roles';
import { supabase } from '@/lib/supabase';
import type { EverittForm, EverittFormField } from '@/lib/os-types';

type FormDetail = EverittForm & { everitt_form_fields?: EverittFormField[] };

export default function FormDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = String(params.id);
  const [plan, setPlan] = useState<EverittosPlan>('free');
  const [role, setRole] = useState<UserRole>('owner');
  const [form, setForm] = useState<FormDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [canManage, setCanManage] = useState(false);
  const [copied, setCopied] = useState(false);

  const publicUrl =
    typeof window !== 'undefined' ? `${window.location.origin}/f/${form?.slug || ''}` : `/f/${form?.slug || ''}`;
  const embedCode = form ? `<iframe src="${publicUrl}" width="100%" height="520" frameborder="0"></iframe>` : '';

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

    const res = await fetch(`/api/forms/${id}`);
    const json = await res.json();
    setLoading(false);
    if (!res.ok) {
      setMessage(json.error || 'Form not found');
      return;
    }
    setForm(json.form);
  }

  useEffect(() => {
    void load();
  }, [id, router]);

  async function toggleActive() {
    if (!form || !canManage) return;
    const res = await fetch(`/api/forms/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ active: !form.active })
    });
    if (!res.ok) {
      const json = await res.json();
      setMessage(json.error || 'Update failed');
      return;
    }
    void load();
  }

  async function copyEmbed() {
    if (!embedCode) return;
    await navigator.clipboard.writeText(embedCode);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2000);
  }

  if (loading) {
    return (
      <AppShell plan={plan} role={role}>
        <p>Loading…</p>
      </AppShell>
    );
  }

  if (!form) {
    return (
      <AppShell plan={plan} role={role}>
        <p className="auth-message auth-message-error">{message || 'Form not found'}</p>
      </AppShell>
    );
  }

  const fields = form.everitt_form_fields || [];

  return (
    <AppShell plan={plan} role={role}>
      <header className="page-header">
        <h1>{form.name}</h1>
        <p className="page-subtitle">{form.description || 'Share this form publicly or embed it on your site.'}</p>
      </header>

      <div className="card" style={{ marginBottom: 16 }}>
        <h3>Public link</h3>
        <p>
          <a href={`/f/${form.slug}`} target="_blank" rel="noreferrer">
            {publicUrl}
          </a>
        </p>
        {canManage ? (
          <button type="button" className="btn" onClick={() => void toggleActive()}>
            {form.active ? 'Deactivate' : 'Activate'}
          </button>
        ) : null}
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <h3>Embed code</h3>
        <pre className="code-block">{embedCode}</pre>
        <button type="button" className="btn" onClick={() => void copyEmbed()}>
          {copied ? 'Copied' : 'Copy embed'}
        </button>
      </div>

      <div className="card">
        <h3>Fields</h3>
        {fields.length === 0 ? <p className="muted">No fields configured.</p> : null}
        <ul>
          {fields
            .sort((a, b) => a.sort_order - b.sort_order)
            .map((f) => (
              <li key={f.id}>
                {f.label} <span className="muted">({f.field_type}){f.required ? ' · required' : ''}</span>
              </li>
            ))}
        </ul>
      </div>

      {message ? <p className="auth-message auth-message-error">{message}</p> : null}
    </AppShell>
  );
}
