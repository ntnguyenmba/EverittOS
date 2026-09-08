'use client';

import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAppFeedback } from '@/components/feedback/use-app-feedback';
import { useTranslation } from '@/components/locale-provider';
import { FEEDBACK } from '@/lib/feedback-labels';
import { fetchWithTimeout, requestFailureMessage } from '@/lib/fetch-with-timeout';
import { getCustomerCreateCopy } from '@/lib/i18n/customer-create-copy';

type CustomerCreateFormProps = {
  onCreated?: (customerId: string) => void;
  redirectTo?: string;
};

export function CustomerCreateForm({ onCreated, redirectTo = '/customers' }: CustomerCreateFormProps) {
  const router = useRouter();
  const appFeedback = useAppFeedback();
  const { locale } = useTranslation();
  const copy = getCustomerCreateCopy(locale);
  const [displayName, setDisplayName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [address, setAddress] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  async function saveCustomer(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!displayName.trim() || saving) return;

    setSaving(true);
    try {
      const res = await fetchWithTimeout('/api/customers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          displayName: displayName.trim(),
          phone: phone.trim(),
          email: email.trim(),
          address: address.trim(),
          notes: notes.trim(),
          assigned_to: null,
          record_type: 'customer',
          pipeline_stage: 'active'
        })
      });

      if (res.status === 401) {
        window.location.assign('/login?next=/customers/new');
        return;
      }

      const json = (await res.json().catch(() => ({}))) as { customer?: { id: string }; error?: string };
      if (!res.ok || !json.customer?.id) {
        appFeedback.error(json.error || copy.unableToSave);
        return;
      }

      appFeedback.created();
      onCreated?.(json.customer.id);
      window.location.assign(redirectTo);
    } catch (error) {
      appFeedback.error(requestFailureMessage(error, copy.unableToSave));
    } finally {
      setSaving(false);
    }
  }

  function cancelCreate() {
    if (window.history.length > 1) {
      window.history.back();
      return;
    }
    window.location.assign(redirectTo);
  }

  return (
    <form className="card form" onSubmit={(event) => void saveCustomer(event)}>
      <h3 className="card-title-sm">{copy.formTitle}</h3>
      <input
        className="input"
        name="displayName"
        autoComplete="name"
        placeholder={copy.name}
        value={displayName}
        onChange={(e) => setDisplayName(e.target.value)}
        required
      />
      <input
        className="input"
        name="phone"
        autoComplete="tel"
        placeholder={copy.phone}
        value={phone}
        onChange={(e) => setPhone(e.target.value)}
      />
      <input
        className="input"
        name="email"
        autoComplete="email"
        type="email"
        placeholder={copy.email}
        value={email}
        onChange={(e) => setEmail(e.target.value)}
      />
      <input
        className="input"
        name="address"
        autoComplete="street-address"
        placeholder={copy.address}
        value={address}
        onChange={(e) => setAddress(e.target.value)}
      />
      <textarea
        className="input"
        name="notes"
        rows={3}
        placeholder={copy.notes}
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
      />
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <button type="submit" className="btn btn-primary" disabled={saving || !displayName.trim()}>
          {saving ? FEEDBACK.loading : copy.save}
        </button>
        <button type="button" className="btn" onClick={cancelCreate} disabled={saving}>
          {copy.cancel}
        </button>
      </div>
    </form>
  );
}
