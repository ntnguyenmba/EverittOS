'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useCallback, useEffect, useState } from 'react';
import { SettingsShell } from '@/components/settings/settings-shell';
import { googleCalendarRedirectUri } from '@/lib/google-calendar-config';
import { normalizePlan, type EverittosPlan } from '@/lib/everittos-plans';
import { canManageOrganizationSettings, normalizeRole } from '@/lib/roles';
import { supabase } from '@/lib/supabase';

type CalendarStatus = {
  configured: boolean;
  connected: boolean;
  canManage: boolean;
  googleEmail: string | null;
  calendarId: string;
  syncEnabled: boolean;
  lastSyncAt: string | null;
  lastSyncError: string | null;
};

const CALLBACK_ERRORS: Record<string, string> = {
  not_configured: 'Google Calendar is not configured on the server.',
  google_denied: 'Google access was denied.',
  missing_code: 'Google did not return an authorization code.',
  invalid_state: 'The OAuth session expired. Try connecting again.',
  session_mismatch: 'Your EverittOS session changed during Google sign-in. Try again.',
  permission_denied: 'You do not have permission to connect Google Calendar.',
  server_config: 'Server configuration is incomplete.',
  missing_refresh_token: 'Google did not return a refresh token. Disconnect the app in your Google Account and try again.',
  connect_failed: 'Google Calendar connection failed.'
};

function IntegrationsContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [plan, setPlan] = useState<EverittosPlan>('free');
  const [role, setRole] = useState(normalizeRole('employee'));
  const [status, setStatus] = useState<CalendarStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const loadStatus = useCallback(async () => {
    const res = await fetch('/api/integrations/google-calendar/status');
    if (res.status === 401) {
      router.push('/login?next=/settings/integrations');
      return;
    }
    const json = (await res.json()) as CalendarStatus;
    setStatus(json);
    setLoading(false);
  }, [router]);

  useEffect(() => {
    async function init() {
      const {
        data: { user }
      } = await supabase.auth.getUser();
      if (!user) {
        router.push('/login?next=/settings/integrations');
        return;
      }

      const { data: profile } = await supabase.from('profiles').select('plan, role').eq('id', user.id).maybeSingle();
      setPlan(normalizePlan(profile?.plan));
      setRole(normalizeRole(profile?.role));

      if (!canManageOrganizationSettings(normalizeRole(profile?.role))) {
        setLoading(false);
        return;
      }

      await loadStatus();
    }

    void init();
  }, [loadStatus, router]);

  useEffect(() => {
    if (searchParams.get('connected') === '1') {
      setMessage('Google Calendar connected. Existing scheduled jobs were synced.');
    }
    const errKey = searchParams.get('error');
    if (errKey) {
      const detail = searchParams.get('detail');
      setError(CALLBACK_ERRORS[errKey] || 'Google Calendar connection failed.');
      if (detail && errKey === 'connect_failed') {
        setError(`${CALLBACK_ERRORS.connect_failed} ${detail}`);
      }
    }
  }, [searchParams]);

  async function disconnect() {
    setBusy(true);
    setError('');
    setMessage('');
    const res = await fetch('/api/integrations/google-calendar/disconnect', { method: 'POST' });
    setBusy(false);
    if (!res.ok) {
      const json = await res.json();
      setError(json.error || 'Unable to disconnect.');
      return;
    }
    setMessage('Google Calendar disconnected.');
    await loadStatus();
  }

  async function syncNow() {
    setBusy(true);
    setError('');
    setMessage('');
    const res = await fetch('/api/integrations/google-calendar/sync', { method: 'POST' });
    const json = await res.json();
    setBusy(false);
    if (!res.ok) {
      setError(json.error || 'Sync failed.');
      return;
    }
    setMessage(`Synced ${json.synced} job(s) to Google Calendar.${json.failed ? ` ${json.failed} failed.` : ''}`);
    await loadStatus();
  }

  if (loading) {
    return (
      <SettingsShell plan={plan} role={role} title="Integrations" description="Connect external tools to EverittOS.">
        <div className="settings-card">Loading integrations...</div>
      </SettingsShell>
    );
  }

  if (!canManageOrganizationSettings(role)) {
    return (
      <SettingsShell plan={plan} role={role} title="Integrations" description="Connect external tools to EverittOS.">
        <div className="settings-card">
          <p>Only workspace owners and admins can manage integrations.</p>
        </div>
      </SettingsShell>
    );
  }

  return (
    <SettingsShell plan={plan} role={role} title="Integrations" description="Connect external tools to EverittOS.">
      {message ? <p className="auth-message auth-message-success">{message}</p> : null}
      {error ? <p className="auth-message auth-message-error">{error}</p> : null}

      <div className="settings-card">
        <h3>Google Calendar</h3>
        <p className="muted">
          Push scheduled jobs from EverittOS to Google Calendar. Jobs with a schedule or due date sync as calendar
          events. Updates on the schedule page sync automatically.
        </p>

        {!status?.configured ? (
          <p className="muted" style={{ marginTop: 12 }}>
            Google Calendar OAuth is not configured on this deployment. Add the environment variables listed in{' '}
            <code>docs/GOOGLE_CALENDAR_SETUP.md</code> in Vercel.
          </p>
        ) : null}

        {status?.configured ? (
          <>
            <p style={{ marginTop: 12 }}>
              Status:{' '}
              <strong>{status.connected ? 'Connected' : 'Not connected'}</strong>
              {status.connected && status.googleEmail ? ` (${status.googleEmail})` : ''}
            </p>
            {status.connected && status.lastSyncAt ? (
              <p className="muted">Last sync: {new Date(status.lastSyncAt).toLocaleString()}</p>
            ) : null}
            {status.lastSyncError ? <p className="auth-message auth-message-error">{status.lastSyncError}</p> : null}

            <div className="settings-actions" style={{ marginTop: 16 }}>
              {!status.connected ? (
                <a className="btn btn-primary" href="/api/integrations/google-calendar/connect">
                  Connect Google Calendar
                </a>
              ) : (
                <>
                  <button type="button" className="btn btn-primary" disabled={busy} onClick={() => void syncNow()}>
                    {busy ? 'Syncing...' : 'Sync now'}
                  </button>
                  <button type="button" className="btn" disabled={busy} onClick={() => void disconnect()}>
                    Disconnect
                  </button>
                </>
              )}
              <Link className="btn" href="/schedule">
                Open schedule
              </Link>
            </div>
          </>
        ) : null}

        <p className="muted" style={{ marginTop: 16, fontSize: 13 }}>
          Production OAuth redirect:{' '}
          <code>{googleCalendarRedirectUri()}</code>
        </p>
      </div>
    </SettingsShell>
  );
}

export default function IntegrationsSettingsPage() {
  return (
    <Suspense
      fallback={
        <main className="section">
          <div className="container card">Loading integrations...</div>
        </main>
      }
    >
      <IntegrationsContent />
    </Suspense>
  );
}
