'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { SettingsShell } from '@/components/settings/settings-shell';
import {
  canCancelSubscription,
  canResumeSubscription,
  subscriptionStatusMessage
} from '@/lib/stripe-subscription';
import { normalizePlan, planDisplayName, type EverittosPlan } from '@/lib/everittos-plans';
import { canManageBilling, normalizeRole } from '@/lib/roles';
import { roleDisplayName } from '@/lib/role-routes';
import { normalizeAccountStatus } from '@/lib/account-status';
import { AuthMessages } from '@/components/auth/auth-messages';
import { supabase } from '@/lib/supabase';

export default function AccountSettingsPage() {
  const router = useRouter();
  const [plan, setPlan] = useState<EverittosPlan>('free');
  const [role, setRole] = useState(normalizeRole('owner'));
  const [email, setEmail] = useState('');
  const [accountStatus, setAccountStatus] = useState('active');
  const [subscriptionStatus, setSubscriptionStatus] = useState('free');
  const [confirmDisable, setConfirmDisable] = useState(false);
  const [message, setMessage] = useState<{ title?: string; body: string; details?: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
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
    if (!confirmDisable || busy) return;
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
          <p>Loading account...</p>
        </main>
      </div>
    );
  }

  const canBilling = canManageBilling(role);

  return (
    <SettingsShell plan={plan} title="Account" description="Email, role, subscription, and account status.">
      <div className="settings-card">
        <h3>Profile</h3>
        <div className="settings-row">
          <span className="settings-row-label">Email</span>
          <span className="settings-row-value">{email}</span>
        </div>
        <div className="settings-row">
          <span className="settings-row-label">Role</span>
          <span className="settings-row-value">{roleDisplayName(role)}</span>
        </div>
        <div className="settings-row">
          <span className="settings-row-label">Current plan</span>
          <span className="settings-row-value">{planDisplayName(plan)}</span>
        </div>
        <div className="settings-row">
          <span className="settings-row-label">Subscription status</span>
          <span className="settings-row-value">{subscriptionStatus}</span>
        </div>
        <p className="muted">{subscriptionStatusMessage(subscriptionStatus)}</p>
        <div className="settings-row">
          <span className="settings-row-label">Account status</span>
          <span className="settings-row-value">{accountStatus === 'active' ? 'Active' : 'Disabled'}</span>
        </div>
        <div className="settings-actions">
          <Link href="/settings/billing" className="btn">
            Manage billing
          </Link>
          <Link href="/settings/security" className="btn">
            Security
          </Link>
          <Link href="/settings" className="btn">
            Company settings
          </Link>
        </div>
      </div>

      {canBilling ? (
        <div className="settings-card">
          <h3>Subscription</h3>
          <p className="muted">
            Cancel or resume your Stripe subscription. Billing history stays available in the customer portal.
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
          </div>
        </div>
      ) : (
        <div className="settings-card">
          <h3>Subscription</h3>
          <p className="muted">Only the workspace owner can cancel or resume billing. Contact your owner for changes.</p>
        </div>
      )}

      <div className="settings-card">
        <h3>Deactivate account</h3>
        <p className="muted">
          Deactivation blocks sign-in for you and your team. Jobs, customers, invoices, and billing history remain stored
          until you contact support to restore access or request permanent deletion.
        </p>
        <div className="settings-warning">
          This is not instant permanent deletion. Everitt Ventures can restore deactivated accounts on request. For
          permanent deletion, email support after deactivating.
        </div>
        <label className="muted">
          <input type="checkbox" checked={confirmDisable} onChange={(e) => setConfirmDisable(e.target.checked)} /> I
          understand this deactivates my account and blocks team access
        </label>
        <div className="settings-actions">
          <button type="button" className="btn" disabled={!confirmDisable || busy} onClick={disableAccount}>
            {busy ? 'Deactivating...' : 'Deactivate account'}
          </button>
        </div>
        {message ? (
          message.title ? (
            <AuthMessages error={message.body} errorTitle={message.title} errorDetails={message.details} />
          ) : (
            <p className="auth-message auth-message-success">{message.body}</p>
          )
        ) : null}
      </div>
    </SettingsShell>
  );
}
