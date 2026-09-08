'use client';

import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAppFeedback } from '@/components/feedback/use-app-feedback';
import { useTranslation } from '@/components/locale-provider';
import { FEEDBACK } from '@/lib/feedback-labels';
import { getCustomerCreateCopy } from '@/lib/i18n/customer-create-copy';
import { useTeamOptions } from '@/lib/team-options-client';
import { ensureWorkspaceForSave } from '@/lib/workspace-client';
import { supabase } from '@/lib/supabase';

type CustomerCreateFormProps = {
  onCreated?: (customerId: string) => void;
  redirectTo?: string;
};

const SAVE_TIMEOUT_MS = 15_000;

export function CustomerCreateForm({ onCreated, redirectTo = '/customers' }: CustomerCreateFormProps) {
  const router = useRouter();
  const appFeedback = useAppFeedback();
  const { locale } = useTranslation();
  const copy = getCustomerCreateCopy(locale);
  const { teamOptions, teamOptionsLoading } = useTeamOptions();
  const [displayName, setDisplayName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [address, setAddress] = useState('');
  const [notes, setNotes] = useState('');
  const [assignedTo, setAssignedTo] = useState('');
  const [saving, setSaving] = useState(false);

  async function saveCustomer(event?: FormEvent<HTMLFormElement>) {
    event?.preventDefault();
    if (!displayName.trim() || saving) return;

    setSaving(true);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), SAVE_TIMEOUT_MS);

    try {
      const { data: auth, error: authError } = await supabase.auth.getUser();
      if (authError) throw authError;

      const user = auth.user;
      if (!user) {
        router.replace('/login?next=/customers/new');
        return;
      }

      const workspace = await ensureWorkspaceForSave(user.id);
      if (!workspace.ok) {
        appFeedback.error(workspace.error);
        return;
      }

      const res = await fetch('/api/customers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        cache: 'no-store',
        signal: controller.signal,
        body: JSON.stringify({
          displayName: displayName.trim(),
          phone: phone.trim(),
          email: email.trim(),
          address: address.trim(),
          notes: notes.trim(),
          assigned_to: assignedTo || null,
          record_type: 'customer',
          pipeline_stage: 'active'
        })
      });
      const json = (await res.json().catch(() => ({}))) as { customer?: { id: string }; error?: string };

      if (!res.ok || !json.customer?.id) {
        appFeedback.error(json.error || copy.unableToSave);
        return;
      }

      appFeedback.created();
      onCreated?.(json.customer.id);
      router.push(redirectTo);
      router.refresh();
    } catch (error) {
      const message =
        error instanceof DOMException && error.name === 'AbortError'
          ? 'Saving took too long. Check your connection and try again.'
          : error instanceof Error && error.message
            ? error.message
            : copy.unableToSave;
      appFeedback.error(message);
    } finally {
      clearTimeout(timer);
      setSaving(false);
    }
  }

  return (
    <form className="card form" onSubmit={(event) => void saveCustomer(event)}>
      <h3 className="card-title-sm">{copy.formTitle}</h3>
      <input className="input" placeholder={copy.name} value={displayName} onChange={(e) => setDisplayName(e.target.value)} required />
      <input className="input" placeholder={copy.phone} value={phone} onChange={(e) => setPhone(e.target.value)} />
      <input className="input" placeholder={copy.email} type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
      <input className="input" placeholder={copy.address} value={address} onChange={(e) => setAddress(e.target.value)} />
      <label>{copy.assignTo}</label>
      <select className="input" value={assignedTo} disabled={teamOptionsLoading} onChange={(e) => setAssignedTo(e.target.value)}>
        <option value="">{copy.unassigned}</option>
        {teamOptions.map((member) => (
          <option key={member.userId} value={member.userId}>{member.label} - {member.role}</option>
        ))}
      </select>
      <textarea className="input" rows={3} placeholder={copy.notes} value={notes} onChange={(e) => setNotes(e.target.value)} />
      <button type="submit" className="btn btn-primary" disabled={saving || !displayName.trim()}>
        {saving ? FEEDBACK.loading : copy.save}
      </button>
    </form>
  );
}
