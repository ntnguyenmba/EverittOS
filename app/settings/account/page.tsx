'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { SettingsShell } from '@/components/settings/settings-shell';
import { normalizePlan, planDisplayName, type EverittosPlan } from '@/lib/everittos-plans';
import { normalizeAccountStatus } from '@/lib/account-status';
import { supabase } from '@/lib/supabase';

export default function AccountSettingsPage() {
  const router = useRouter();
  const [plan, setPlan] = useState<EverittosPlan>('free');
  const [email, setEmail] = useState('');
  const [accountStatus, setAccountStatus] = useState('active');
  const [subscriptionStatus, setSubscriptionStatus] = useState('free');
  const [confirmDisable, setConfirmDisable] = useState(false);
  const [message, setMessage] = useState('');
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
        .select('plan, subscription_status, account_status')
        .eq('id', user.id)
        .maybeSingle();

      setPlan(normalizePlan(profile?.plan));
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
    setMessage('');

    const res = await fetch('/api/account/disable', { method: 'POST' });
    const json = await res.json();
    setBusy(false);

    if (!res.ok) {
      setMessage(json.error || 'Unable to disable account.');
      return;
    }

    router.push('/login?error=' + encodeURIComponent('Account disabled. Contact support to restore access.'));
    router.refresh();
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

  return (
    <SettingsShell plan={plan} title="Account" description="Email, plan, and account status.">
      <div className="settings-card">
        <h3>Profile</h3>
        <div className="settings-row">
          <span className="settings-row-label">Email</span>
          <span className="settings-row-value">{email}</span>
        </div>
        <div className="settings-row">
          <span className="settings-row-label">Current plan</span>
          <span className="settings-row-value">{planDisplayName(plan)}</span>
        </div>
        <div className="settings-row">
          <span className="settings-row-label">Subscription status</span>
          <span className="settings-row-value">{subscriptionStatus}</span>
        </div>
        <div className="settings-row">
          <span className="settings-row-label">Account status</span>
          <span className="settings-row-value">{accountStatus === 'active' ? 'Active' : 'Disabled'}</span>
        </div>
        <div className="settings-actions">
          <Link href="/settings/billing" className="btn">
            Manage billing
          </Link>
          <Link href="/settings" className="btn">
            Company settings
          </Link>
        </div>
      </div>

      <div className="settings-card">
        <h3>Disable account</h3>
        <p className="muted">
          Disabling your account blocks sign in and protected pages. Your data stays in place until you contact support
          to restore access.
        </p>
        <div className="settings-warning">
          This does not delete jobs, customers, or billing history. It marks the account inactive so your team cannot
          access the workspace.
        </div>
        <label className="muted">
          <input type="checkbox" checked={confirmDisable} onChange={(e) => setConfirmDisable(e.target.checked)} /> I
          understand and want to disable this account
        </label>
        <div className="settings-actions">
          <button type="button" className="btn" disabled={!confirmDisable || busy} onClick={disableAccount}>
            {busy ? 'Disabling...' : 'Disable account'}
          </button>
        </div>
        {message ? <p>{message}</p> : null}
      </div>
    </SettingsShell>
  );
}
