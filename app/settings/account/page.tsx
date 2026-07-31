'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { SettingsShell } from '@/components/settings/settings-shell';
import { AccountDeleteSection } from '@/components/settings/account-delete-section';
import { LanguageSwitcher } from '@/components/language-switcher';
import { useTranslation } from '@/components/locale-provider';
import { normalizeStripeStatus, subscriptionStatusMessage } from '@/lib/stripe-subscription';
import { normalizePlan, planDisplayName } from '@/lib/everittos-plans';
import { canManageBilling, isClientRole, isContractorRole, normalizeRole } from '@/lib/roles';
import { roleDisplayName } from '@/lib/role-routes';
import { normalizeAccountStatus } from '@/lib/account-status';
import { useAsyncAction } from '@/hooks/use-async-action';
import { FEEDBACK } from '@/lib/feedback-labels';
import { useWorkspacePlan } from '@/hooks/use-workspace-plan';
import { supabase } from '@/lib/supabase';

const DEFAULT_NOTIFICATIONS = {
  marketingEmails: false,
  productUpdates: true,
  operationalNotifications: true,
  emailNotifications: true,
  pushNotifications: false,
  smsNotifications: false
};

export default function AccountSettingsPage() {
  const router = useRouter();
  const { t } = useTranslation();
  const { busy: saving, runResponse, buttonLabel } = useAsyncAction({
    successMessage: 'Account settings saved.'
  });
  const [saveMessage, setSaveMessage] = useState('');
  const {
    profilePlan,
    billingPlan,
    organizationPlan,
    plan: workspacePlan,
    role: workspaceRole,
    subscriptionStatus: workspaceSubscriptionStatus,
    loading: planLoading
  } = useWorkspacePlan();
  const plan = billingPlan ?? profilePlan ?? workspacePlan ?? organizationPlan;
  const role = workspaceRole ?? normalizeRole('owner');
  const subscriptionStatus = workspaceSubscriptionStatus || 'free';

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [accountStatus, setAccountStatus] = useState('active');
  const [notifications, setNotifications] = useState(DEFAULT_NOTIFICATIONS);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const {
        data: { user }
      } = await supabase.auth.getUser();
      if (!user) {
        router.push('/login?next=/settings/account');
        return;
      }

      const res = await fetch('/api/account/profile', { cache: 'no-store' });
      const json = await res.json().catch(() => ({}));
      if (res.ok) {
        setFirstName(json.firstName || '');
        setLastName(json.lastName || '');
        setDisplayName(json.displayName || '');
        setEmail(json.email || user.email || '');
        setPhone(json.phone || '');
        setNotifications(json.notifications || DEFAULT_NOTIFICATIONS);
      } else {
        setEmail(user.email || '');
      }

      const { data: profile } = await supabase
        .from('profiles')
        .select('account_status')
        .eq('id', user.id)
        .maybeSingle();
      setAccountStatus(normalizeAccountStatus(profile?.account_status));
      setLoading(false);
    }

    void load();
  }, [router]);

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

  if (loading || planLoading || !plan) {
    return (
      <SettingsShell plan={plan || 'free'} role={role} title={t('settingsNav.account')}>
        <p>{t('common.loading')}</p>
      </SettingsShell>
    );
  }

  const canBilling = canManageBilling(role);
  const activeSubscriptionStatuses = new Set(['active', 'trialing', 'past_due', 'unpaid', 'paused', 'incomplete']);
  const hasActiveSubscription =
    normalizePlan(plan) !== 'free' && activeSubscriptionStatuses.has(normalizeStripeStatus(subscriptionStatus));
  const isPortalMember = isClientRole(role) || isContractorRole(role);

  return (
    <SettingsShell plan={plan} role={role} title={t('settingsNav.account')} description={t('settings.account.description')}>
      <div className="settings-card form settings-form-grid">
        <h3>Profile</h3>
        <p className="muted">Update how your name and contact details appear across EverittOS.</p>
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
        <h3>Notification preferences</h3>
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
          Operational updates
        </label>
        <label>
          <input
            type="checkbox"
            checked={notifications.productUpdates}
            onChange={(event) => setNotifications((current) => ({ ...current, productUpdates: event.target.checked }))}
          />{' '}
          Product updates
        </label>
        <label>
          <input
            type="checkbox"
            checked={notifications.marketingEmails}
            onChange={(event) => setNotifications((current) => ({ ...current, marketingEmails: event.target.checked }))}
          />{' '}
          Marketing emails
        </label>
      </div>

      <div className="settings-card">
        <h3>{t('settings.account.languageTitle')}</h3>
        <p className="muted">{t('settings.account.languageNote')}</p>
        <LanguageSwitcher />
      </div>

      <div className="settings-card">
        <h3>{t('settings.account.profile')}</h3>
        <div className="settings-row">
          <span className="settings-row-label">{t('settings.account.role')}</span>
          <span className="settings-row-value">{roleDisplayName(role)}</span>
        </div>
        <div className="settings-row">
          <span className="settings-row-label">{t('billing.currentPlan')}</span>
          <span className="settings-row-value">{planDisplayName(plan)}</span>
        </div>
        <div className="settings-row">
          <span className="settings-row-label">{t('billing.status')}</span>
          <span className="settings-row-value">{subscriptionStatus}</span>
        </div>
        <p className="muted">{subscriptionStatusMessage(subscriptionStatus)}</p>
        <div className="settings-row">
          <span className="settings-row-label">{t('settings.account.accountStatus')}</span>
          <span className="settings-row-value">
            {accountStatus === 'active' ? t('settings.account.active') : t('settings.account.disabled')}
          </span>
        </div>
        <div className="settings-actions">
          {canBilling ? (
            <Link href="/settings/billing" className="btn">
              {t('settings.account.manageBilling')}
            </Link>
          ) : null}
          <Link href="/settings/security" className="btn">
            {t('settingsNav.security')}
          </Link>
          {canBilling ? (
            <Link href="/settings" className="btn">
              {t('settings.account.workspaceSettings')}
            </Link>
          ) : null}
        </div>
      </div>

      <div className="settings-card">
        <h3>Legal</h3>
        <div className="button-row" style={{ flexWrap: 'wrap', gap: 8 }}>
          <Link href="/privacy" className="btn">
            Privacy Policy
          </Link>
          <Link href="/terms" className="btn">
            Terms of Service
          </Link>
          <Link href="/disclaimer" className="btn">
            General Disclaimer
          </Link>
          {isContractorRole(role) ? (
            <Link href="/disclaimer/contractor" className="btn">
              Contractor Disclaimer
            </Link>
          ) : null}
          {isClientRole(role) ? (
            <Link href="/disclaimer/customer" className="btn">
              Customer Portal Disclaimer
            </Link>
          ) : null}
        </div>
      </div>

      <AccountDeleteSection
        hasActiveSubscription={hasActiveSubscription}
        role={role}
        retentionNote={
          isPortalMember
            ? 'Deleting your login removes dashboard access and personal profile details. Company-owned job, invoice, payment, and audit records remain with the service provider when required.'
            : undefined
        }
      />
    </SettingsShell>
  );
}
