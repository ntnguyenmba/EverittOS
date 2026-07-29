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

type CalendarAction =
  | 'google-sync'
  | 'google-disconnect'
  | 'feed-sync'
  | 'feed-disconnect'
  | null;

export function ScheduleCalendarConnections({ role }: { role: UserRole }) {
  const appFeedback = useAppFeedback();
  const canManageGoogle = canManageOrganizationSettings(role);
  const [status, setStatus] = useState<CalendarStatus | null>(null);
  const [feed, setFeed] = useState<FeedInfo>(null);
  const [activeAction, setActiveAction] = useState<CalendarAction>(null);
  const [loading, setLoading] = useState(true);
  const busy = activeAction !== null;

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
    setActiveAction('google-sync');
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
      setActiveAction(null);
    }
  }

  async function disconnect() {
    if (busy) return;
    setActiveAction('google-disconnect');
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
      setActiveAction(null);
    }
  }

  async function syncCalendarSubscription() {
    if (busy) return;
    if (feed?.webcalUrl) {
      window.location.href = feed.webcalUrl;
      return;
    }

    setActiveAction('feed-sync');
    try {
      const res = await fetch('/api/calendar/feed', { method: 'POST' });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        appFeedback.error(json.error || 'Could not connect calendar subscription.');
        return;
      }

      const nextFeed = json.feed || null;
      setFeed(nextFeed);
      if (nextFeed?.webcalUrl) {
        window.location.href = nextFeed.webcalUrl;
      } else {
        appFeedback.error('Calendar subscription could not be opened.');
      }
    } finally {
      setActiveAction(null);
    }
  }

  async function disconnectCalendarSubscription() {
    if (busy || !feed) return;
    setActiveAction('feed-disconnect');
    try {
      const res = await fetch('/api/calendar/feed', { method: 'DELETE' });
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        appFeedback.error(json.error || 'Could not disconnect calendar subscription.');
        return;
      }
      setFeed(null);
      appFeedback.disconnected();
    } finally {
      setActiveAction(null);
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
                {activeAction === 'google-sync' ? 'Working…' : 'Sync now'}
              </button>
              <button type="button" className="btn" disabled={busy} onClick={() => void disconnect()}>
                {activeAction === 'google-disconnect' ? 'Working…' : 'Disconnect'}
              </button>
            </>
          ) : null}
          <button type="button" className="btn" disabled={loading || busy} onClick={() => void load()}>
            Refresh status
          </button>
        </div>

        <h3 style={{ marginTop: 24 }}>Calendar subscription</h3>
        <p className="muted">
          Add authorized jobs to Apple Calendar, Outlook, or another calendar app. Updates happen automatically.
        </p>
        <div className="inline-actions" style={{ flexWrap: 'wrap', gap: 8 }}>
          <button type="button" className="btn btn-primary" disabled={loading || busy} onClick={() => void syncCalendarSubscription()}>
            {activeAction === 'feed-sync' ? 'Working…' : 'Sync'}
          </button>
          {feed ? (
            <button type="button" className="btn" disabled={busy} onClick={() => void disconnectCalendarSubscription()}>
              {activeAction === 'feed-disconnect' ? 'Working…' : 'Disconnect'}
            </button>
          ) : null}
        </div>
      </div>
    </details>
  );
}
