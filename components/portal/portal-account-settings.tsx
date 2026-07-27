'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AccountDeleteSection } from '@/components/settings/account-delete-section';
import { LanguageSwitcher } from '@/components/language-switcher';
import { useAsyncAction } from '@/hooks/use-async-action';
import { FEEDBACK } from '@/lib/feedback-labels';
import { isClientRole, isContractorRole, normalizeRole, type UserRole } from '@/lib/roles';
import { supabase } from '@/lib/supabase';

const DEFAULT_NOTIFICATIONS = {
  marketingEmails: false,
  productUpdates: false,
  operationalNotifications: true,
  emailNotifications: true,
  pushNotifications: false,
  smsNotifications: false
};

type PortalAccountSettingsProps = {
  variant: 'contractor' | 'client';
  homeHref: string;
  legalLinks: Array<{ href: string; label: string }>;
};

export function PortalAccountSettings({ variant, homeHref, legalLinks }: PortalAccountSettingsProps) {
  const router = useRouter();
  const { busy: saving, runResponse, buttonLabel } = useAsyncAction({
    successMessage: 'Account settings saved.'
  });
  const [saveMessage, setSaveMessage] = useState('');
  const [role, setRole] = useState<UserRole>(variant === 'client' ? 'client' : 'contractor');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [notifications, setNotifications] = useState(DEFAULT_NOTIFICATIONS);
  const [loading, setLoading] = useState(true);
  const [hasActiveSubscription, setHasActiveSubscription] = useState(false);

  useEffect(() => {
    async function load() {
      const {
        data: { user }
      } = await supabase.auth.getUser();
      if (!user) {
        router.push(`/login?next=${encodeURIComponent(homeHref)}`);
        return;
      }

      const { data: profile } = await supabase
        .from('profiles')
        .select('role, plan, subscription_status, email, full_name, display_name, phone')
        .eq('id', user.id)
        .maybeSingle();

      const normalizedRole = normalizeRole(profile?.role);
      setRole(normalizedRole);

      if (variant === 'contractor' && !isContractorRole(normalizedRole)) {
        router.replace(homeHref);
        return;
      }
      if (variant === 'client' && !isClientRole(normalizedRole)) {
        router.replace(homeHref);
        return;
      }

      const res = await fetch('/api/account/profile', { cache: 'no-store' });
      const json = await res.json().catch(() => ({}));
      if (res.ok) {
        setFirstName(json.firstName || '');
        setLastName(json.lastName || '');
        setDisplayName(json.displayName || profile?.display_name || profile?.full_name || '');
        setEmail(json.email || profile?.email || user.email || '');
        setPhone(json.phone || profile?.phone || '');
        setNotifications({ ...DEFAULT_NOTIFICATIONS, ...(json.notifications || {}) });
      } else {
        setEmail(profile?.email || user.email || '');
        setDisplayName(profile?.display_name || profile?.full_name || '');
        setPhone(profile?.phone || '');
      }

      const status = String(profile?.subscription_status || '').toLowerCase();
      setHasActiveSubscription(
        Boolean(profile?.plan && profile.plan !== 'free' && ['active', 'trialing', 'past_due', 'unpaid'].includes(status))
      );
      setLoading(false);
    }

    void load();
  }, [homeHref, router, variant]);

  async function saveProfile() {
    const ok = await runResponse(() =>
      fetch('/api/account/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          firstName,
          lastName,
          displayName,
          phone,
          newEmail: newEmail.trim() || undefined,
          newPassword: newPassword.trim() || undefined,
          notifications
        })
      })
    );
    if (ok) setSaveMessage('Account settings saved.');
    setNewPassword('');
    setNewEmail('');
  }

  if (loading) {
    return <div className="card">Loading account settings…</div>;
  }

  return (
    <div className="portal-account-settings">
      <div className="settings-card form settings-form-grid">
        <h3>Profile</h3>
        <p className="muted">Update the contact details used for job and account notifications.</p>
        <label className="settings-field">
          <span>First name</span>
          <input className="input" value={firstName} onChange={(event) => setFirstName(event.target.value)} />
        </label>
        <label className="settings-field">
          <span>Last name</span>
          <input className="input" value={lastName} onChange={(event) => setLastName(event.target.value)} />
        </label>
        <label className="settings-field">
          <span>Display name</span>
          <input className="input" value={displayName} onChange={(event) => setDisplayName(event.target.value)} />
        </label>
        <label className="settings-field">
          <span>Phone</span>
          <input className="input" value={phone} onChange={(event) => setPhone(event.target.value)} />
        </label>
        <label className="settings-field">
          <span>Email</span>
          <input className="input" value={email} disabled />
        </label>
        <label className="settings-field">
          <span>New email</span>
          <input
            className="input"
            type="email"
            value={newEmail}
            onChange={(event) => setNewEmail(event.target.value)}
            placeholder="Leave blank to keep current email"
          />
        </label>
        <label className="settings-field">
          <span>New password</span>
          <input
            className="input"
            type="password"
            value={newPassword}
            onChange={(event) => setNewPassword(event.target.value)}
            placeholder="Leave blank to keep current password"
          />
        </label>
        <div className="settings-actions">
          <button type="button" className="btn btn-primary" disabled={saving} onClick={() => void saveProfile()}>
            {buttonLabel('Save account', FEEDBACK.loading)}
          </button>
        </div>
        {saveMessage ? <p className="auth-message auth-message-success">{saveMessage}</p> : null}
      </div>

      <div className="settings-card form settings-form-grid">
        <h3>Notifications</h3>
        <p className="muted">
          {variant === 'contractor'
            ? 'Choose which contractor updates you want by email.'
            : 'Choose which appointment and invoice updates you want by email.'}
        </p>
        <label>
          <input
            type="checkbox"
            checked={notifications.emailNotifications}
            onChange={(event) => setNotifications((current) => ({ ...current, emailNotifications: event.target.checked }))}
          />{' '}
          Email notifications
        </label>
        <label>
          <input
            type="checkbox"
            checked={notifications.operationalNotifications}
            onChange={(event) =>
              setNotifications((current) => ({ ...current, operationalNotifications: event.target.checked }))
            }
          />{' '}
          {variant === 'contractor' ? 'Job and payment updates' : 'Appointment and invoice updates'}
        </label>
        <label>
          <input
            type="checkbox"
            checked={notifications.productUpdates}
            onChange={(event) => setNotifications((current) => ({ ...current, productUpdates: event.target.checked }))}
          />{' '}
          Product updates
        </label>
      </div>

      <div className="settings-card">
        <h3>Language</h3>
        <LanguageSwitcher />
      </div>

      <div className="settings-card">
        <h3>Legal</h3>
        <p className="muted">Review the policies that apply to your portal access.</p>
        <div className="button-row" style={{ flexWrap: 'wrap', gap: 8 }}>
          {legalLinks.map((link) => (
            <Link key={link.href} href={link.href} className="btn">
              {link.label}
            </Link>
          ))}
        </div>
      </div>

      <div className="settings-card">
        <h3>Calendar</h3>
        <p className="muted">
          {variant === 'contractor'
            ? 'Use Add to Calendar on an assigned job for a one-time calendar event. Organization-wide Google Calendar and QuickBooks connections are managed by the workspace owner.'
            : 'Use Add to Calendar on your appointments for Google, Outlook, or Apple Calendar. This portal does not include organization integrations.'}
        </p>
      </div>

      <AccountDeleteSection
        hasActiveSubscription={hasActiveSubscription}
        role={role}
        retentionNote={
          variant === 'contractor'
            ? 'Deleting your login removes your access and personal profile details. Organization job history, customer records, and payment records stay with the hiring organization.'
            : 'Deleting your login removes your portal access and personal profile details. Invoices, payments, completed jobs, and other service records stay with your service provider when required.'
        }
      />
    </div>
  );
}
