'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslation } from '@/components/locale-provider';
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
};

export function PortalAccountSettings({ variant, homeHref }: PortalAccountSettingsProps) {
  const { t } = useTranslation();
  const router = useRouter();
  const { busy: saving, runResponse, buttonLabel } = useAsyncAction({
    successMessage: t('portal.account.profile.saveAccount')
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
    if (ok) setSaveMessage(t('portal.common.saved'));
    setNewPassword('');
    setNewEmail('');
  }

  if (loading) {
    return <div className="card">{t('portal.account.loading')}</div>;
  }

  const legalLinks =
    variant === 'client'
      ? [
          { href: '/privacy', label: t('portal.legal.privacy') },
          { href: '/terms', label: t('portal.legal.terms') },
          { href: '/disclaimer', label: t('portal.legal.generalDisclaimer') },
          { href: '/disclaimer/customer', label: t('portal.legal.customerDisclaimer') }
        ]
      : [
          { href: '/privacy', label: t('portal.legal.privacy') },
          { href: '/terms', label: t('portal.legal.terms') },
          { href: '/disclaimer', label: t('portal.legal.generalDisclaimer') },
          { href: '/disclaimer/contractor', label: t('portal.legal.contractorDisclaimer') }
        ];

  return (
    <div className="portal-account-settings">
      <div className="settings-card form settings-form-grid">
        <h3>{t('portal.account.profile.title')}</h3>
        <p className="muted">{t('portal.account.profile.description')}</p>
        <label className="settings-field">
          <span>{t('portal.account.profile.firstName')}</span>
          <input className="input" value={firstName} onChange={(event) => setFirstName(event.target.value)} />
        </label>
        <label className="settings-field">
          <span>{t('portal.account.profile.lastName')}</span>
          <input className="input" value={lastName} onChange={(event) => setLastName(event.target.value)} />
        </label>
        <label className="settings-field">
          <span>{t('portal.account.profile.displayName')}</span>
          <input className="input" value={displayName} onChange={(event) => setDisplayName(event.target.value)} />
        </label>
        <label className="settings-field">
          <span>{t('portal.account.profile.phone')}</span>
          <input className="input" value={phone} onChange={(event) => setPhone(event.target.value)} />
        </label>
        <label className="settings-field">
          <span>{t('portal.account.profile.email')}</span>
          <input className="input" value={email} disabled />
        </label>
        <label className="settings-field">
          <span>{t('portal.account.profile.newEmail')}</span>
          <input
            className="input"
            type="email"
            value={newEmail}
            onChange={(event) => setNewEmail(event.target.value)}
            placeholder={t('portal.account.profile.keepEmail')}
          />
        </label>
        <label className="settings-field">
          <span>{t('portal.account.profile.newPassword')}</span>
          <input
            className="input"
            type="password"
            value={newPassword}
            onChange={(event) => setNewPassword(event.target.value)}
            placeholder={t('portal.account.profile.keepPassword')}
          />
        </label>
        <div className="settings-actions">
          <button type="button" className="btn btn-primary" disabled={saving} onClick={() => void saveProfile()}>
            {buttonLabel(t('portal.account.profile.saveAccount'), FEEDBACK.loading)}
          </button>
        </div>
        {saveMessage ? <p className="auth-message auth-message-success">{saveMessage}</p> : null}
      </div>

      <div className="settings-card form settings-form-grid">
        <h3>{t('portal.account.notifications.title')}</h3>
        <p className="muted">
          {variant === 'contractor'
            ? t('portal.account.notifications.contractorDescription')
            : t('portal.account.notifications.clientDescription')}
        </p>
        <label>
          <input
            type="checkbox"
            checked={notifications.emailNotifications}
            onChange={(event) => setNotifications((current) => ({ ...current, emailNotifications: event.target.checked }))}
          />{' '}
          {t('portal.account.notifications.emailNotifications')}
        </label>
        <label>
          <input
            type="checkbox"
            checked={notifications.operationalNotifications}
            onChange={(event) =>
              setNotifications((current) => ({ ...current, operationalNotifications: event.target.checked }))
            }
          />{' '}
          {variant === 'contractor'
            ? t('portal.account.notifications.contractorOperational')
            : t('portal.account.notifications.clientOperational')}
        </label>
        <label>
          <input
            type="checkbox"
            checked={notifications.productUpdates}
            onChange={(event) => setNotifications((current) => ({ ...current, productUpdates: event.target.checked }))}
          />{' '}
          {t('portal.account.notifications.productUpdates')}
        </label>
      </div>

      <div className="settings-card">
        <h3>{t('portal.common.language')}</h3>
        <LanguageSwitcher />
      </div>

      <div className="settings-card">
        <h3>{t('portal.legal.title')}</h3>
        <p className="muted">{t('portal.legal.description')}</p>
        <div className="button-row" style={{ flexWrap: 'wrap', gap: 8 }}>
          {legalLinks.map((link) => (
            <Link key={link.href} href={link.href} className="btn">
              {link.label}
            </Link>
          ))}
        </div>
      </div>

      <div className="settings-card">
        <h3>{t('portal.account.calendar.title')}</h3>
        <p className="muted">
          {variant === 'contractor'
            ? t('portal.account.calendar.contractorDescription')
            : t('portal.account.calendar.clientDescription')}
        </p>
      </div>

      <AccountDeleteSection
        hasActiveSubscription={hasActiveSubscription}
        role={role}
        retentionNote={
          variant === 'contractor' ? t('portal.account.delete.contractorRetention') : t('portal.account.delete.clientRetention')
        }
      />
    </div>
  );
}
