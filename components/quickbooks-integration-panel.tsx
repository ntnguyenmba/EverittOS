'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useAppFeedback } from '@/components/feedback/use-app-feedback';
import { useTranslation } from '@/components/locale-provider';

type SyncLog = {
  id?: string;
  entity_type?: string;
  action?: string;
  status?: string;
  error_message?: string | null;
  created_at?: string;
};

type QuickBooksStatus = {
  configured: boolean;
  canConnect: boolean;
  connection?: {
    status?: string;
    company_name?: string | null;
    realm_id?: string | null;
    last_sync_at?: string | null;
    last_error?: string | null;
    updated_at?: string | null;
    needsReconnect?: boolean;
  };
  recentLogs?: SyncLog[];
  needsReconnect?: boolean;
  setupMessage?: string | null;
};

const REQUEST_TIMEOUT_MS = 12000;

async function fetchWithTimeout(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    return await fetch(input, {
      ...init,
      credentials: 'same-origin',
      cache: 'no-store',
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

async function readJson(response: Response): Promise<Record<string, unknown>> {
  return (await response.json().catch(() => ({}))) as Record<string, unknown>;
}

function formatRelativeTime(value: string): string {
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

function maskRealmId(realmId: string | null | undefined): string | null {
  if (!realmId) return null;
  if (realmId.length <= 6) return realmId;
  return `${realmId.slice(0, 3)}…${realmId.slice(-3)}`;
}

export function QuickBooksIntegrationPanel({ canManage }: { canManage: boolean }) {
  const searchParams = useSearchParams();
  const { t } = useTranslation();
  const appFeedback = useAppFeedback();
  const mounted = useRef(true);
  const loadingRef = useRef(false);
  const [status, setStatus] = useState<QuickBooksStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [unauthorized, setUnauthorized] = useState(false);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const load = useCallback(async () => {
    if (loadingRef.current) return;
    loadingRef.current = true;
    setLoading(true);
    setLoadError('');
    setUnauthorized(false);

    try {
      const res = await fetchWithTimeout(`/api/integrations/quickbooks/status?t=${Date.now()}`);
      const json = await readJson(res);
      if (!mounted.current) return;

      if (!res.ok) {
        if (res.status === 401) {
          setUnauthorized(true);
          setLoadError('Your session expired. Sign in again to manage QuickBooks.');
        } else {
          setLoadError(typeof json.error === 'string' ? json.error : 'QuickBooks status is temporarily unavailable.');
        }
        setStatus(null);
        return;
      }

      setStatus({
        configured: Boolean(json.configured),
        canConnect: Boolean(json.canConnect),
        connection: (json.connection || { status: 'disconnected' }) as QuickBooksStatus['connection'],
        recentLogs: Array.isArray(json.recentLogs) ? (json.recentLogs as SyncLog[]) : [],
        needsReconnect: Boolean(json.needsReconnect),
        setupMessage: typeof json.setupMessage === 'string' ? json.setupMessage : null
      });
    } catch (error) {
      if (!mounted.current) return;
      const timedOut = error instanceof DOMException && error.name === 'AbortError';
      setLoadError(timedOut ? 'QuickBooks took too long to respond. Try again.' : 'QuickBooks status is temporarily unavailable.');
      setStatus(null);
    } finally {
      loadingRef.current = false;
      if (mounted.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const qb = searchParams.get('quickbooks');
    if (qb === 'connected') {
      appFeedback.connected();
      void load();
    }
    if (qb === 'error') {
      appFeedback.error('QuickBooks could not be connected. Please try again.');
    }
  }, [searchParams, appFeedback, load]);

  async function disconnect() {
    if (busy) return;
    setBusy(true);
    try {
      const res = await fetchWithTimeout('/api/integrations/quickbooks/disconnect', { method: 'POST' });
      if (!res.ok) {
        appFeedback.error('QuickBooks could not be disconnected. Please try again.');
        return;
      }
      appFeedback.disconnected();
      await load();
    } catch (error) {
      const timedOut = error instanceof DOMException && error.name === 'AbortError';
      appFeedback.error(timedOut ? 'QuickBooks took too long to respond. Try again.' : 'QuickBooks could not be disconnected. Please try again.');
    } finally {
      setBusy(false);
    }
  }

  async function syncNow() {
    if (busy) return;
    setBusy(true);
    try {
      const res = await fetchWithTimeout('/api/integrations/quickbooks/sync-now', { method: 'POST' });
      const json = await readJson(res);
      if (!res.ok) {
        appFeedback.error(typeof json.error === 'string' ? json.error : 'QuickBooks sync failed.');
        await load();
        return;
      }
      appFeedback.success('QuickBooks connection verified. Customer and invoice exports remain one-way to QuickBooks.');
      await load();
    } catch (error) {
      const timedOut = error instanceof DOMException && error.name === 'AbortError';
      appFeedback.error(timedOut ? 'QuickBooks took too long to respond. Try again.' : 'QuickBooks sync failed.');
    } finally {
      setBusy(false);
    }
  }

  const connected = status?.connection?.status === 'connected';
  const needsReconnect = Boolean(
    status?.needsReconnect || status?.connection?.needsReconnect || status?.connection?.status === 'error'
  );
  const configured = Boolean(status?.configured);
  const statusText = loading
    ? 'Checking...'
    : unauthorized
      ? 'Sign in required'
      : loadError
        ? 'Failed'
        : connected
          ? 'Connected'
          : needsReconnect
            ? 'Failed — reconnect required'
            : configured
              ? 'Disconnected'
              : status
                ? 'Not configured'
                : 'Not checked';
  const showConnect = canManage && !connected;
  const realmMasked = maskRealmId(status?.connection?.realm_id);
  const recentLogs = status?.recentLogs || [];

  return (
    <div>
      {!status && !loading && !loadError ? (
        <p className="muted">Connect QuickBooks to sync supported customers, invoices, payments, and expenses.</p>
      ) : null}

      <p style={{ marginBottom: 10 }}>
        {t('pages.quickbooks.statusLabel')}: <strong>{statusText}</strong>
      </p>

      {loadError ? <p className="auth-message auth-message-error" role="alert">{loadError}</p> : null}
      {status?.setupMessage && !connected ? <p className="muted">{status.setupMessage}</p> : null}
      {needsReconnect && !loadError ? (
        <p className="muted">Reconnect QuickBooks to resume customer and invoice updates.</p>
      ) : null}

      <div className="settings-actions" style={{ marginTop: 12 }}>
        {unauthorized ? (
          <a className="btn btn-primary" href="/login?next=/invoices">
            Sign in again
          </a>
        ) : showConnect ? (
          <a className="btn btn-primary" href="/api/integrations/quickbooks/connect">
            {needsReconnect ? t('pages.quickbooks.reconnect') : t('pages.quickbooks.connect')}
          </a>
        ) : null}

        <button type="button" className="btn" disabled={loading || busy} onClick={() => void load()}>
          {loading ? 'Checking...' : 'Refresh status'}
        </button>

        {canManage && connected ? (
          <button type="button" className="btn" disabled={busy || loading} onClick={() => void syncNow()}>
            {busy ? 'Syncing…' : 'Sync now'}
          </button>
        ) : null}

        {canManage && (connected || needsReconnect) ? (
          <button type="button" className="btn" disabled={busy || loading} onClick={() => void disconnect()}>
            {busy ? 'Disconnecting...' : t('pages.quickbooks.disconnect')}
          </button>
        ) : null}
      </div>

      {status?.connection?.company_name ? (
        <p className="muted" style={{ marginTop: 12 }}>
          Connected company: <strong>{status.connection.company_name}</strong>
          {realmMasked ? ` · Realm ${realmMasked}` : ''}
        </p>
      ) : null}
      {status?.connection?.last_sync_at ? (
        <p className="muted">Last successful sync {formatRelativeTime(status.connection.last_sync_at)}.</p>
      ) : connected ? (
        <p className="muted">No successful sync recorded yet. Use Sync now to verify the connection.</p>
      ) : null}
      {status?.connection?.updated_at ? (
        <p className="muted">Last attempted update {formatRelativeTime(status.connection.updated_at)}.</p>
      ) : null}
      {status?.connection?.last_error ? (
        <p className="auth-message auth-message-error" role="alert">
          {status.connection.last_error}
        </p>
      ) : null}

      <div style={{ marginTop: 16 }}>
        <h4 style={{ marginBottom: 6 }}>What syncs today</h4>
        <ul className="muted" style={{ margin: 0, paddingLeft: 18 }}>
          <li>Customers → QuickBooks customers (one-way export)</li>
          <li>Invoices → QuickBooks invoices (one-way export)</li>
          <li>Payments → not synced yet</li>
          <li>Business expenses → not synced yet (enter manually in EverittOS)</li>
        </ul>
        <p className="muted" style={{ marginTop: 8 }}>
          EverittOS remains your operations workspace. QuickBooks stays your accounting system. Manual EverittOS expenses
          and QuickBooks expenses are tracked separately to avoid double counting.
        </p>
      </div>

      {recentLogs.length ? (
        <div style={{ marginTop: 16 }}>
          <h4 style={{ marginBottom: 6 }}>Recent sync activity</h4>
          <ul style={{ margin: 0, paddingLeft: 18 }}>
            {recentLogs.map((log, index) => (
              <li key={log.id || `${log.created_at}-${index}`} className="muted">
                {(log.created_at || '').slice(0, 16).replace('T', ' ')} · {log.entity_type || 'item'} ·{' '}
                {log.action || 'sync'} · <strong>{log.status || 'unknown'}</strong>
                {log.error_message ? ` — ${log.error_message}` : ''}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
