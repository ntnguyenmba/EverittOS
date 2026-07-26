'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

type IntegrationState = {
  label: string;
  detail: string;
  connected: boolean;
  attention: boolean;
};

const initialState: IntegrationState = {
  label: 'Checking...',
  detail: 'Loading connection status',
  connected: false,
  attention: false
};

async function readPayload(url: string): Promise<Record<string, unknown>> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 7000);
  try {
    const response = await fetch(url, {
      cache: 'no-store',
      credentials: 'same-origin',
      headers: { 'Cache-Control': 'no-cache', Pragma: 'no-cache' },
      signal: controller.signal
    });
    const payload = (await response.json().catch(() => ({}))) as Record<string, unknown>;
    if (!response.ok) throw new Error(typeof payload.error === 'string' ? payload.error : 'Status unavailable');
    return payload;
  } finally {
    clearTimeout(timer);
  }
}

function IntegrationCard({ name, state, href }: { name: string; state: IntegrationState; href: string }) {
  const tone = state.attention ? '#9a3412' : state.connected ? '#166534' : '#526777';
  const background = state.attention ? '#fff7ed' : state.connected ? '#f0fdf4' : '#f5f8fa';

  return (
    <Link
      href={href}
      className="card"
      style={{
        minHeight: 150,
        padding: 18,
        textDecoration: 'none',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        gap: 14,
        borderColor: state.attention ? '#fdba74' : undefined
      }}
    >
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'flex-start' }}>
          <h3 style={{ margin: 0 }}>{name}</h3>
          <span
            style={{
              padding: '5px 9px',
              borderRadius: 999,
              background,
              color: tone,
              fontSize: 12,
              fontWeight: 750,
              whiteSpace: 'nowrap'
            }}
          >
            {state.label}
          </span>
        </div>
        <p className="muted" style={{ margin: '10px 0 0' }}>{state.detail}</p>
      </div>
      <span style={{ color: 'var(--accent, #274c63)', fontWeight: 700 }}>Manage integration →</span>
    </Link>
  );
}

export function DashboardIntegrationOverview() {
  const [google, setGoogle] = useState<IntegrationState>(initialState);
  const [quickBooks, setQuickBooks] = useState<IntegrationState>(initialState);

  useEffect(() => {
    let active = true;

    async function load() {
      const [googleResult, quickBooksResult] = await Promise.allSettled([
        readPayload('/api/integrations/google-calendar/status'),
        readPayload('/api/integrations/quickbooks/status')
      ]);

      if (!active) return;

      if (googleResult.status === 'fulfilled') {
        const payload = googleResult.value;
        const connected = Boolean(payload.connected);
        const health = typeof payload.health === 'string' ? payload.health : '';
        const attention = health === 'reconnect_required' || health === 'token_expired' || Boolean(payload.lastSyncError);
        const email = typeof payload.googleEmail === 'string' ? payload.googleEmail : null;
        const lastSync = typeof payload.lastSyncAt === 'string' ? new Date(payload.lastSyncAt).toLocaleString() : null;
        setGoogle({
          connected,
          attention,
          label: attention ? 'Needs attention' : connected ? 'Connected' : 'Not connected',
          detail: attention
            ? 'Reconnect or review the latest sync error.'
            : connected
              ? `${email || 'Google Calendar'}${lastSync ? ` · Last sync ${lastSync}` : ''}`
              : 'Send scheduled EverittOS jobs to Google Calendar.'
        });
      } else {
        setGoogle({ label: 'Unavailable', detail: 'Could not load Google Calendar status.', connected: false, attention: true });
      }

      if (quickBooksResult.status === 'fulfilled') {
        const payload = quickBooksResult.value;
        const connection = (payload.connection || {}) as Record<string, unknown>;
        const connected = connection.status === 'connected';
        const attention = Boolean(payload.needsReconnect || connection.needsReconnect || connection.status === 'error' || connection.last_error);
        const company = typeof connection.company_name === 'string' ? connection.company_name : null;
        const lastSync = typeof connection.last_sync_at === 'string' ? new Date(connection.last_sync_at).toLocaleString() : null;
        setQuickBooks({
          connected,
          attention,
          label: attention ? 'Needs attention' : connected ? 'Connected' : 'Not connected',
          detail: attention
            ? 'Reconnect or review the latest QuickBooks sync error.'
            : connected
              ? `${company || 'QuickBooks'}${lastSync ? ` · Last sync ${lastSync}` : ''}`
              : 'Sync customers, invoices, and payments with QuickBooks.'
        });
      } else {
        setQuickBooks({ label: 'Unavailable', detail: 'Could not load QuickBooks status.', connected: false, attention: true });
      }
    }

    void load();
    return () => {
      active = false;
    };
  }, []);

  return (
    <section aria-label="Integration status" style={{ minHeight: 0 }}>
      <div className="dashboard-section-head">
        <div>
          <h2>Integrations</h2>
          <p className="page-subtitle" style={{ marginBottom: 0 }}>Connection health and the latest sync information.</p>
        </div>
        <Link className="btn btn-sm" href="/settings/integrations">Manage integrations</Link>
      </div>
      <div className="stats-grid" style={{ marginTop: 14 }}>
        <IntegrationCard name="Google Calendar" state={google} href="/settings/integrations" />
        <IntegrationCard name="QuickBooks" state={quickBooks} href="/settings/integrations" />
      </div>
    </section>
  );
}
