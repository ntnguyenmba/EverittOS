'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ActionFeedbackBanner } from '@/components/action-feedback';
import { errorFeedback, successFeedback, type ActionFeedback } from '@/lib/action-messages';
import { ensureWorkspaceForSave } from '@/lib/workspace-client';
import { supabase } from '@/lib/supabase';

type CustomerCreateFormProps = {
  onCreated?: (customerId: string) => void;
  redirectTo?: string;
};

export function CustomerCreateForm({ onCreated, redirectTo = '/customers' }: CustomerCreateFormProps) {
  const router = useRouter();
  const [displayName, setDisplayName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [address, setAddress] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<ActionFeedback | null>(null);

  async function saveCustomer() {
    if (!displayName.trim() || saving) return;

    setSaving(true);
    setFeedback(null);

    const {
      data: { user }
    } = await supabase.auth.getUser();
    if (!user) {
      setSaving(false);
      router.push('/login?next=/customers/new');
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
      body: JSON.stringify({ displayName, phone, email, address, notes })
    });
    const json = (await res.json()) as { customer?: { id: string }; error?: string; message?: string };
    setSaving(false);

    if (!res.ok) {
      setFeedback(errorFeedback(json.error || 'Unable to save customer.'));
      return;
    }

    setFeedback(successFeedback(json.message || 'Customer saved successfully.'));
    setDisplayName('');
    setPhone('');
    setEmail('');
    setAddress('');
    setNotes('');

    if (json.customer?.id) {
      onCreated?.(json.customer.id);
      setTimeout(() => router.push(redirectTo), 600);
    }
  }

  return (
    <div className="card form">
      <h3 className="card-title-sm">New customer</h3>
      <ActionFeedbackBanner feedback={feedback} onDismiss={() => setFeedback(null)} />
      <input className="input" placeholder="Name *" value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
      <input className="input" placeholder="Phone" value={phone} onChange={(e) => setPhone(e.target.value)} />
      <input className="input" placeholder="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
      <input className="input" placeholder="Address" value={address} onChange={(e) => setAddress(e.target.value)} />
      <textarea className="input" rows={3} placeholder="Notes" value={notes} onChange={(e) => setNotes(e.target.value)} />
      <button type="button" className="btn btn-primary" disabled={saving} onClick={() => void saveCustomer()}>
        {saving ? 'Saving…' : 'Save customer'}
      </button>
    </div>
  );
}
