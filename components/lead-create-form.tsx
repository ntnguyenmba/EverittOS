'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAppFeedback } from '@/components/feedback/use-app-feedback';
import { FEEDBACK } from '@/lib/feedback-labels';
import { LEAD_SOURCE_OPTIONS } from '@/lib/lead-sources';
import { useTeamOptions } from '@/lib/team-options-client';
import { ensureWorkspaceForSave } from '@/lib/workspace-client';
import { supabase } from '@/lib/supabase';

type RequestCreateFormProps = {
  onCreated?: (requestId: string) => void;
  redirectTo?: string;
};

export function RequestCreateForm({ onCreated, redirectTo = '/leads' }: RequestCreateFormProps) {
  const router = useRouter();
  const appFeedback = useAppFeedback();
  const { teamOptions, teamOptionsLoading } = useTeamOptions();
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [notes, setNotes] = useState('');
  const [assignedTo, setAssignedTo] = useState('');
  const [requestSource, setRequestSource] = useState('website');
  const [saving, setSaving] = useState(false);

  async function saveRequest() {
    if (saving) return;
    if (!displayName.trim()) {
      appFeedback.error('Name is required.');
      return;
    }

    setSaving(true);

    const { data: auth } = await supabase.auth.getUser();
    const user = auth.user;
    if (!user) {
      setSaving(false);
      router.push('/login?next=/leads/new');
      return;
    }

    const workspace = await ensureWorkspaceForSave(user.id);
    if (!workspace.ok) {
      setSaving(false);
      appFeedback.error(workspace.error);
      return;
    }

    const res = await fetch('/api/customers', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        displayName,
        email,
        phone,
        address,
        notes,
        assigned_to: assignedTo || null,
        pipeline_stage: 'open',
        lead_source: requestSource,
        record_type: 'lead'
      })
    });
    const json = (await res.json()) as { customer?: { id: string }; error?: string; message?: string };
    setSaving(false);

    if (!res.ok) {
      appFeedback.error(json.error || 'Unable to save request.');
      return;
    }

    appFeedback.created();
    setDisplayName('');
    setEmail('');
    setPhone('');
    setAddress('');
    setNotes('');
    setAssignedTo('');
    setRequestSource('website');

    if (json.customer?.id) {
      onCreated?.(json.customer.id);
      const nextPath = redirectTo === '/leads' ? `/leads/${json.customer.id}` : redirectTo;
      setTimeout(() => router.push(nextPath), 600);
    } else {
      appFeedback.error('Request saved but could not be opened. Refresh and try again.');
    }
  }

  return (
    <div className="card form">
      <h3 className="card-title-sm">Request details</h3>
      <input className="input" placeholder="Name *" value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
      <input className="input" placeholder="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
      <input className="input" placeholder="Phone" value={phone} onChange={(e) => setPhone(e.target.value)} />
      <input className="input" placeholder="Address" value={address} onChange={(e) => setAddress(e.target.value)} />
      <label>Assign to</label>
      <select className="input" value={assignedTo} disabled={teamOptionsLoading} onChange={(e) => setAssignedTo(e.target.value)}>
        <option value="">Unassigned</option>
        {teamOptions.map((member) => (
          <option key={member.userId} value={member.userId}>{member.label} - {member.role}</option>
        ))}
      </select>
      <label className="auth-field">
        <span>How they found you</span>
        <select className="input" value={requestSource} onChange={(e) => setRequestSource(e.target.value)}>
          {LEAD_SOURCE_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </label>
      <textarea className="input" rows={4} placeholder="Notes" value={notes} onChange={(e) => setNotes(e.target.value)} />
      <button type="button" className="btn btn-primary" disabled={saving} onClick={() => void saveRequest()}>
        {saving ? FEEDBACK.loading : 'Save request'}
      </button>
    </div>
  );
}

// Keep the old export temporarily so existing imports do not break.
export const LeadCreateForm = RequestCreateForm;
