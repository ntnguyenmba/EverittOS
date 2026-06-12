'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ActionFeedbackBanner } from '@/components/action-feedback';
import { errorFeedback, successFeedback, type ActionFeedback } from '@/lib/action-messages';
import { LEAD_SOURCE_OPTIONS } from '@/lib/lead-sources';
import { ensureWorkspaceForSave } from '@/lib/workspace-client';
import { supabase } from '@/lib/supabase';

type LeadCreateFormProps = {
  onCreated?: (leadId: string) => void;
  redirectTo?: string;
};

export function LeadCreateForm({ onCreated, redirectTo = '/leads' }: LeadCreateFormProps) {
  const router = useRouter();
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [leadSource, setLeadSource] = useState('website');
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<ActionFeedback | null>(null);

  async function saveLead() {
    if (!displayName.trim() || saving) return;

    setSaving(true);
    setFeedback(null);

    const {
      data: { user }
    } = await supabase.auth.getUser();
    if (!user) {
      setSaving(false);
      router.push('/login?next=/leads/new');
      return;
    }

    const org = await ensureWorkspaceForSave(user.id);
    if (!org?.organizationId) {
      setSaving(false);
      setFeedback(errorFeedback('Workspace setup is still finishing. Wait a moment and try again.'));
      return;
    }

    const res = await fetch('/api/customers', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        displayName,
        email,
        phone,
        pipeline_stage: 'lead',
        lead_source: leadSource,
        record_type: 'lead'
      })
    });
    const json = (await res.json()) as { customer?: { id: string }; error?: string; message?: string };
    setSaving(false);

    if (!res.ok) {
      setFeedback(errorFeedback(json.error || 'Unable to save lead.'));
      return;
    }

    setFeedback(successFeedback(json.message || 'Lead saved successfully.'));
    setDisplayName('');
    setEmail('');
    setPhone('');
    setLeadSource('website');

    if (json.customer?.id) {
      onCreated?.(json.customer.id);
      setTimeout(() => router.push(redirectTo), 600);
    }
  }

  return (
    <div className="card form">
      <h3 className="card-title-sm">New lead</h3>
      <ActionFeedbackBanner feedback={feedback} onDismiss={() => setFeedback(null)} />
      <input className="input" placeholder="Name *" value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
      <input className="input" placeholder="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
      <input className="input" placeholder="Phone" value={phone} onChange={(e) => setPhone(e.target.value)} />
      <label className="auth-field">
        <span>Lead Source</span>
        <select className="input" value={leadSource} onChange={(e) => setLeadSource(e.target.value)}>
          {LEAD_SOURCE_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </label>
      <button type="button" className="btn btn-primary" disabled={saving} onClick={() => void saveLead()}>
        {saving ? 'Saving…' : 'Save lead'}
      </button>
    </div>
  );
}
