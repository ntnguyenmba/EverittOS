'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useCallback, useEffect, useState } from 'react';
import { SettingsShell } from '@/components/settings/settings-shell';
import {
  GOOGLE_CALENDAR_PRODUCTION_REDIRECT_URI,
  googleCalendarRedirectUri
} from '@/lib/google-calendar-config';
import type { GoogleCalendarHealth } from '@/lib/google-calendar-health';
import { normalizePlan, type EverittosPlan } from '@/lib/everittos-plans';
import { canManageOrganizationSettings, normalizeRole } from '@/lib/roles';
import { supabase } from '@/lib/supabase';

type CalendarStatus = {
  configured: boolean;
  connected: boolean;
  health: GoogleCalendarHealth;
  healthLabel: string;
  canManage: boolean;
  provider: string;
  organizationId?: string;
  googleEmail: string | null;
  calendarId: string;
  syncEnabled: boolean;
  tokenExpiresAt: string | null;
  lastSyncAt: string | null;
  lastSyncError: string | null;
};

const CALLBACK_ERRORS: Record<string, string> = {
  not_configured: 'Google Calendar is not configured on the server.',
  google_denied: 'Google access was denied.',
  missing_code: 'Google did not return an authorization code.',
  invalid_state: 'The OAuth session expired. Try connecting again.',
  session_mismatch: 'Your EverittOS session changed during Google sign-in. Try again.',
  permission_denied: 'You do not have permission to connect Google Calendar for this workspace.',
  server_config: 'Server configuration is incomplete.',
  missing_refresh_token: 'Google did not return a refresh token. Disconnect the app in your Google Account and try again.',
  connect_failed: 'Google Calendar connection failed.'
};

const STATUS_FETCH_INIT: RequestInit = {
  cache: 'no-store',
  headers: {
    'Cache-Control': 'no-cache',
    Pragma: 'no-cache'
  }
};

function healthClass(health: GoogleCalendarHealth): string {
  switch (health) {
    case 'connected':
      return 'integration-health-connected';
    case 'token_expired':
      return 'integration-health-expired';
    case 'reconnect_required':
      return 'integration-health-reconnect';
    default:
      return 'integration-health-disconnected';
  }
}

function IntegrationsContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [plan, setPlan] = useState<EverittosPlan>('free');
  const [role, setRole] = useState(normalizeRole('employee'));
  const [status, setStatus] = useState<CalendarStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [successAlert, setSuccessAlert] = useState('');
  const [error, setError] = useState('');

  const loadStatus = useCallback(async () => {
    const res = await fetch('/api/integrations/google-calendar/status', STATUS_FETCH_INIT);
    if (res.status === 401) {
      router.push('/login?next=/settings/integrations');
      return null;
    }
    const json = (await res.json()) as CalendarStatus;
    setStatus(json);
    setLoading(false);
    return json;
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

      const oauthSuccess = searchParams.get('googleCalendar') === 'connected';
      const legacySuccess = searchParams.get('connected') === '1';
      const errKey = searchParams.get('error');

      if (oauthSuccess || legacySuccess) {
        setSuccessAlert('Google Calendar connected. Existing scheduled jobs were synced.');
      }

      if (errKey) {
        const detail = searchParams.get('detail');
        setError(CALLBACK_ERRORS[errKey] || 'Google Calendar connection failed.');
        if (detail) {
          setError((prev) => `${prev} ${detail}`);
        }
      }

      await loadStatus();

      if (oauthSuccess || legacySuccess || errKey) {
        router.replace('/settings/integrations');
      }
    }

    void init();
  }, [loadStatus, router, searchParams]);

  async function disconnect() {
    setBusy(true);
    setError('');
    setSuccessAlert('');
    setStatus((prev) =>
      prev
        ? {
            ...prev,
            connected: false,
            health: 'not_connected',
            healthLabel: 'Not Connected',
            googleEmail: null,
            syncEnabled: false,
            tokenExpiresAt: null,
            lastSyncAt: null,
            lastSyncError: null
          }
        : prev
    );

    const res = await fetch('/api/integrations/google-calendar/disconnect', { method: 'POST' });
    setBusy(false);
    if (!res.ok) {
      const json = await res.json();
      setError(json.error || 'Unable to disconnect.');
      await loadStatus();
      return;
    }
    setSuccessAlert('Google Calendar disconnected.');
    await loadStatus();
  }

  async function syncNow() {
    setBusy(true);
    setError('');
    setSuccessAlert('');
    const res = await fetch('/api/integrations/google-calendar/sync', { method: 'POST' });
    const json = await res.json();
    setBusy(false);
    if (!res.ok) {
      setError(json.error || 'Sync failed.');
      await loadStatus();
      return;
    }
    setSuccessAlert(`Synced ${json.synced} job(s) to Google Calendar.${json.failed ? ` ${json.failed} failed.` : ''}`);
    await loadStatus();
  }

  const health = status?.health || 'not_connected';
  const showOperational = Boolean(status?.connected);

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
      {successAlert ? <p className="auth-message auth-message-success">{successAlert}</p> : null}
      {error ? <p className="auth-message auth-message-error">{error}</p> : null}

      <div className="settings-card">
        <h3>Google Calendar</h3>
        <p className="muted">
          Push scheduled jobs from EverittOS to Google Calendar. Jobs with a schedule or due date sync as calendar
          events. Updates on the schedule page sync automatically.
        </p>

        <p style={{ marginTop: 12 }}>
          Status:{' '}
          <strong className={healthClass(health)}>
            {!status?.configured ? 'Configuration missing' : status.healthLabel || 'Not Connected'}
          </strong>
          {status?.googleEmail ? ` (${status.googleEmail})` : ''}
        </p>

        {health === 'token_expired' ? (
          <p className="muted">Access token expired. EverittOS will refresh automatically on the next sync.</p>
        ) : null}

        {health === 'reconnect_required' ? (
          <p className="muted">Reconnect Google Calendar to restore sync.</p>
        ) : null}

        {!status?.configured ? (
          <p className="muted" style={{ marginTop: 12 }}>
            Google Calendar OAuth is not configured on this server. Set <code>GOOGLE_CLIENT_ID</code> and{' '}
            <code>GOOGLE_CLIENT_SECRET</code> in your deployment environment. See{' '}
            <code>docs/GOOGLE_CALENDAR_SETUP.md</code>.
          </p>
        ) : null}

        {status?.configured ? (
          <>
            {status.tokenExpiresAt ? (
              <p className="muted">Token expires: {new Date(status.tokenExpiresAt).toLocaleString()}</p>
            ) : null}
            {showOperational && status.lastSyncAt ? (
              <p className="muted">Last sync: {new Date(status.lastSyncAt).toLocaleString()}</p>
            ) : null}
            {status.lastSyncError ? <p className="auth-message auth-message-error">{status.lastSyncError}</p> : null}

            <div className="settings-actions" style={{ marginTop: 16 }}>
              {!showOperational ? (
                <a className="btn btn-primary" href="/api/integrations/google-calendar/connect">
                  {health === 'reconnect_required' ? 'Reconnect Google Calendar' : 'Connect Google Calendar'}
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

        <p className="muted integration-callback-note" style={{ marginTop: 16 }}>
          OAuth redirect URI for Google Cloud Console: <code>{GOOGLE_CALENDAR_PRODUCTION_REDIRECT_URI}</code>
        </p>
        {status?.configured ? (
          <p className="muted">
            Active callback for this deployment: <code>{googleCalendarRedirectUri()}</code>
          </p>
        ) : null}
      </div>

      <div className="settings-card" style={{ marginTop: 20 }}>
        <h3>Accounting integrations</h3>
        <p className="muted">
          QuickBooks, Xero, and Wave connections are planned for later. EverittOS keeps performance tracking simple
          for now.
        </p>
        <ul className="integration-coming-list">
          <li>
            <strong>QuickBooks</strong> <span className="muted">Coming later</span>
          </li>
          <li>
            <strong>Xero</strong> <span className="muted">Coming later</span>
          </li>
          <li>
            <strong>Wave</strong> <span className="muted">Coming later</span>
          </li>
        </ul>
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
