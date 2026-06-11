'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { SettingsShell } from '@/components/settings/settings-shell';
import { LocaleSwitcher } from '@/components/locale-switcher';
import {
  canCancelSubscription,
  canResumeSubscription,
  subscriptionStatusMessage
} from '@/lib/stripe-subscription';
import { useTranslatedPlanName, useTranslatedRoleName } from '@/lib/i18n-client';
import { normalizePlan, type EverittosPlan } from '@/lib/everittos-plans';
import { canManageBilling, isOwner, normalizeRole } from '@/lib/roles';
import { normalizeAccountStatus } from '@/lib/account-status';
import { SUPPORT_EMAIL } from '@/lib/support';
import { AuthMessages } from '@/components/auth/auth-messages';
import { supabase } from '@/lib/supabase';

const DEACTIVATE_CONFIRMATION = 'deactivate my account';
const DELETE_CONFIRMATION = 'DELETE MY ACCOUNT';

export default function AccountSettingsPage() {
  const router = useRouter();
  const t = useTranslations('settings');
  const commonT = useTranslations('common');
  const planName = useTranslatedPlanName();
  const roleName = useTranslatedRoleName();
  const [plan, setPlan] = useState<EverittosPlan>('free');
  const [role, setRole] = useState(normalizeRole('owner'));
  const [email, setEmail] = useState('');
  const [accountStatus, setAccountStatus] = useState('active');
  const [subscriptionStatus, setSubscriptionStatus] = useState('free');
  const [confirmDisableText, setConfirmDisableText] = useState('');
  const [confirmDeleteText, setConfirmDeleteText] = useState('');
  const [message, setMessage] = useState<{ title?: string; body: string; details?: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [cancelLoading, setCancelLoading] = useState(false);
  const [resumeLoading, setResumeLoading] = useState(false);

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
        .select('plan, subscription_status, account_status, role')
        .eq('id', user.id)
        .maybeSingle();

      setPlan(normalizePlan(profile?.plan));
      setRole(normalizeRole(profile?.role));
      setSubscriptionStatus(profile?.subscription_status || 'free');
      setAccountStatus(normalizeAccountStatus(profile?.account_status));
      setEmail(user.email || '');
      setLoading(false);
    }

    load();
  }, [router]);

  async function disableAccount() {
    if (confirmDisableText.trim().toLowerCase() !== DEACTIVATE_CONFIRMATION || busy) return;
    setBusy(true);
    setMessage(null);

    const res = await fetch('/api/account/disable', { method: 'POST' });
    const json = await res.json();
    setBusy(false);

    if (!res.ok) {
      setMessage({ title: 'Unable to deactivate', body: json.error || 'Unable to disable account.', details: json.code });
      return;
    }

    window.location.href = '/login?reason=disabled&detail=' + encodeURIComponent('Account deactivated at your request.');
  }

  async function requestDeletion() {
    if (confirmDeleteText.trim() !== DELETE_CONFIRMATION || deleteBusy) return;
    setDeleteBusy(true);
    setMessage(null);

    const res = await fetch('/api/account/request-deletion', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ confirmation: confirmDeleteText.trim() })
    });
    const json = await res.json();
    setDeleteBusy(false);

    if (!res.ok) {
      setMessage({
        title: 'Deletion request failed',
        body: json.error || 'Unable to submit deletion request.',
        details: json.code
      });
      return;
    }

    setMessage({ body: json.message || 'Deletion request submitted.' });
    setConfirmDeleteText('');
  }

  async function cancelSubscription() {
    setCancelLoading(true);
    setMessage(null);
    const res = await fetch('/api/stripe/cancel-subscription', { method: 'POST' });
    const json = await res.json();
    setCancelLoading(false);

    if (!res.ok) {
      setMessage({ title: 'Cancellation failed', body: json.error || 'Unable to cancel subscription.', details: json.code });
      return;
    }

    setSubscriptionStatus('canceled');
    setMessage({ body: json.message || 'Subscription set to cancel at period end.' });
  }

  async function resumeSubscription() {
    setResumeLoading(true);
    setMessage(null);
    const res = await fetch('/api/stripe/resume-subscription', { method: 'POST' });
    const json = await res.json();
    setResumeLoading(false);

    if (!res.ok) {
      setMessage({ title: 'Resume failed', body: json.error || 'Unable to resume subscription.', details: json.code });
      return;
    }

    setSubscriptionStatus(json.status || 'active');
    setMessage({ body: json.message || 'Subscription resumed.' });
  }

  if (loading) {
    return (
      <div className="dashboard-shell">
        <main className="main">
          <p>{t('loading')}</p>
        </main>
      </div>
    );
  }

  const canBilling = canManageBilling(role);
  const deactivateReady = confirmDisableText.trim().toLowerCase() === DEACTIVATE_CONFIRMATION;
  const deleteReady = confirmDeleteText.trim() === DELETE_CONFIRMATION;

  return (
    <SettingsShell plan={plan} role={role} title={t('accountTitle')} description={t('accountSubtitle')}>
      <div className="settings-card">
        <h3>{t('languageSection')}</h3>
        <p className="muted">{t('languageSectionBody')}</p>
        <LocaleSwitcher />
      </div>

      <div className="settings-card">
        <h3>{t('accountTitle')}</h3>
        <div className="settings-row">
          <span className="settings-row-label">{t('emailLabel')}</span>
          <span className="settings-row-value">{email}</span>
        </div>
        <div className="settings-row">
          <span className="settings-row-label">{t('roleLabel')}</span>
          <span className="settings-row-value">{roleName(role)}</span>
        </div>
        <div className="settings-row">
          <span className="settings-row-label">{t('planLabel')}</span>
          <span className="settings-row-value">{planName(plan)}</span>
        </div>
        <div className="settings-row">
          <span className="settings-row-label">{t('subscriptionLabel')}</span>
          <span className="settings-row-value">{subscriptionStatus}</span>
        </div>
        <p className="muted">{subscriptionStatusMessage(subscriptionStatus)}</p>
        <div className="settings-row">
          <span className="settings-row-label">{t('accountStatusLabel')}</span>
          <span className="settings-row-value">{accountStatus === 'active' ? commonT('yes') : commonT('no')}</span>
        </div>
        <div className="settings-actions">
          {canBilling ? (
            <Link href="/settings/billing" className="btn">
              Manage billing
            </Link>
          ) : null}
          <Link href="/settings/security" className="btn">
            Security
          </Link>
          {canBilling ? (
            <Link href="/settings" className="btn">
              Workspace settings
            </Link>
          ) : null}
        </div>
      </div>

      {canBilling ? (
        <div className="settings-card">
          <h3>Subscription</h3>
          <p className="muted">
            Cancel or resume your Stripe subscription. Billing history stays available in the customer portal. Paid access
            may continue until the current billing period ends after cancellation.
          </p>
          <div className="settings-actions">
            {canCancelSubscription(subscriptionStatus) ? (
              <button type="button" className="btn" disabled={cancelLoading} onClick={cancelSubscription}>
                {cancelLoading ? 'Working...' : 'Cancel subscription'}
              </button>
            ) : null}
            {canResumeSubscription(subscriptionStatus) ? (
              <button type="button" className="btn btn-primary" disabled={resumeLoading} onClick={resumeSubscription}>
                {resumeLoading ? 'Working...' : 'Resume subscription'}
              </button>
            ) : null}
            <Link href="/settings/billing" className="btn">
              Open billing portal
            </Link>
          </div>
        </div>
      ) : (
        <div className="settings-card">
          <h3>Subscription</h3>
          <p className="muted">
            Only workspace owners and admins can cancel or resume billing. Contact your owner or admin for plan changes.
          </p>
        </div>
      )}

      <div className="settings-card">
        <h3>Deactivate account</h3>
        <p className="muted">
          Deactivation signs you out and blocks your sign-in. Your organization data (jobs, customers, billing records)
          stays stored for your team unless you also request permanent deletion.
        </p>
        {isOwner(role) ? (
          <div className="settings-warning">
            You are the workspace owner. Deactivating only blocks your account. It does not delete the organization.
            Transfer ownership on the <Link href="/team">Team</Link> page before deactivating if someone else should
            manage billing and settings.
          </div>
        ) : null}
        <div className="settings-warning">
          This is not instant permanent deletion. Contact <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a> to
          restore access or complete a deletion request.
        </div>
        <label className="auth-field">
          <span className="muted">Type &quot;{DEACTIVATE_CONFIRMATION}&quot; to confirm</span>
          <input
            className="input"
            type="text"
            value={confirmDisableText}
            onChange={(e) => setConfirmDisableText(e.target.value)}
            autoComplete="off"
          />
        </label>
        <div className="settings-actions">
          <button type="button" className="btn" disabled={!deactivateReady || busy} onClick={disableAccount}>
            {busy ? 'Deactivating...' : 'Deactivate account'}
          </button>
        </div>
      </div>

      <div className="settings-card">
        <h3>Request account deletion</h3>
        <p className="muted">
          Permanent deletion is handled by our team after review. We will confirm by email before removing personal data.
          Organization records may be retained where required for billing, legal, or backup obligations.
        </p>
        <label className="auth-field">
          <span className="muted">Type &quot;{DELETE_CONFIRMATION}&quot; to submit a deletion request</span>
          <input
            className="input"
            type="text"
            value={confirmDeleteText}
            onChange={(e) => setConfirmDeleteText(e.target.value)}
            autoComplete="off"
          />
        </label>
        <div className="settings-actions">
          <button type="button" className="btn" disabled={!deleteReady || deleteBusy} onClick={requestDeletion}>
            {deleteBusy ? 'Submitting...' : 'Request account deletion'}
          </button>
        </div>
        <p className="muted">
          Support: <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>
        </p>
      </div>

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
