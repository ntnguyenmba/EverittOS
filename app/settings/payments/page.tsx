'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { SettingsShell } from '@/components/settings/settings-shell';
import { useTranslation } from '@/components/locale-provider';
import { supabase } from '@/lib/supabase';
import { ensureOrganizationForUser } from '@/lib/workspace-client';
import { normalizePlan, type EverittosPlan } from '@/lib/everittos-plans';
import { normalizeRole } from '@/lib/roles';

type Method = '' | 'stripe' | 'square' | 'paypal' | 'venmo' | 'zelle' | 'cash_app' | 'custom';

export default function InvoicePaymentSettingsPage() {
  const router = useRouter();
  const { locale } = useTranslation();
  const copy = {
    en: { saving: 'Saving…', save: 'Save payment preference' },
    es: { saving: 'Guardando…', save: 'Guardar preferencia de pago' },
    vi: { saving: 'Đang lưu…', save: 'Lưu phương thức thanh toán' }
  }[locale];
  const [plan, setPlan] = useState<EverittosPlan>('free');
  const [role, setRole] = useState(normalizeRole('owner'));
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [method, setMethod] = useState<Method>('');
  const [link, setLink] = useState('');
  const [instructions, setInstructions] = useState('');

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push('/login?next=/settings/payments'); return; }
      const { data: profile } = await supabase.from('profiles').select('plan,role').eq('id', user.id).maybeSingle();
      setPlan(normalizePlan(profile?.plan)); setRole(normalizeRole(profile?.role));
      const org = await ensureOrganizationForUser(user.id);
      if (org) {
        const { data } = await supabase.from('organization_settings').select('preferred_payment_method,payment_link,payment_instructions').eq('organization_id', org.organizationId).maybeSingle();
        setMethod((data?.preferred_payment_method || '') as Method); setLink(data?.payment_link || ''); setInstructions(data?.payment_instructions || '');
      }
      setLoading(false);
    }
    void load();
  }, [router]);

  async function save() {
    if (saving) return;
    setSaving(true); setMessage('');
    const res = await fetch('/api/settings/payments', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ preferredPaymentMethod: method, paymentLink: link, paymentInstructions: instructions }) });
    const json = await res.json().catch(() => ({})); setSaving(false);
    setMessage(res.ok ? 'Invoice payment preference saved.' : json.error || 'Unable to save payment preference.');
  }

  return <SettingsShell plan={plan} role={role} title="Invoice payments">
    {loading ? <p className="loading-state">Loading…</p> : <section className="settings-card form settings-form-grid">
      <p className="muted">Choose how customers should pay invoices. EverittOS will put this payment action directly in invoice emails.</p>
      <label htmlFor="payment-method">Preferred payment method</label>
      <select id="payment-method" className="input" value={method} onChange={(e) => setMethod(e.target.value as Method)}><option value="">No payment action</option><option value="stripe">Stripe</option><option value="square">Square</option><option value="paypal">PayPal</option><option value="venmo">Venmo</option><option value="zelle">Zelle</option><option value="cash_app">Cash App</option><option value="custom">Other payment link</option></select>
      <label htmlFor="payment-link">Payment link</label><input id="payment-link" className="input" type="url" inputMode="url" placeholder="https://..." value={link} onChange={(e) => setLink(e.target.value)} />
      <p className="muted">Paste the HTTPS link customers should open. Leave this blank for Zelle if you only want to show payment instructions.</p>
      <label htmlFor="payment-instructions">Payment instructions</label><textarea id="payment-instructions" className="input" rows={4} placeholder="Example: Zelle to billing@example.com. Include your invoice number in the memo." value={instructions} onChange={(e) => setInstructions(e.target.value)} />
      {message ? <p role="status">{message}</p> : null}
      <div className="button-row" style={{ flexWrap: 'wrap' }}><button className="btn btn-primary" type="button" onClick={() => void save()} disabled={saving}>{saving ? copy.saving : copy.save}</button><Link className="btn" href="/invoices">Back to invoices</Link></div>
    </section>}
  </SettingsShell>;
}
