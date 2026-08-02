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
const STATUS_RETRY_TIMEOUT_MS = 20000;
const SYNC_POLL_INTERVAL_MS = 4000;

function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === 'AbortError';
}

async function fetchWithTimeout(
  input: RequestInfo | URL,
  init?: RequestInit,
  timeoutMs = REQUEST_TIMEOUT_MS
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
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

async function fetchQuickBooksStatus(): Promise<Response> {
  const url = `/api/integrations/quickbooks/status?t=${Date.now()}`;
  try {
    return await fetchWithTimeout(url);
  } catch (error) {
    if (!isAbortError(error)) throw error;
    return fetchWithTimeout(`/api/integrations/quickbooks/status?t=${Date.now()}`, undefined, STATUS_RETRY_TIMEOUT_MS);
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
  const previousConnectionStatusRef = useRef<string | undefined>(undefined);
  const oauthHandledRef = useRef(false);
  const [status, setStatus] = useState<QuickBooksStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [unauthorized, setUnauthorized] = useState(false);

  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);

  const load = useCallback(async ({ silent = false }: { silent?: boolean } = {}) => {
    if (loadingRef.current) return;
    loadingRef.current = true;
    if (!silent) setLoading(true);
    setLoadError('');
    setUnauthorized(false);

    try {
      const res = await fetchQuickBooksStatus();
      const json = await readJson(res);
      if (!mounted.current) return;

      if (!res.ok) {
        if (res.status === 401) {
          setUnauthorized(true);
          setLoadError('Your session expired. Sign in again to manage QuickBooks.');
        } else {
          setLoadError(typeof json.error === 'string' ? json.error : 'QuickBooks status is temporarily unavailable.');
        }
        if (!silent) setStatus(null);
        return;
      }

      const nextStatus: QuickBooksStatus = {
        configured: Boolean(json.configured),
        canConnect: Boolean(json.canConnect),
        connection: (json.connection || { status: 'disconnected' }) as QuickBooksStatus['connection'],
        recentLogs: Array.isArray(json.recentLogs) ? (json.recentLogs as SyncLog[]) : [],
        needsReconnect: Boolean(json.needsReconnect),
        setupMessage: typeof json.setupMessage === 'string' ? json.setupMessage : null
      };

      const previousConnectionStatus = previousConnectionStatusRef.current;
      const nextConnectionStatus = nextStatus.connection?.status;
      previousConnectionStatusRef.current = nextConnectionStatus;
      setStatus(nextStatus);

      if (previousConnectionStatus === 'syncing' && nextConnectionStatus === 'connected') {
        if (nextStatus.connection?.last_error) {
          appFeedback.error(nextStatus.connection.last_error);
        } else {
          appFeedback.success('QuickBooks sync completed.');
        }
      } else if (previousConnectionStatus === 'syncing' && nextConnectionStatus === 'error') {
        appFeedback.error(nextStatus.connection?.last_error || 'QuickBooks authorization expired. Reconnect QuickBooks.');
      }
    } catch (error) {
      if (!mounted.current) return;
      setLoadError(isAbortError(error) ? 'QuickBooks is still taking too long to respond. Refresh status in a moment.' : 'QuickBooks status is temporarily unavailable.');
      if (!silent) setStatus(null);
    } finally {
      loadingRef.current = false;
      if (mounted.current && !silent) setLoading(false);
    }
  }, [appFeedback]);

  useEffect(() => { void load(); }, [load]);

  useEffect(() => {
    if (status?.connection?.status !== 'syncing') return;
    const timer = window.setInterval(() => {
      void load({ silent: true });
    }, SYNC_POLL_INTERVAL_MS);
    return () => window.clearInterval(timer);
  }, [status?.connection?.status, load]);

  useEffect(() => {
    if (oauthHandledRef.current) return;
    const qb = searchParams.get('quickbooks');
    if (!qb) return;
    oauthHandledRef.current = true;
    if (qb === 'connected') {
      appFeedback.connected();
      window.setTimeout(() => void load(), 500);
    } else if (qb === 'error') {
      appFeedback.error('QuickBooks could not be connected. Please try again.');
    }
    window.history.replaceState({}, '', '/settings#integrations');
  }, [searchParams, appFeedback, load]);

  async function disconnect() {
    if (busy || status?.connection?.status === 'syncing') return;
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
      appFeedback.error(isAbortError(error) ? 'QuickBooks took too long to respond. Try again.' : 'QuickBooks could not be disconnected. Please try again.');
    } finally {
      setBusy(false);
    }
  }

  async function syncNow() {
    if (busy || status?.connection?.status === 'syncing') return;
    setBusy(true);
    try {
      const res = await fetchWithTimeout('/api/integrations/quickbooks/sync-now', { method: 'POST' });
      const json = await readJson(res);
      if (!res.ok) {
        const reconnectRequired = json.status === 'reconnect_required';
        const message = typeof json.error === 'string' ? json.error : 'QuickBooks sync could not be started.';
        appFeedback.error(message);
        if (reconnectRequired) {
          setStatus((current) => current ? {
            ...current,
            needsReconnect: true,
            connection: {
              ...current.connection,
              status: 'error',
              needsReconnect: true,
              last_error: message
            }
          } : current);
        } else {
          await load();
        }
        return;
      }

      previousConnectionStatusRef.current = 'syncing';
      setStatus((current) => current ? {
        ...current,
        connection: {
          ...current.connection,
          status: 'syncing',
          last_error: null,
          needsReconnect: false
        },
        needsReconnect: false
      } : current);
    } catch (error) {
      if (!isAbortError(error)) {
        appFeedback.error('QuickBooks sync could not be started.');
      }
    } finally {
      setBusy(false);
    }
  }

  const connectionStatus = status?.connection?.status;
  const syncing = connectionStatus === 'syncing';
  const connected = connectionStatus === 'connected' || syncing;
  const needsReconnect = connectionStatus === 'error' || Boolean(status?.needsReconnect || status?.connection?.needsReconnect);
  const configured = Boolean(status?.configured);
  const statusText = loading
    ? 'Checking...'
    : unauthorized
      ? 'Sign in required'
      : loadError
        ? 'Failed'
        : syncing
          ? 'Syncing QuickBooks...'
          : connected
            ? 'Connected'
            : needsReconnect
              ? 'Reconnect required'
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
      {!status && !loading && !loadError ? <p className="muted">Connect QuickBooks to exchange supported accounting data.</p> : null}
      <p style={{ marginBottom: 10 }}>{t('pages.quickbooks.statusLabel')}: <strong>{statusText}</strong></p>
      {syncing ? <p className="muted" role="status">Your sync is running. You can leave this page while it finishes.</p> : null}
      {loadError ? <p className="auth-message auth-message-error" role="alert">{loadError}</p> : null}
      {status?.setupMessage && !connected ? <p className="muted">{status.setupMessage}</p> : null}
      {needsReconnect && !loadError ? <p className="muted">Reconnect QuickBooks to resume syncing.</p> : null}

      <div className="settings-actions" style={{ marginTop: 12 }}>
        {unauthorized ? <a className="btn btn-primary" href="/login?next=/settings">Sign in again</a> : showConnect ? <a className="btn btn-primary" href="/api/integrations/quickbooks/connect">{needsReconnect ? t('pages.quickbooks.reconnect') : t('pages.quickbooks.connect')}</a> : null}
        <button type="button" className="btn" disabled={loading || busy} onClick={() => void load()}>{loading ? 'Checking...' : 'Refresh status'}</button>
        {canManage && connected ? <button type="button" className="btn" disabled={busy || loading || syncing} onClick={() => void syncNow()}>{syncing ? 'Syncing…' : 'Sync now'}</button> : null}
        {canManage && (connected || needsReconnect) ? <button type="button" className="btn" disabled={busy || loading || syncing} onClick={() => void disconnect()}>{busy ? 'Disconnecting...' : t('pages.quickbooks.disconnect')}</button> : null}
      </div>

      {status?.connection?.company_name ? <p className="muted" style={{ marginTop: 12 }}>{connected ? 'Connected company' : 'Saved company'}: <strong>{status.connection.company_name}</strong>{realmMasked ? ` · Realm ${realmMasked}` : ''}</p> : null}
      {status?.connection?.last_sync_at ? <p className="muted">Last sync {formatRelativeTime(status.connection.last_sync_at)}.</p> : connected && !syncing ? <p className="muted">No successful sync recorded yet.</p> : null}
      {status?.connection?.last_error && !syncing ? <p className="auth-message auth-message-error" role="alert">{status.connection.last_error}</p> : null}

      <div style={{ marginTop: 16 }}>
        <h4 style={{ marginBottom: 6 }}>Current sync</h4>
        <ul className="muted" style={{ margin: 0, paddingLeft: 18 }}>
          <li>Customers and invoices export to QuickBooks.</li>
          <li>Posted QuickBooks purchases and bills import as EverittOS expenses.</li>
          <li>Payments reconcile exported EverittOS invoices.</li>
        </ul>
        <p className="muted" style={{ marginTop: 8 }}>QuickBooks remains the accounting system. EverittOS remains the operations workspace.</p>
      </div>

      {recentLogs.length ? (
        <details style={{ marginTop: 16 }}>
          <summary><strong>Recent sync activity</strong></summary>
          <ul style={{ margin: '8px 0 0', paddingLeft: 18 }}>
            {recentLogs.map((log, index) => (
              <li key={log.id || `${log.created_at}-${index}`} className="muted">
                {(log.created_at || '').slice(0, 16).replace('T', ' ')} · {log.entity_type || 'item'} · {log.action || 'sync'} · <strong>{log.status || 'unknown'}</strong>{log.error_message ? ` — ${log.error_message}` : ''}
              </li>
            ))}
          </ul>
        </details>
      ) : null}
    </div>
  );
}
