'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAppFeedback } from '@/components/feedback/use-app-feedback';
import { FEEDBACK } from '@/lib/feedback-labels';
import { useTeamOptions } from '@/lib/team-options-client';
import { ensureWorkspaceForSave } from '@/lib/workspace-client';
import { supabase } from '@/lib/supabase';

type CustomerCreateFormProps = {
  onCreated?: (customerId: string) => void;
  redirectTo?: string;
};

export function CustomerCreateForm({ onCreated, redirectTo = '/customers' }: CustomerCreateFormProps) {
  const router = useRouter();
  const appFeedback = useAppFeedback();
  const { teamOptions, teamOptionsLoading } = useTeamOptions();
  const [displayName, setDisplayName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [address, setAddress] = useState('');
  const [notes, setNotes] = useState('');
  const [assignedTo, setAssignedTo] = useState('');
  const [saving, setSaving] = useState(false);

  async function saveCustomer() {
    if (!displayName.trim() || saving) return;
    setSaving(true);

    const { data: auth } = await supabase.auth.getUser();
    const user = auth.user;
    if (!user) {
      setSaving(false);
      router.push('/login?next=/customers/new');
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
      body: JSON.stringify({ displayName, phone, email, address, notes, assigned_to: assignedTo || null, record_type: 'customer', pipeline_stage: 'active' })
    });
    const json = (await res.json()) as { customer?: { id: string }; error?: string };
    setSaving(false);

    if (!res.ok) {
      appFeedback.error(json.error || 'Unable to save customer.');
      return;
    }

    appFeedback.created();
    setDisplayName('');
    setPhone('');
    setEmail('');
    setAddress('');
    setNotes('');
    setAssignedTo('');

    if (json.customer?.id) {
      onCreated?.(json.customer.id);
      setTimeout(() => router.push(redirectTo), 600);
    }
  }

  return (
    <div className="card form">
      <h3 className="card-title-sm">New customer</h3>
      <input className="input" placeholder="Name *" value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
      <input className="input" placeholder="Phone" value={phone} onChange={(e) => setPhone(e.target.value)} />
      <input className="input" placeholder="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
      <input className="input" placeholder="Address" value={address} onChange={(e) => setAddress(e.target.value)} />
      <label>Assign to</label>
      <select className="input" value={assignedTo} disabled={teamOptionsLoading} onChange={(e) => setAssignedTo(e.target.value)}>
        <option value="">Unassigned</option>
        {teamOptions.map((member) => (
          <option key={member.userId} value={member.userId}>{member.label} - {member.role}</option>
        ))}
      </select>
      <textarea className="input" rows={3} placeholder="Notes" value={notes} onChange={(e) => setNotes(e.target.value)} />
      <button type="button" className="btn btn-primary" disabled={saving} onClick={() => void saveCustomer()}>
        {saving ? FEEDBACK.loading : 'Save customer'}
      </button>
    </div>
  );
}
