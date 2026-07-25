'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useAppFeedback } from '@/components/feedback/use-app-feedback';
import { useTranslation } from '@/components/locale-provider';

type QuickBooksStatus = {
  configured: boolean;
  canConnect: boolean;
  databaseReady?: boolean;
  connection?: {
    status?: string;
    realm_id?: string | null;
    company_name?: string | null;
    last_sync_at?: string | null;
    last_error?: string | null;
    needsReconnect?: boolean;
  };
  recentLogs?: Array<{
    id: string;
    entity_type: string;
    action: string;
    status: string;
    error_message?: string | null;
    created_at: string;
  }>;
  setupMessage?: string | null;
  warning?: string | null;
  needsReconnect?: boolean;
};

const REQUEST_TIMEOUT_MS = 8000;

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
          setLoadError('Your login session expired. Sign in again, then return here to connect QuickBooks.');
        } else {
          const message = typeof json.error === 'string' ? json.error : t('pages.quickbooks.loadError');
          setLoadError(message);
        }
        setStatus(null);
        return;
      }

      setStatus({
        configured: Boolean(json.configured),
        canConnect: Boolean(json.canConnect),
        databaseReady: json.databaseReady !== false,
        connection: (json.connection || { status: 'disconnected' }) as QuickBooksStatus['connection'],
        recentLogs: Array.isArray(json.recentLogs) ? (json.recentLogs as QuickBooksStatus['recentLogs']) : [],
        setupMessage: typeof json.setupMessage === 'string' ? json.setupMessage : null,
        warning: typeof json.warning === 'string' ? json.warning : null,
        needsReconnect: Boolean(json.needsReconnect)
      });
    } catch (error) {
      if (!mounted.current) return;
      const timedOut = error instanceof DOMException && error.name === 'AbortError';
      setLoadError(timedOut ? 'QuickBooks status timed out. Tap Check status to try again.' : t('pages.quickbooks.loadError'));
      setStatus(null);
    } finally {
      loadingRef.current = false;
      if (mounted.current) setLoading(false);
    }
  }, [t]);

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
      const reason = searchParams.get('reason') || 'connect_failed';
      const detail = searchParams.get('detail');
      appFeedback.error(detail || t('pages.quickbooks.connectFailed', { reason }));
    }
  }, [searchParams, appFeedback, t, load]);

  async function disconnect() {
    if (busy) return;
    setBusy(true);
    try {
      const res = await fetchWithTimeout('/api/integrations/quickbooks/disconnect', { method: 'POST' });
      const json = await readJson(res);
      if (!res.ok) {
        appFeedback.error(typeof json.error === 'string' ? json.error : t('pages.quickbooks.loadError'));
        return;
      }
      appFeedback.disconnected();
      await load();
    } catch (error) {
      const timedOut = error instanceof DOMException && error.name === 'AbortError';
      appFeedback.error(timedOut ? 'QuickBooks disconnect timed out. Please try again.' : t('pages.quickbooks.loadError'));
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
    ? 'Checking status...'
    : unauthorized
      ? 'Sign in required'
      : loadError
        ? 'Status unavailable'
        : connected
          ? t('pages.quickbooks.connected')
          : needsReconnect
            ? t('pages.quickbooks.needsReconnect')
            : configured
              ? t('pages.quickbooks.notConnected')
              : status
                ? t('pages.quickbooks.notConfigured')
                : 'Not checked';
  const recentLogs = status?.recentLogs || [];
  const showConnect = canManage && !connected;

  return (
    <div>
      <p style={{ marginBottom: 10 }}>
        {t('pages.quickbooks.statusLabel')}: <strong>{statusText}</strong>
      </p>

      {loadError ? <p className="auth-message auth-message-error" role="alert">{loadError}</p> : null}
      {status?.setupMessage ? <p className="auth-message auth-message-error" role="alert">{status.setupMessage}</p> : null}

      <div className="settings-actions" style={{ marginTop: 12 }}>
        {unauthorized ? (
          <a className="btn btn-primary" href="/login?next=/settings/integrations">
            Sign in again
          </a>
        ) : showConnect ? (
          <a className="btn btn-primary" href="/api/integrations/quickbooks/connect">
            {needsReconnect ? t('pages.quickbooks.reconnect') : t('pages.quickbooks.connect')}
          </a>
        ) : null}

        <button type="button" className="btn" disabled={loading || busy} onClick={() => void load()}>
          {loading ? 'Checking...' : 'Check status'}
        </button>

        {canManage && (connected || needsReconnect) ? (
          <button type="button" className="btn" disabled={busy || loading} onClick={() => void disconnect()}>
            {busy ? 'Disconnecting...' : t('pages.quickbooks.disconnect')}
          </button>
        ) : null}
      </div>

      {status?.connection?.company_name ? (
        <p className="muted" style={{ marginTop: 12 }}>
          {t('pages.quickbooks.company')}: {status.connection.company_name}
        </p>
      ) : null}
      {status?.connection?.realm_id ? (
        <p className="muted">
          {t('pages.quickbooks.companyId')}: {status.connection.realm_id}
        </p>
      ) : null}
      {status?.connection?.last_sync_at ? (
        <p className="muted">
          {t('pages.quickbooks.lastSync')}: {new Date(status.connection.last_sync_at).toLocaleString()}
        </p>
      ) : null}
      {status?.connection?.last_error ? (
        <p className="auth-message auth-message-error" role="alert">
          {t('pages.quickbooks.lastError')}: {status.connection.last_error}
        </p>
      ) : null}

      {recentLogs.length ? (
        <div style={{ marginTop: 16 }}>
          <h4>{t('pages.quickbooks.recentSyncLog')}</h4>
          <ul>
            {recentLogs.map((log) => (
              <li key={log.id} className="muted">
                {log.action} · {log.entity_type} · {log.status}
                {log.error_message ? ` — ${log.error_message}` : ''}
              </li>
            ))}
          </ul>
        </div>
      ) : status && !loading ? (
        <p className="muted" style={{ marginTop: 12 }}>
          {t('pages.quickbooks.noSyncAttempts')}
        </p>
      ) : null}
    </div>
  );
}
