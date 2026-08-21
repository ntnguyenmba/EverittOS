'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { AppShell } from '@/components/app-shell';
import { useAppFeedback } from '@/components/feedback/use-app-feedback';
import { useAsyncAction } from '@/hooks/use-async-action';
import { DEFAULT_ESTIMATE_SETTINGS, normalizeEstimateSettings, type EstimateSettings } from '@/lib/estimate-engine';
import { FEEDBACK } from '@/lib/feedback-labels';
import { fetchOrganizationContext } from '@/lib/organization';
import { normalizePlan, type EverittosPlan } from '@/lib/everittos-plans';
import { isManagerRole, normalizeRole, type UserRole } from '@/lib/roles';
import { supabase } from '@/lib/supabase';
import type { EverittForm, EverittFormField } from '@/lib/os-types';

type FormDetail = EverittForm & { settings?: Record<string, unknown>; everitt_form_fields?: EverittFormField[] };

export default function FormDetailPage() {
  const params = useParams();
  const router = useRouter();
  const feedback = useAppFeedback();
  const { busy, runResponse, buttonLabel } = useAsyncAction();
  const id = String(params.id);
  const [plan, setPlan] = useState<EverittosPlan>('free');
  const [role, setRole] = useState<UserRole>('owner');
  const [form, setForm] = useState<FormDetail | null>(null);
  const [pricing, setPricing] = useState<Required<EstimateSettings>>(DEFAULT_ESTIMATE_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [canManage, setCanManage] = useState(false);

  const publicUrl = typeof window !== 'undefined' ? `${window.location.origin}/f/${form?.slug || ''}` : `/f/${form?.slug || ''}`;
  const embedCode = form ? `<iframe src="${publicUrl}" width="100%" height="760" frameborder="0"></iframe>` : '';

  async function load() {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { router.push('/login'); return; }
    const { data: profile } = await supabase.from('profiles').select('plan, role').eq('id', user.id).maybeSingle();
    const org = await fetchOrganizationContext(user.id);
    const userRole = normalizeRole(org?.role || profile?.role);
    setPlan(normalizePlan(profile?.plan));
    setRole(userRole);
    setCanManage(isManagerRole(userRole));
    const res = await fetch(`/api/forms/${id}`);
    const json = await res.json();
    setLoading(false);
    if (!res.ok) { feedback.error(json.error || 'Form not found'); return; }
    setForm(json.form);
    if (json.form?.form_type === 'estimate') setPricing(normalizeEstimateSettings(json.form.settings));
  }

  useEffect(() => { void load(); }, [id, router]);

  async function toggleActive() {
    if (!form || !canManage) return;
    const res = await runResponse(() => fetch(`/api/forms/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ active: !form.active }) }), 'updated');
    if (res) void load();
  }

  async function savePricing() {
    if (!form || !canManage) return;
    const res = await runResponse(() => fetch(`/api/forms/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ settings: { ...(form.settings || {}), estimate: pricing } }) }), 'updated');
    if (res) { feedback.success('Estimate pricing saved.'); void load(); }
  }

  function setNumber(key: keyof EstimateSettings, raw: string) {
    setPricing((current) => ({ ...current, [key]: Number(raw) || 0 }));
  }

  function setBase(service: string, raw: string) {
    setPricing((current) => ({ ...current, basePrices: { ...current.basePrices, [service]: Number(raw) || 0 } }));
  }

  async function copyEmbed() {
    if (!embedCode) return;
    try { await navigator.clipboard.writeText(embedCode); feedback.success(FEEDBACK.copied); } catch { feedback.error('Copy the embed code manually.'); }
  }

  if (loading) return <AppShell plan={plan} role={role}><p>Loading…</p></AppShell>;
  if (!form) return <AppShell plan={plan} role={role}><p>Form not found</p></AppShell>;
  const fields = form.everitt_form_fields || [];

  return (
    <AppShell plan={plan} role={role}>
      <header className="page-header"><div><h1>{form.name}</h1><p className="page-subtitle">{form.description || 'Share this form publicly or embed it on your site.'}</p></div></header>

      {form.form_type === 'estimate' ? (
        <div className="card" style={{ marginBottom: 18 }}>
          <h3>Estimate helper</h3>
          <p className="muted">Set your starting prices once. EverittOS shows customers a range, never a locked final price.</p>
          <div className="form" style={{ marginTop: 16 }}>
            <label>Currency</label>
            <input className="input" value={pricing.currency} onChange={(e) => setPricing((p) => ({ ...p, currency: e.target.value.toUpperCase() }))} disabled={!canManage} />
            <label>Minimum charge</label>
            <input className="input" type="number" min="0" value={pricing.minimumCharge} onChange={(e) => setNumber('minimumCharge', e.target.value)} disabled={!canManage} />
            <label>Standard cleaning starting price</label>
            <input className="input" type="number" min="0" value={pricing.basePrices['standard cleaning'] || 0} onChange={(e) => setBase('standard cleaning', e.target.value)} disabled={!canManage} />
            <label>Deep cleaning starting price</label>
            <input className="input" type="number" min="0" value={pricing.basePrices['deep cleaning'] || 0} onChange={(e) => setBase('deep cleaning', e.target.value)} disabled={!canManage} />
            <label>Move-in / Move-out starting price</label>
            <input className="input" type="number" min="0" value={pricing.basePrices['move-in / move-out'] || 0} onChange={(e) => setBase('move-in / move-out', e.target.value)} disabled={!canManage} />
            <label>Extra bedroom</label>
            <input className="input" type="number" min="0" value={pricing.bedroomAmount} onChange={(e) => setNumber('bedroomAmount', e.target.value)} disabled={!canManage} />
            <label>Extra bathroom</label>
            <input className="input" type="number" min="0" value={pricing.bathroomAmount} onChange={(e) => setNumber('bathroomAmount', e.target.value)} disabled={!canManage} />
            <label>Range on each side (%)</label>
            <input className="input" type="number" min="0" max="50" value={pricing.rangePercent} onChange={(e) => setNumber('rangePercent', e.target.value)} disabled={!canManage} />
            {canManage ? <button className="btn btn-primary" type="button" disabled={busy} onClick={() => void savePricing()}>{buttonLabel('Save pricing', FEEDBACK.loading)}</button> : null}
          </div>
        </div>
      ) : null}

      <div className="card" style={{ marginBottom: 16 }}>
        <h3>Public link</h3>
        <p><a href={`/f/${form.slug}`} target="_blank" rel="noreferrer">{publicUrl}</a></p>
        {canManage ? <button type="button" className="btn" disabled={busy} onClick={() => void toggleActive()}>{buttonLabel(form.active ? 'Deactivate' : 'Activate', FEEDBACK.loading)}</button> : null}
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <h3>Put it on your website</h3>
        <pre className="code-block">{embedCode}</pre>
        <button type="button" className="btn" onClick={() => void copyEmbed()}>Copy embed</button>
      </div>

      <div className="card">
        <h3>What customers answer</h3>
        {fields.length === 0 ? <p className="muted">No fields configured.</p> : null}
        <ul>{fields.sort((a, b) => a.sort_order - b.sort_order).map((field) => <li key={field.id}>{field.label} <span className="muted">{field.required ? '· required' : ''}</span></li>)}</ul>
      </div>
    </AppShell>
  );
}
