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
    if (!response.ok) throw new Error('Status unavailable');
    return payload;
  } finally {
    clearTimeout(timer);
  }
}

function formatRecentTime(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;

  const elapsed = Date.now() - date.getTime();
  const minutes = Math.max(0, Math.floor(elapsed / 60000));
  if (minutes < 2) return 'just now';
  if (minutes < 60) return `${minutes} minutes ago`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} ${hours === 1 ? 'hour' : 'hours'} ago`;

  const days = Math.floor(hours / 24);
  if (days === 1) return 'yesterday';
  if (days < 7) return `${days} days ago`;

  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
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
        const lastSync = formatRecentTime(payload.lastSyncAt);
        setGoogle({
          connected,
          attention,
          label: attention ? 'Needs attention' : connected ? 'Connected' : 'Not connected',
          detail: attention
            ? 'Reconnect Google Calendar to resume automatic updates.'
            : connected
              ? lastSync ? `Last synced ${lastSync}.` : 'Scheduled jobs are connected to Google Calendar.'
              : 'Connect Google Calendar to keep scheduled jobs updated automatically.'
        });
      } else {
        setGoogle({ label: 'Unavailable', detail: 'Google Calendar status is temporarily unavailable.', connected: false, attention: true });
      }

      if (quickBooksResult.status === 'fulfilled') {
        const payload = quickBooksResult.value;
        const connection = (payload.connection || {}) as Record<string, unknown>;
        const connected = connection.status === 'connected';
        const attention = Boolean(payload.needsReconnect || connection.needsReconnect || connection.status === 'error' || connection.last_error);
        const lastSync = formatRecentTime(connection.last_sync_at);
        setQuickBooks({
          connected,
          attention,
          label: attention ? 'Needs attention' : connected ? 'Connected' : 'Not connected',
          detail: attention
            ? 'Reconnect QuickBooks to resume syncing.'
            : connected
              ? lastSync ? `Last synced ${lastSync}.` : 'QuickBooks is connected and ready.'
              : 'Connect QuickBooks to sync eligible customers and invoices.'
        });
      } else {
        setQuickBooks({ label: 'Unavailable', detail: 'QuickBooks status is temporarily unavailable.', connected: false, attention: true });
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
          <p className="page-subtitle" style={{ marginBottom: 0 }}>See which connected tools are working and when they last updated.</p>
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
