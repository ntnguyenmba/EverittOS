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
  const [showUrl, setShowUrl] = useState(false);

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

  async function copySubscriptionUrl() {
    if (!feed?.url) return;
    try {
      await navigator.clipboard.writeText(feed.url);
      appFeedback.success('Calendar subscription URL copied.');
    } catch {
      setShowUrl(true);
      appFeedback.error('Copy was blocked by the browser. The URL is shown below so you can copy it manually.');
    }
  }

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
      setShowUrl(false);
      appFeedback.success('Private calendar subscription created.');
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
      setShowUrl(false);
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
            : status?.setupMessage || 'Connect Google Calendar to sync EverittOS jobs directly.'}
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

        <h3 style={{ marginTop: 24 }}>Apple Calendar, iCal, and Outlook subscription</h3>
        <p className="muted">
          Subscribe once and your calendar app will keep authorized jobs updated automatically. Contractors only receive jobs
          assigned or shared with them. Keep this private link confidential.
        </p>
        {feed ? (
          <>
            <p className="muted">
              <strong>Private feed:</strong> {feed.tokenMasked}
              {feed.lastAccessedAt ? ` · Last checked ${new Date(feed.lastAccessedAt).toLocaleString()}` : ' · Not checked yet'}
            </p>
            <div className="inline-actions" style={{ flexWrap: 'wrap', gap: 8 }}>
              <a className="btn btn-primary" href={feed.webcalUrl}>
                Subscribe in calendar app
              </a>
              <button type="button" className="btn" onClick={() => void copySubscriptionUrl()}>
                Copy subscription URL
              </button>
              <button type="button" className="btn" onClick={() => setShowUrl((current) => !current)}>
                {showUrl ? 'Hide URL' : 'Show URL'}
              </button>
              <button type="button" className="btn" disabled={busy} onClick={() => void createOrRotateFeed()}>
                Regenerate link
              </button>
              <button type="button" className="btn" disabled={busy} onClick={() => void revokeFeed()}>
                Revoke link
              </button>
            </div>

            {showUrl ? (
              <div style={{ marginTop: 12 }}>
                <label htmlFor="calendar-subscription-url" className="muted">
                  Subscription URL
                </label>
                <input
                  id="calendar-subscription-url"
                  className="input"
                  readOnly
                  value={feed.url}
                  onFocus={(event) => event.currentTarget.select()}
                  style={{ marginTop: 6, width: '100%' }}
                />
              </div>
            ) : null}

            <div className="muted" style={{ marginTop: 16 }}>
              <p style={{ marginBottom: 6 }}>
                <strong>Apple Calendar on Mac:</strong> click “Subscribe in calendar app,” or use File → New Calendar
                Subscription and paste the copied URL.
              </p>
              <p style={{ marginBottom: 6 }}>
                <strong>iPhone or iPad:</strong> tap “Subscribe in calendar app.” If iOS does not open Calendar, copy the URL,
                then go to Settings → Apps → Calendar → Calendar Accounts → Add Account → Other → Add Subscribed Calendar.
              </p>
              <p style={{ marginBottom: 6 }}>
                <strong>Outlook:</strong> copy the URL, then choose Add calendar → Subscribe from web.
              </p>
              <p style={{ marginBottom: 0 }}>
                <strong>Google Calendar:</strong> on desktop, choose Settings → Add calendar → From URL and paste the URL.
              </p>
            </div>
          </>
        ) : (
          <button type="button" className="btn btn-primary" disabled={busy} onClick={() => void createOrRotateFeed()}>
            Create private calendar subscription
          </button>
        )}
      </div>
    </details>
  );
}
