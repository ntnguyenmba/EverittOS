'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useCallback, useEffect, useState } from 'react';
import { useAppFeedback } from '@/components/feedback/use-app-feedback';
import { SettingsShell } from '@/components/settings/settings-shell';
import { QuickBooksIntegrationPanel } from '@/components/quickbooks-integration-panel';
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

type ApiPayload = Record<string, unknown>;

const CALLBACK_ERRORS: Record<string, string> = {
  not_configured: 'Google Calendar is not available yet. Please contact support.',
  google_denied: 'Google Calendar access was not approved.',
  missing_code: 'Google Calendar could not be connected. Please try again.',
  invalid_state: 'Your connection request expired. Please try again.',
  session_mismatch: 'Your session changed during sign-in. Please try again.',
  permission_denied: 'Only workspace owners and admins can connect Google Calendar.',
  server_config: 'Google Calendar is not available yet. Please contact support.',
  missing_refresh_token: 'Google Calendar needs to be reconnected.',
  connect_failed: 'Google Calendar could not be connected. Please try again.'
};

const REQUEST_TIMEOUT_MS = 10000;

async function fetchWithTimeout(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    return await fetch(input, {
      cache: 'no-store',
      ...init,
      headers: {
        'Cache-Control': 'no-cache',
        Pragma: 'no-cache',
        ...(init?.headers || {})
      },
      signal: controller.signal
    });
  } finally {
    clearTimeout(timer);
  }
}

async function readJson(response: Response): Promise<ApiPayload> {
  return (await response.json().catch(() => ({}))) as ApiPayload;
}

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
  const feedback = useAppFeedback();
  const [plan, setPlan] = useState<EverittosPlan>('free');
  const [role, setRole] = useState(normalizeRole('employee'));
  const [status, setStatus] = useState<CalendarStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [statusError, setStatusError] = useState('');
  const [syncing, setSyncing] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const [actionError, setActionError] = useState('');

  const loadStatus = useCallback(async () => {
    setLoading(true);
    setStatusError('');

    try {
      const res = await fetchWithTimeout('/api/integrations/google-calendar/status');
      if (res.status === 401) {
        router.push('/login?next=/settings/integrations');
        return null;
      }

      const json = await readJson(res);
      if (!res.ok) {
        setStatus(null);
        setStatusError('Google Calendar status is unavailable right now. Please try again.');
        return null;
      }

      const nextStatus = json as unknown as CalendarStatus;
      setStatus(nextStatus);
      return nextStatus;
    } catch (error) {
      const timedOut = error instanceof DOMException && error.name === 'AbortError';
      setStatus(null);
      setStatusError(
        timedOut
          ? 'Google Calendar took too long to respond. Please try again.'
          : 'Google Calendar status is unavailable right now. Please try again.'
      );
      return null;
    } finally {
      setLoading(false);
    }
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

      if (oauthSuccess || legacySuccess) feedback.connected();

      if (errKey) {
        feedback.error(CALLBACK_ERRORS[errKey] || 'Google Calendar could not be connected. Please try again.');
      }

      await loadStatus();

      if (oauthSuccess || legacySuccess || errKey) {
        router.replace('/settings/integrations');
      }
    }

    void init();
  }, [feedback, loadStatus, router, searchParams]);

  async function disconnect() {
    setDisconnecting(true);
    setActionError('');

    try {
      const res = await fetchWithTimeout('/api/integrations/google-calendar/disconnect', { method: 'POST' });
      await readJson(res);
      if (!res.ok) {
        const message = 'Google Calendar could not be disconnected. Please try again.';
        setActionError(message);
        feedback.error(message);
        return;
      }

      feedback.disconnected();
      await loadStatus();
    } catch (error) {
      const timedOut = error instanceof DOMException && error.name === 'AbortError';
      const message = timedOut
        ? 'Google Calendar took too long to respond. Please try again.'
        : 'Google Calendar could not be disconnected. Please try again.';
      setActionError(message);
      feedback.error(message);
    } finally {
      setDisconnecting(false);
    }
  }

  async function syncNow() {
    setSyncing(true);
    setActionError('');

    try {
      const res = await fetchWithTimeout('/api/integrations/google-calendar/sync', { method: 'POST' });
      const json = await readJson(res);
      if (!res.ok) {
        const message = 'Google Calendar could not sync. Refresh the status or reconnect and try again.';
        setActionError(message);
        feedback.error(message);
        await loadStatus();
        return;
      }

      const synced = typeof json.synced === 'number' ? json.synced : null;
      const failed = typeof json.failed === 'number' ? json.failed : null;
      const summary = synced == null
        ? 'Google Calendar sync completed.'
        : `Google Calendar sync completed. ${synced} synced${failed ? `, ${failed} need attention` : ''}.`;
      feedback.success(summary);
      await loadStatus();
    } catch (error) {
      const timedOut = error instanceof DOMException && error.name === 'AbortError';
      const message = timedOut
        ? 'Google Calendar took too long to respond. Please try again.'
        : 'Google Calendar could not sync. Please try again.';
      setActionError(message);
      feedback.error(message);
    } finally {
      setSyncing(false);
    }
  }

  const health = status?.health || 'not_connected';
  const reconnectRecommended = health === 'reconnect_required' || (health === 'token_expired' && Boolean(status?.lastSyncError));
  const showOperational = Boolean(status?.connected) && !reconnectRecommended;
  const busy = syncing || disconnecting;
  const displayStatus = !status?.configured
    ? 'Unavailable'
    : reconnectRecommended
      ? 'Needs attention'
      : showOperational
        ? 'Connected'
        : 'Not connected';

  if (loading) {
    return (
      <SettingsShell plan={plan} role={role} title="Integrations" description="Connect external tools to EverittOS.">
        <div className="settings-card" style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <span>Loading integrations...</span>
          <button type="button" className="btn btn-sm" onClick={() => void loadStatus()}>Retry</button>
        </div>
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
      <div className="settings-card">
        <h3>Google Calendar</h3>
        <p className="muted">
          Keep scheduled jobs in sync with Google Calendar. Changes made in the EverittOS schedule update the matching calendar event automatically.
        </p>

        {statusError ? (
          <div style={{ marginTop: 12 }}>
            <p className="auth-message auth-message-error" role="alert">{statusError}</p>
            <button type="button" className="btn" onClick={() => void loadStatus()}>
              Try again
            </button>
          </div>
        ) : (
          <>
            <p style={{ marginTop: 12 }}>
              Status:{' '}
              <strong className={healthClass(health)}>{displayStatus}</strong>
            </p>

            {status?.googleEmail && showOperational ? (
              <p className="muted">Connected account: {status.googleEmail}</p>
            ) : null}

            {health === 'token_expired' && !reconnectRecommended ? (
              <p className="muted">Sync is paused. Select Sync now to restore the connection.</p>
            ) : null}

            {reconnectRecommended ? (
              <p className="muted">Reconnect Google Calendar to resume automatic updates.</p>
            ) : null}

            {!status?.configured ? (
              <p className="muted" style={{ marginTop: 12 }}>
                Google Calendar is not available for this workspace yet. Contact EverittOS support for help.
              </p>
            ) : null}

            {status?.configured ? (
              <>
                {status.lastSyncAt ? (
                  <p className="muted">Last synced: {new Date(status.lastSyncAt).toLocaleString()}</p>
                ) : null}
                {status.lastSyncError && reconnectRecommended ? (
                  <p className="auth-message auth-message-error">Google Calendar needs attention. Reconnect it to continue syncing.</p>
                ) : null}
                {actionError ? <p className="auth-message auth-message-error" role="alert">{actionError}</p> : null}

                <div className="settings-actions" style={{ marginTop: 16 }}>
                  {!showOperational ? (
                    <a className="btn btn-primary" href="/api/integrations/google-calendar/connect">
                      {reconnectRecommended ? 'Reconnect Google Calendar' : 'Connect Google Calendar'}
                    </a>
                  ) : (
                    <>
                      <button type="button" className="btn btn-primary" disabled={busy} onClick={() => void syncNow()}>
                        {syncing ? 'Syncing...' : 'Sync now'}
                      </button>
                      <button type="button" className="btn" disabled={busy} onClick={() => void disconnect()}>
                        {disconnecting ? 'Disconnecting...' : 'Disconnect'}
                      </button>
                    </>
                  )}
                  <button type="button" className="btn" disabled={busy} onClick={() => void loadStatus()}>
                    Refresh
                  </button>
                  <Link className="btn" href="/schedule">
                    Open schedule
                  </Link>
                </div>

                <div style={{ marginTop: 18 }}>
                  <h4 style={{ marginBottom: 6 }}>Where this appears</h4>
                  <p className="muted" style={{ margin: 0 }}>
                    Calendar status appears on scheduled jobs, the schedule, and the dashboard integration overview.
                  </p>
                </div>
              </>
            ) : null}
          </>
        )}
      </div>

      <div className="settings-card" style={{ marginTop: 20 }}>
        <h3>QuickBooks</h3>
        <p className="muted">
          Connect QuickBooks to keep eligible customers, invoices, and financial records aligned with your accounting workflow.
        </p>
        <QuickBooksIntegrationPanel canManage={canManageOrganizationSettings(role)} />
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
