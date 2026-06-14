'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AppShell } from '@/components/app-shell';
import { SettingsShell } from '@/components/settings/settings-shell';
import { useTranslation } from '@/components/locale-provider';
import { subscriptionStatusMessage } from '@/lib/stripe-subscription';
import { planDisplayName } from '@/lib/everittos-plans';
import { canManageBilling, isOwner, normalizeRole } from '@/lib/roles';
import { roleDisplayName } from '@/lib/role-routes';
import { normalizeAccountStatus } from '@/lib/account-status';
import { SUPPORT_EMAIL } from '@/lib/support';
import { LanguageSwitcher } from '@/components/language-switcher';
import { AuthMessages } from '@/components/auth/auth-messages';
import { useWorkspacePlan } from '@/hooks/use-workspace-plan';
import { supabase } from '@/lib/supabase';

export default function AccountSettingsPage() {
  const router = useRouter();
  const { t } = useTranslation();
  const disableDialogRef = useRef<HTMLDialogElement>(null);
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
  const [email, setEmail] = useState('');
  const [accountStatus, setAccountStatus] = useState('active');
  const [message, setMessage] = useState<{ title?: string; body: string; details?: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    async function load() {
      const {
        data: { user }
      } = await supabase.auth.getUser();
      if (!user) {
        router.push('/login?next=/settings/account');
        return;
      }

      const { data: profile } = await supabase
        .from('profiles')
        .select('account_status')
        .eq('id', user.id)
        .maybeSingle();

      setAccountStatus(normalizeAccountStatus(profile?.account_status));
      setEmail(user.email || '');
      setLoading(false);
    }

    load();
  }, [router]);

  function openDisableModal() {
    disableDialogRef.current?.showModal();
  }

  function closeDisableModal() {
    disableDialogRef.current?.close();
  }

  async function disableAccount() {
    if (busy) return;
    setBusy(true);
    setMessage(null);
    closeDisableModal();

    const res = await fetch('/api/account/disable', { method: 'POST' });
    const json = await res.json();
    setBusy(false);

    if (!res.ok) {
      setMessage({ title: t('settings.account.disableFailed'), body: json.error || t('settings.account.disableFailed'), details: json.code });
      return;
    }

    window.location.href = '/login?reason=disabled&detail=' + encodeURIComponent(t('settings.account.disabledDetail'));
  }

  if (loading || planLoading || !plan) {
    return (
      <AppShell role={role}>
        <p>{t('common.loading')}</p>
      </AppShell>
    );
  }

  const canBilling = canManageBilling(role);

  return (
    <SettingsShell plan={plan} role={role} title={t('settingsNav.account')} description={t('settings.account.description')}>
      <div className="settings-card">
        <h3>{t('settings.account.languageTitle')}</h3>
        <p className="muted">{t('settings.account.languageNote')}</p>
        <LanguageSwitcher />
      </div>

      <div className="settings-card">
        <h3>{t('settings.account.profile')}</h3>
        <div className="settings-row">
          <span className="settings-row-label">{t('settings.account.email')}</span>
          <span className="settings-row-value">{email}</span>
        </div>
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

      {canBilling ? (
        <div className="settings-card">
          <h3>{t('settings.account.subscription')}</h3>
          <p className="muted">{t('settings.account.subscriptionNote')}</p>
          <div className="settings-actions">
            <Link href="/settings/billing" className="btn btn-primary">
              {t('settings.account.openBilling')}
            </Link>
          </div>
        </div>
      ) : (
        <div className="settings-card">
          <h3>{t('settings.account.subscription')}</h3>
          <p className="muted">{t('settings.account.subscriptionOwnerOnly')}</p>
        </div>
      )}

      <div className="settings-card">
        <h3>{t('settings.account.disableTitle')}</h3>
        <p className="muted">{t('settings.account.disableNote')}</p>
        {isOwner(role) ? (
          <div className="settings-warning">
            {t('settings.account.ownerDisableWarning')}{' '}
            <Link href="/team">{t('nav.team')}</Link>
          </div>
        ) : null}
        <div className="settings-warning">
          {t('settings.account.restoreContact')}{' '}
          <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>
        </div>
        <div className="settings-actions">
          <button type="button" className="btn" disabled={busy} onClick={openDisableModal}>
            {busy ? t('settings.account.disabling') : t('settings.account.disableTitle')}
          </button>
        </div>
      </div>

      <dialog ref={disableDialogRef} className="confirm-dialog" aria-labelledby="disable-account-title">
        <form method="dialog" className="confirm-dialog-body">
          <h3 id="disable-account-title">{t('settings.account.disableConfirmTitle')}</h3>
          <p className="muted">{t('settings.account.disableConfirmBody')}</p>
          <div className="confirm-dialog-actions">
            <button type="button" className="btn" onClick={closeDisableModal}>
              {t('common.cancel')}
            </button>
            <button type="button" className="btn" disabled={busy} onClick={() => void disableAccount()}>
              {t('settings.account.disableTitle')}
            </button>
          </div>
        </form>
      </dialog>

      {message ? (
        message.title ? (
          <AuthMessages error={message.body} errorTitle={message.title} errorDetails={message.details} />
        ) : (
          <p className="auth-message auth-message-success">{message.body}</p>
        )
      ) : null}
    </SettingsShell>
  );
}
