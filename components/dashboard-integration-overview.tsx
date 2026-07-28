'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

type AttentionItem = {
  id: string;
  message: string;
  href: string;
};

async function readPayload(url: string): Promise<Record<string, unknown> | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 7000);
  try {
    const response = await fetch(url, {
      cache: 'no-store',
      credentials: 'same-origin',
      headers: { 'Cache-Control': 'no-cache', Pragma: 'no-cache' },
      signal: controller.signal
    });
    if (!response.ok) return null;
    return (await response.json().catch(() => null)) as Record<string, unknown> | null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

type DashboardIntegrationOverviewProps = {
  /** When true, hide healthy connections and only surface problems. */
  attentionOnly?: boolean;
};

export function DashboardIntegrationOverview({ attentionOnly = true }: DashboardIntegrationOverviewProps) {
  const [items, setItems] = useState<AttentionItem[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let active = true;

    async function load() {
      const [googlePayload, quickBooksPayload] = await Promise.all([
        readPayload('/api/integrations/google-calendar/status'),
        readPayload('/api/integrations/quickbooks/status')
      ]);

      if (!active) return;

      const next: AttentionItem[] = [];

      if (googlePayload) {
        const connected = Boolean(googlePayload.connected);
        const health = typeof googlePayload.health === 'string' ? googlePayload.health : '';
        const needsAttention =
          connected &&
          (health === 'reconnect_required' ||
            health === 'token_expired' ||
            Boolean(googlePayload.lastSyncError));
        if (needsAttention) {
          next.push({
            id: 'google',
            message: 'Google Calendar needs attention',
            href: '/settings/integrations'
          });
        }
      }

      if (quickBooksPayload) {
        const connection = (quickBooksPayload.connection || {}) as Record<string, unknown>;
        const status = String(connection.status || '');
        const needsReconnect = Boolean(
          quickBooksPayload.needsReconnect || connection.needsReconnect || connection.last_error
        );
        if (status === 'error' || needsReconnect) {
          next.push({
            id: 'quickbooks',
            message: status === 'disconnected' || needsReconnect ? 'QuickBooks disconnected' : 'QuickBooks needs attention',
            href: '/settings/integrations'
          });
        } else if (status === 'disconnected') {
          next.push({
            id: 'quickbooks',
            message: 'QuickBooks disconnected',
            href: '/settings/integrations'
          });
        }
      }

      setItems(next);
      setLoaded(true);
    }

    void load();
    return () => {
      active = false;
    };
  }, []);

  if (!loaded) return null;
  if (attentionOnly && items.length === 0) return null;

  return (
    <section aria-label="Needs attention" style={{ minHeight: 0 }}>
      <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gap: 8 }}>
        {items.map((item) => (
          <li key={item.id}>
            <Link
              href={item.href}
              className="dashboard-today-row"
              style={{
                display: 'block',
                padding: '12px 14px',
                borderRadius: 12,
                background: '#fff7ed',
                color: '#9a3412',
                textDecoration: 'none',
                fontWeight: 650
              }}
            >
              {item.message}
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
