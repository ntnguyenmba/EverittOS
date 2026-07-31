'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useAppFeedback } from '@/components/feedback/use-app-feedback';
import { FEEDBACK } from '@/lib/feedback-labels';
import { useRouter } from 'next/navigation';
import { AppShell } from '@/components/app-shell';
import { SecurityActivityLog } from '@/components/security-activity-log';
import { SettingsShell } from '@/components/settings/settings-shell';
import { SsoEnterpriseCard } from '@/components/sso-enterprise-card';
import { normalizePlan, type EverittosPlan } from '@/lib/everittos-plans';
import { canManageOrganizationSettings, normalizeRole } from '@/lib/roles';
import { fetchOrganizationContext } from '@/lib/organization';
import { fetchRecentSecurityEvents, fetchUserSecurityEvents } from '@/lib/security-events';
import { useTranslation } from '@/components/locale-provider';
import { PasskeyManager } from '@/components/passkey-manager';
import { SUPPORT_EMAIL } from '@/lib/support';
import { supabase } from '@/lib/supabase';

type SecurityEventRow = {
  id: string;
  event_type: string;
  severity: string;
  message: string;
  created_at: string;
  user_agent?: string | null;
  ip_address?: string | null;
};

type AuditLogRow = {
  id: string;
  action: string;
  message: string | null;
  actor_name: string | null;
  entity_type: string;
  created_at: string | null;
};

function formatAuditDate(value: string | null) {
  if (!value) return 'Unknown date';
  return new Date(value).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}

export default function SecuritySettingsPage() {
  const router = useRouter();
  const { t } = useTranslation();
  const [plan, setPlan] = useState<EverittosPlan>('free');
  const [role, setRole] = useState(normalizeRole('owner'));
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const appFeedback = useAppFeedback();
  const [personalEvents, setPersonalEvents] = useState<SecurityEventRow[]>([]);
  const [orgEvents, setOrgEvents] = useState<SecurityEventRow[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLogRow[]>([]);
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
      const org = await fetchOrganizationContext(user.id);
      const normalizedRole = normalizeRole(org?.role || profile?.role);
      setPlan(normalizePlan(profile?.plan));
      setRole(normalizedRole);

      const userEvents = await fetchUserSecurityEvents(supabase, user.id, 25);
      setPersonalEvents(userEvents as SecurityEventRow[]);

      if (org && canManageOrganizationSettings(normalizedRole)) {
        const events = await fetchRecentSecurityEvents(supabase, org.organizationId, 30);
        setOrgEvents(events as SecurityEventRow[]);

        const { data: auditRows } = await supabase
          .from('activity_logs')
          .select('id, action, message, actor_name, entity_type, created_at')
          .eq('organization_id', org.organizationId)
          .in('entity_type', ['member', 'invitation', 'organization'])
          .order('created_at', { ascending: false })
          .limit(50);
        setAuditLogs((auditRows || []) as AuditLogRow[]);
      }

      setLoading(false);
    }

    load();
  }, [router]);

  async function changePassword(event: React.FormEvent) {
    event.preventDefault();
    if (password.length < 6) {
      appFeedback.error('Password must be at least 6 characters.');
      return;
    }

    if (password !== confirmPassword) {
      appFeedback.error('Passwords do not match.');
      return;
    }

    setSaving(true);
    const { error: updateError } = await supabase.auth.updateUser({ password });
    setSaving(false);

    if (updateError) {
      appFeedback.error(updateError.message);
      return;
    }

    setPassword('');
    setConfirmPassword('');
    appFeedback.updated();
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
    <SettingsShell plan={plan} title="Security" description="Password, sessions, sign-in history, SSO, and admin audit controls.">
      <div className="settings-card">
        <h3>{t('settings.security.passkeysTitle')}</h3>
        <PasskeyManager />
        <p className="muted">
          {t('settings.security.compromised')}{' '}
          <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>.
        </p>
      </div>

      {canManageOrganizationSettings(role) ? <SsoEnterpriseCard plan={plan} /> : null}

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
          <button className="btn btn-primary" type="submit" disabled={saving}>
            {saving ? FEEDBACK.loading : 'Update password'}
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

      <div className="settings-card">
        <h3>Sign-in history</h3>
        <p className="muted">Recent sign-ins, sign-outs, password changes, and session events for your account.</p>
        <SecurityActivityLog events={personalEvents} />
        <p className="muted" style={{ marginTop: 16 }}>
          Business activity such as jobs, customers, and invoices is on the{' '}
          <Link href="/activity">activity log</Link>.
        </p>
      </div>

      {canManageOrganizationSettings(role) ? (
        <>
          <div className="settings-card">
            <h3>Company security audit</h3>
            <p className="muted">Sign-in and security events across your workspace.</p>
            <SecurityActivityLog events={orgEvents} emptyLabel="No organization security events recorded yet." />
          </div>

          <div className="settings-card">
            <h3>Admin audit log</h3>
            <p className="muted">Team invitations, role changes, ownership changes, and workspace admin actions.</p>
            {auditLogs.length === 0 ? <p className="muted">No admin audit events recorded yet.</p> : null}
            {auditLogs.map((item) => (
              <div key={item.id} className="list-row compact">
                <div>
                  <strong>{item.message || item.action.replace(/_/g, ' ')}</strong>
                  <p className="muted">
                    {item.actor_name || 'System'} · {item.entity_type} · {formatAuditDate(item.created_at)}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </>
      ) : null}
    </SettingsShell>
  );
}
