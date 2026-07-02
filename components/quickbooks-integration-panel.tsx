'use client';

import { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useAppFeedback } from '@/components/feedback/use-app-feedback';

type QuickBooksStatus = {
  configured: boolean;
  canConnect: boolean;
  connection: { status: string; realm_id?: string | null; last_sync_at?: string | null };
  recentLogs: Array<{ id: string; entity_type: string; action: string; status: string; error_message?: string | null; created_at: string }>;
  setupMessage?: string | null;
};

export function QuickBooksIntegrationPanel({ canManage }: { canManage: boolean }) {
  const searchParams = useSearchParams();
  const appFeedback = useAppFeedback();
  const [status, setStatus] = useState<QuickBooksStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const res = await fetch('/api/integrations/quickbooks/status');
    const json = await res.json();
    setLoading(false);
    if (!res.ok) {
      appFeedback.error(json.error || 'Unable to load QuickBooks status.');
      return;
    }
    setStatus(json);
  }, [appFeedback]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const qb = searchParams.get('quickbooks');
    if (qb === 'connected') appFeedback.connected();
    if (qb === 'error') {
      const reason = searchParams.get('reason') || 'connect_failed';
      appFeedback.error(`QuickBooks connection failed (${reason}).`);
    }
  }, [searchParams, appFeedback]);

  async function disconnect() {
    setBusy(true);
    const res = await fetch('/api/integrations/quickbooks/disconnect', { method: 'POST' });
    const json = await res.json();
    setBusy(false);
    if (!res.ok) {
      appFeedback.error(json.error || 'Unable to disconnect QuickBooks.');
      return;
    }
    appFeedback.disconnected();
    void load();
  }

  if (loading) return <p className="muted">Loading QuickBooks status…</p>;
  if (!status) return null;

  const connected = status.connection?.status === 'connected';

  return (
    <div>
      <p>
        Status: <strong>{connected ? 'Connected' : status.configured ? 'Not connected' : 'Server not configured'}</strong>
      </p>
      {!status.configured ? <p className="muted">{status.setupMessage}</p> : null}
      {status.connection?.last_sync_at ? (
        <p className="muted">Last sync: {new Date(status.connection.last_sync_at).toLocaleString()}</p>
      ) : null}

      {canManage && status.configured ? (
        <div className="settings-actions" style={{ marginTop: 12 }}>
          {!connected ? (
            <a className="btn btn-primary" href="/api/integrations/quickbooks/connect">
              Connect QuickBooks
            </a>
          ) : (
            <button type="button" className="btn" disabled={busy} onClick={() => void disconnect()}>
              Disconnect QuickBooks
            </button>
          )}
        </div>
      ) : null}

      {status.recentLogs.length ? (
        <div style={{ marginTop: 16 }}>
          <h4>Recent sync log</h4>
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
          No sync attempts yet.
        </p>
      )}
    </div>
  );
}
