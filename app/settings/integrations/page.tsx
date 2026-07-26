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

function formatRecentTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'recently';
  const minutes = Math.max(0, Math.floor((Date.now() - date.getTime()) / 60000));
  if (minutes < 2) return 'just now';
  if (minutes < 60) return `${minutes} minutes ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} ${hours === 1 ? 'hour' : 'hours'} ago`;
  const days = Math.floor(hours / 24);
  if (days === 1) return 'yesterday';
  if (days < 7) return `${days} days ago`;
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
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
      setStatusError(timedOut ? 'Google Calendar took too long to respond. Please try again.' : 'Google Calendar status is unavailable right now. Please try again.');
      return null;
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    async function init() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.push('/login?next=/settings/integrations');
        return;
      }
      const { data: profile } = await supabase.from('profiles').select('plan, role').eq('id', user.id).maybeSingle();
      const nextRole = normalizeRole(profile?.role);
      setPlan(normalizePlan(profile?.plan));
      setRole(nextRole);
      if (!canManageOrganizationSettings(nextRole)) {
        setLoading(false);
        return;
      }

      const oauthSuccess = searchParams.get('googleCalendar') === 'connected' || searchParams.get('connected') === '1';
      const errKey = searchParams.get('error');
      if (oauthSuccess) feedback.connected();
      if (errKey) feedback.error(CALLBACK_ERRORS[errKey] || 'Google Calendar could not be connected. Please try again.');
      await loadStatus();
      if (oauthSuccess || errKey) router.replace('/settings/integrations');
    }
    void init();
  }, [feedback, loadStatus, router, searchParams]);

  async function disconnect() {
    setDisconnecting(true);
    try {
      const res = await fetchWithTimeout('/api/integrations/google-calendar/disconnect', { method: 'POST' });
      if (!res.ok) {
        feedback.error('Google Calendar could not be disconnected. Please try again.');
        return;
      }
      feedback.disconnected();
      await loadStatus();
    } catch {
      feedback.error('Google Calendar could not be disconnected. Please try again.');
    } finally {
      setDisconnecting(false);
    }
  }

  async function syncNow() {
    setSyncing(true);
    try {
      const res = await fetchWithTimeout('/api/integrations/google-calendar/sync', { method: 'POST' });
      if (!res.ok) {
        feedback.error('Google Calendar could not update. Reconnect it and try again.');
        await loadStatus();
        return;
      }
      feedback.success('Google Calendar updated.');
      await loadStatus();
    } catch {
      feedback.error('Google Calendar could not update. Please try again.');
    } finally {
      setSyncing(false);
    }
  }

  const health = status?.health || 'not_connected';
  const reconnectRequired = health === 'reconnect_required' || health === 'token_expired' || Boolean(status?.lastSyncError);
  const connected = Boolean(status?.connected) && !reconnectRequired;
  const busy = syncing || disconnecting;
  const displayStatus = !status?.configured ? 'Unavailable' : reconnectRequired ? 'Needs attention' : connected ? 'Connected' : 'Not connected';

  if (loading) {
    return (
      <SettingsShell plan={plan} role={role} title="Integrations" description="Connect the tools your team uses.">
        <div className="settings-card"><p className="loading-state">Loading integrations...</p></div>
      </SettingsShell>
    );
  }

  if (!canManageOrganizationSettings(role)) {
    return (
      <SettingsShell plan={plan} role={role} title="Integrations" description="Connect the tools your team uses.">
        <div className="settings-card"><p>Only workspace owners and admins can manage integrations.</p></div>
      </SettingsShell>
    );
  }

  return (
    <SettingsShell plan={plan} role={role} title="Integrations" description="Connect the tools your team uses.">
      <div className="settings-card">
        <h3>Google Calendar</h3>
        <p className="muted">Keep scheduled jobs and visit times aligned with Google Calendar.</p>

        {statusError ? (
          <div style={{ marginTop: 12 }}>
            <p className="auth-message auth-message-error" role="alert">{statusError}</p>
            <button type="button" className="btn" onClick={() => void loadStatus()}>Try again</button>
          </div>
        ) : (
          <>
            <p style={{ marginTop: 12 }}>Status: <strong>{displayStatus}</strong></p>
            {reconnectRequired ? <p className="muted">Reconnect Google Calendar to resume automatic updates.</p> : null}
            {!status?.configured ? <p className="muted">Google Calendar is not available for this workspace yet. Contact support for help.</p> : null}
            {status?.lastSyncAt ? <p className="muted">Last updated {formatRecentTime(status.lastSyncAt)}.</p> : null}

            {status?.configured ? (
              <>
                <div className="settings-actions" style={{ marginTop: 16 }}>
                  {!connected ? (
                    <a className="btn btn-primary" href="/api/integrations/google-calendar/connect">
                      {reconnectRequired ? 'Reconnect Google Calendar' : 'Connect Google Calendar'}
                    </a>
                  ) : (
                    <>
                      <button type="button" className="btn btn-primary" disabled={busy} onClick={() => void syncNow()}>
                        {syncing ? 'Updating...' : 'Update now'}
                      </button>
                      <button type="button" className="btn" disabled={busy} onClick={() => void disconnect()}>
                        {disconnecting ? 'Disconnecting...' : 'Disconnect'}
                      </button>
                    </>
                  )}
                  <button type="button" className="btn" disabled={busy} onClick={() => void loadStatus()}>Check connection</button>
                  <Link className="btn" href="/schedule">Open schedule</Link>
                </div>

                <div style={{ marginTop: 18 }}>
                  <h4 style={{ marginBottom: 6 }}>What stays updated</h4>
                  <p className="muted" style={{ margin: 0 }}>Scheduled jobs and visit times can stay aligned with Google Calendar.</p>
                </div>
              </>
            ) : null}
          </>
        )}
      </div>

      <div className="settings-card" style={{ marginTop: 20 }}>
        <h3>QuickBooks</h3>
        <p className="muted">Connect eligible customers and invoices to QuickBooks while EverittOS manages daily operations.</p>
        <QuickBooksIntegrationPanel canManage={canManageOrganizationSettings(role)} />
      </div>
    </SettingsShell>
  );
}

export default function IntegrationsSettingsPage() {
  return (
    <Suspense fallback={<div className="section"><p className="loading-state">Loading integrations...</p></div>}>
      <IntegrationsContent />
    </Suspense>
  );
}
