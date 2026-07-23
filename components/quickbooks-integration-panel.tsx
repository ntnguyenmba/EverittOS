'use client';

import { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useAppFeedback } from '@/components/feedback/use-app-feedback';
import { useTranslation } from '@/components/locale-provider';

type QuickBooksStatus = {
  configured: boolean;
  canConnect: boolean;
  connection: {
    status: string;
    realm_id?: string | null;
    company_name?: string | null;
    last_sync_at?: string | null;
    last_error?: string | null;
    needsReconnect?: boolean;
  };
  recentLogs: Array<{
    id: string;
    entity_type: string;
    action: string;
    status: string;
    error_message?: string | null;
    created_at: string;
  }>;
  setupMessage?: string | null;
  needsReconnect?: boolean;
};

export function QuickBooksIntegrationPanel({ canManage }: { canManage: boolean }) {
  const searchParams = useSearchParams();
  const { t } = useTranslation();
  const appFeedback = useAppFeedback();
  const [status, setStatus] = useState<QuickBooksStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const res = await fetch('/api/integrations/quickbooks/status');
    const json = await res.json();
    setLoading(false);
    if (!res.ok) {
      appFeedback.error(json.error || t('pages.quickbooks.loadError'));
      return;
    }
    setStatus(json);
  }, [appFeedback, t]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const qb = searchParams.get('quickbooks');
    if (qb === 'connected') appFeedback.connected();
    if (qb === 'error') {
      const reason = searchParams.get('reason') || 'connect_failed';
      appFeedback.error(t('pages.quickbooks.connectFailed', { reason }));
    }
  }, [searchParams, appFeedback, t]);

  async function disconnect() {
    setBusy(true);
    const res = await fetch('/api/integrations/quickbooks/disconnect', { method: 'POST' });
    const json = await res.json();
    setBusy(false);
    if (!res.ok) {
      appFeedback.error(json.error || t('pages.quickbooks.loadError'));
      return;
    }
    appFeedback.disconnected();
    void load();
  }

  if (loading) return <p className="muted">{t('pages.quickbooks.loading')}</p>;
  if (!status) return null;

  const connected = status.connection?.status === 'connected';
  const needsReconnect =
    status.needsReconnect || status.connection?.needsReconnect || status.connection?.status === 'error';
  const statusText = connected
    ? t('pages.quickbooks.connected')
    : needsReconnect
      ? t('pages.quickbooks.needsReconnect')
      : status.configured
        ? t('pages.quickbooks.notConnected')
        : t('pages.quickbooks.notConfigured');

  return (
    <div>
      <p>
        {t('pages.quickbooks.statusLabel')}: <strong>{statusText}</strong>
      </p>
      {status.connection?.company_name ? (
        <p className="muted">
          {t('pages.quickbooks.company')}: {status.connection.company_name}
        </p>
      ) : null}
      {status.connection?.realm_id ? (
        <p className="muted">
          {t('pages.quickbooks.companyId')}: {status.connection.realm_id}
        </p>
      ) : null}
      {!status.configured ? <p className="muted">{status.setupMessage}</p> : null}
      {status.connection?.last_sync_at ? (
        <p className="muted">
          {t('pages.quickbooks.lastSync')}: {new Date(status.connection.last_sync_at).toLocaleString()}
        </p>
      ) : null}
      {status.connection?.last_error ? (
        <p className="muted" role="alert">
          {t('pages.quickbooks.lastError')}: {status.connection.last_error}
        </p>
      ) : null}

      {canManage && status.configured ? (
        <div className="settings-actions" style={{ marginTop: 12 }}>
          {!connected || needsReconnect ? (
            <a className="btn btn-primary" href="/api/integrations/quickbooks/connect">
              {needsReconnect ? t('pages.quickbooks.reconnect') : t('pages.quickbooks.connect')}
            </a>
          ) : null}
          {connected || needsReconnect ? (
            <button type="button" className="btn" disabled={busy} onClick={() => void disconnect()}>
              {t('pages.quickbooks.disconnect')}
            </button>
          ) : null}
        </div>
      ) : null}

      {status.recentLogs.length ? (
        <div style={{ marginTop: 16 }}>
          <h4>{t('pages.quickbooks.recentSyncLog')}</h4>
          <ul>
            {status.recentLogs.map((log) => (
              <li key={log.id} className="muted">
                {log.action} · {log.entity_type} · {log.status}
                {log.error_message ? ` — ${log.error_message}` : ''}
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <p className="muted" style={{ marginTop: 12 }}>
          {t('pages.quickbooks.noSyncAttempts')}
        </p>
      )}
    </div>
  );
}
