'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AppShell } from '@/components/app-shell';
import { SettingsShell } from '@/components/settings/settings-shell';
import { normalizePlan, type EverittosPlan } from '@/lib/everittos-plans';
import { canManageOrganizationSettings, normalizeRole } from '@/lib/roles';
import { fetchOrganizationContext } from '@/lib/organization';
import { fetchRecentSecurityEvents } from '@/lib/security-events';
import { useTranslation } from '@/components/locale-provider';
import { SUPPORT_EMAIL } from '@/lib/support';
import { supabase } from '@/lib/supabase';

type SecurityEventRow = {
  id: string;
  event_type: string;
  severity: string;
  message: string;
  created_at: string;
};

export default function SecuritySettingsPage() {
  const router = useRouter();
  const { t } = useTranslation();
  const [plan, setPlan] = useState<EverittosPlan>('free');
  const [role, setRole] = useState(normalizeRole('owner'));
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [securityEvents, setSecurityEvents] = useState<SecurityEventRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    async function load() {
      const {
        data: { user }
      } = await supabase.auth.getUser();
      if (!user) {
        router.push('/login?next=/settings/security');
        return;
      }

      const { data: profile } = await supabase.from('profiles').select('plan, role').eq('id', user.id).maybeSingle();
      setPlan(normalizePlan(profile?.plan));
      setRole(normalizeRole(profile?.role));

      const org = await fetchOrganizationContext(user.id);
      if (org && canManageOrganizationSettings(normalizeRole(profile?.role))) {
        const events = await fetchRecentSecurityEvents(supabase, org.organizationId, 20);
        setSecurityEvents(events as SecurityEventRow[]);
      }

      setLoading(false);
    }

    load();
  }, [router]);

  async function changePassword(event: React.FormEvent) {
    event.preventDefault();
    setError('');
    setMessage('');

    if (password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setSaving(true);
    const { error: updateError } = await supabase.auth.updateUser({ password });
    setSaving(false);

    if (updateError) {
      setError(updateError.message);
      return;
    }

    setPassword('');
    setConfirmPassword('');
    setMessage('Password updated.');
  }

  async function signOutEverywhere() {
    setSaving(true);
    await supabase.auth.signOut({ scope: 'global' });
    setSaving(false);
    router.push('/login');
    router.refresh();
  }

  if (loading) {
    return (
      <AppShell plan={plan} role={role}>
        <p>Loading security settings...</p>
      </AppShell>
    );
  }

  return (
    <SettingsShell plan={plan} title="Security" description="Password, passkeys, and session controls.">
      <div className="settings-card">
        <h3>{t('settings.security.passkeysTitle')}</h3>
        <p className="muted">{t('settings.security.passkeysBody')}</p>
        <p className="muted">
          {t('settings.security.compromised')}{' '}
          <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>.
        </p>
      </div>

      <div className="settings-card">
        <h3>Change password</h3>
        <form className="form" onSubmit={changePassword}>
          <div className="auth-field">
            <label htmlFor="password">New password</label>
            <input
              id="password"
              className="input"
              type="password"
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
          <div className="auth-field">
            <label htmlFor="confirm_password">Confirm password</label>
            <input
              id="confirm_password"
              className="input"
              type="password"
              autoComplete="new-password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
            />
          </div>
          {error ? <p className="auth-message auth-message-error">{error}</p> : null}
          {message ? <p className="auth-message auth-message-success">{message}</p> : null}
          <button className="btn btn-primary" type="submit" disabled={saving}>
            {saving ? 'Updating...' : 'Update password'}
          </button>
        </form>
      </div>

      <div className="settings-card">
        <h3>Sessions</h3>
        <p className="muted">Sign out on every device tied to this account.</p>
        <div className="settings-actions">
          <button type="button" className="btn" disabled={saving} onClick={signOutEverywhere}>
            Sign out everywhere
          </button>
        </div>
      </div>

      {canManageOrganizationSettings(role) ? (
        <div className="settings-card">
          <h3>Security audit review</h3>
          <p className="muted">Recent sign-in, sign-out, and failed login events for your organization.</p>
          {securityEvents.length === 0 ? <p className="muted">No security events recorded yet.</p> : null}
          {securityEvents.map((event) => (
            <div key={event.id} className="list-row compact">
              <div>
                <strong>{event.event_type}</strong>
                <p className="muted">
                  {event.message} · {new Date(event.created_at).toLocaleString()}
                </p>
              </div>
            </div>
          ))}
        </div>
      ) : null}
    </SettingsShell>
  );
}
