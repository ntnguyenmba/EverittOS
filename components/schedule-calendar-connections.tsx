'use client';

import { useCallback, useEffect, useState } from 'react';
import { useAppFeedback } from '@/components/feedback/use-app-feedback';
import { canManageOrganizationSettings, type UserRole } from '@/lib/roles';

type CalendarStatus = {
  configured?: boolean;
  connected?: boolean;
  healthLabel?: string;
  canManage?: boolean;
  googleEmail?: string | null;
  lastSyncAt?: string | null;
  lastError?: string | null;
  setupMessage?: string | null;
};

type FeedInfo = {
  url: string;
  webcalUrl: string;
  tokenMasked: string;
  createdAt?: string;
  lastAccessedAt?: string | null;
} | null;

export function ScheduleCalendarConnections({ role }: { role: UserRole }) {
  const appFeedback = useAppFeedback();
  const canManageGoogle = canManageOrganizationSettings(role);
  const [status, setStatus] = useState<CalendarStatus | null>(null);
  const [feed, setFeed] = useState<FeedInfo>(null);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [statusRes, feedRes] = await Promise.all([
        fetch('/api/integrations/google-calendar/status', { cache: 'no-store' }),
        fetch('/api/calendar/feed', { cache: 'no-store' })
      ]);
      const statusJson = await statusRes.json().catch(() => ({}));
      const feedJson = await feedRes.json().catch(() => ({}));
      if (statusRes.ok) {
        setStatus({
          configured: Boolean(statusJson.configured),
          connected: Boolean(statusJson.connected),
          healthLabel: statusJson.healthLabel || statusJson.health || 'Unknown',
          canManage: Boolean(statusJson.canManage),
          googleEmail: statusJson.googleEmail || null,
          lastSyncAt: statusJson.lastSyncAt || statusJson.last_sync_at || null,
          lastError: statusJson.lastError || statusJson.last_sync_error || null,
          setupMessage: statusJson.setupMessage || null
        });
      }
      setFeed(feedJson.feed || null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function syncNow() {
    if (busy) return;
    setBusy(true);
    try {
      const res = await fetch('/api/integrations/google-calendar/sync', { method: 'POST' });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        appFeedback.error(json.error || 'Google Calendar sync failed.');
        return;
      }
      appFeedback.success(
        `Synced ${json.synced ?? 0} job${json.synced === 1 ? '' : 's'}${json.failed ? ` (${json.failed} failed)` : ''}.`
      );
      await load();
    } finally {
      setBusy(false);
    }
  }

  async function disconnect() {
    if (busy) return;
    setBusy(true);
    try {
      const res = await fetch('/api/integrations/google-calendar/disconnect', { method: 'POST' });
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        appFeedback.error(json.error || 'Could not disconnect Google Calendar.');
        return;
      }
      appFeedback.disconnected();
      await load();
    } finally {
      setBusy(false);
    }
  }

  async function createOrRotateFeed() {
    if (busy) return;
    setBusy(true);
    try {
      const res = await fetch('/api/calendar/feed', { method: 'POST' });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        appFeedback.error(json.error || 'Could not create calendar feed.');
        return;
      }
      setFeed(json.feed || null);
      appFeedback.success('Calendar subscription link ready. Copy it into Apple Calendar, Google Calendar, or Outlook.');
    } finally {
      setBusy(false);
    }
  }

  async function revokeFeed() {
    if (busy) return;
    if (!window.confirm('Revoke this calendar subscription link? Existing calendar apps will stop updating.')) return;
    setBusy(true);
    try {
      const res = await fetch('/api/calendar/feed', { method: 'DELETE' });
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        appFeedback.error(json.error || 'Could not revoke calendar feed.');
        return;
      }
      setFeed(null);
      appFeedback.success('Calendar subscription revoked.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <details style={{ marginTop: 24 }} open>
      <summary>
        <strong>Calendar connections</strong>
      </summary>
      <div className="card" style={{ marginTop: 12 }}>
        {loading ? <p className="muted">Checking calendar status…</p> : null}

        <h3 style={{ marginTop: 0 }}>Google Calendar connection</h3>
        <p className="muted">
          {status?.connected
            ? `Connected${status.googleEmail ? ` as ${status.googleEmail}` : ''}. Jobs sync to your organization calendar.`
            : status?.setupMessage ||
              'Connect Google Calendar to keep EverittOS jobs visible in Apple Calendar, Google Calendar, Outlook, or another calendar app.'}
        </p>
        {status?.lastSyncAt ? <p className="muted">Last sync: {new Date(status.lastSyncAt).toLocaleString()}</p> : null}
        {status?.lastError ? (
          <p className="auth-message auth-message-error" role="alert">
            {status.lastError}
          </p>
        ) : null}
        <div className="inline-actions" style={{ flexWrap: 'wrap', gap: 8 }}>
          {canManageGoogle && !status?.connected ? (
            <a className="btn btn-primary" href="/api/integrations/google-calendar/connect">
              Connect Google Calendar
            </a>
          ) : null}
          {canManageGoogle && status?.connected ? (
            <>
              <button type="button" className="btn" disabled={busy} onClick={() => void syncNow()}>
                {busy ? 'Working…' : 'Sync now'}
              </button>
              <button type="button" className="btn" disabled={busy} onClick={() => void disconnect()}>
                Disconnect
              </button>
            </>
          ) : null}
          <button type="button" className="btn" disabled={loading || busy} onClick={() => void load()}>
            Refresh status
          </button>
        </div>

        <h3 style={{ marginTop: 24 }}>Apple Calendar / iCal / Outlook subscription</h3>
        <p className="muted">
          Create a private subscription link for your authorized jobs. Regenerate or revoke it anytime. Contractors only
          receive assigned or shared jobs.
        </p>
        {feed ? (
          <>
            <p>
              <strong>Feed:</strong> <code>{feed.tokenMasked}</code>
            </p>
            <p className="muted" style={{ wordBreak: 'break-all' }}>
              {feed.url}
            </p>
            <div className="inline-actions" style={{ flexWrap: 'wrap', gap: 8 }}>
              <button
                type="button"
                className="btn"
                onClick={() => {
                  void navigator.clipboard.writeText(feed.url);
                  appFeedback.success('Calendar feed URL copied.');
                }}
              >
                Copy subscription URL
              </button>
              <a className="btn" href={feed.webcalUrl}>
                Open in calendar app
              </a>
              <button type="button" className="btn" disabled={busy} onClick={() => void createOrRotateFeed()}>
                Regenerate link
              </button>
              <button type="button" className="btn" disabled={busy} onClick={() => void revokeFeed()}>
                Revoke link
              </button>
            </div>
            <ol className="muted" style={{ marginTop: 12, paddingLeft: 18 }}>
              <li>Apple Calendar: File → New Calendar Subscription → paste the URL.</li>
              <li>Google Calendar: Settings → Add calendar → From URL → paste the URL.</li>
              <li>Outlook: Add calendar → Subscribe from web → paste the URL.</li>
            </ol>
          </>
        ) : (
          <button type="button" className="btn btn-primary" disabled={busy} onClick={() => void createOrRotateFeed()}>
            Create calendar subscription
          </button>
        )}
      </div>
    </details>
  );
}
