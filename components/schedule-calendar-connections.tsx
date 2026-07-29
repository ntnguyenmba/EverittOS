'use client';

import { useCallback, useEffect, useState } from 'react';
import { useAppFeedback } from '@/components/feedback/use-app-feedback';
import { useTranslation } from '@/components/locale-provider';
import { canManageOrganizationSettings, type UserRole } from '@/lib/roles';

const copy = {
  en: {
    section: 'Calendar connections', checking: 'Checking calendar status…', googleTitle: 'Google Calendar connection',
    connected: 'Connected', connectedAs: 'Connected as {email}. Jobs sync to your organization calendar.',
    connectedNoEmail: 'Connected. Jobs sync to your organization calendar.', connectHelp: 'Connect Google Calendar to sync EverittOS jobs directly.',
    lastSync: 'Last sync', connect: 'Connect Google Calendar', syncNow: 'Sync now', disconnect: 'Disconnect', refresh: 'Refresh status', working: 'Working…',
    subscriptionTitle: 'Apple Calendar, Outlook, and calendar apps', subscriptionHelp: 'Add your authorized EverittOS jobs directly. This subscription works independently and does not require Google Calendar.',
    addSubscription: 'Add calendar subscription', openSubscription: 'Open calendar subscription', syncFailed: 'Google Calendar sync failed.', disconnectFailed: 'Could not disconnect Google Calendar.',
    feedConnectFailed: 'Could not create calendar subscription.', feedOpenFailed: 'Calendar subscription could not be opened.', feedDisconnectFailed: 'Could not disconnect calendar subscription.',
    synced: 'Synced {count} job(s){failed}.'
  },
  es: {
    section: 'Conexiones de calendario', checking: 'Comprobando el estado del calendario…', googleTitle: 'Conexión con Google Calendar',
    connected: 'Conectado', connectedAs: 'Conectado como {email}. Los trabajos se sincronizan con el calendario de tu organización.',
    connectedNoEmail: 'Conectado. Los trabajos se sincronizan con el calendario de tu organización.', connectHelp: 'Conecta Google Calendar para sincronizar directamente los trabajos de EverittOS.',
    lastSync: 'Última sincronización', connect: 'Conectar Google Calendar', syncNow: 'Sincronizar ahora', disconnect: 'Desconectar', refresh: 'Actualizar estado', working: 'Procesando…',
    subscriptionTitle: 'Apple Calendar, Outlook y otras aplicaciones', subscriptionHelp: 'Añade directamente tus trabajos autorizados de EverittOS. Esta suscripción funciona de forma independiente y no requiere Google Calendar.',
    addSubscription: 'Añadir suscripción de calendario', openSubscription: 'Abrir suscripción de calendario', syncFailed: 'No se pudo sincronizar Google Calendar.', disconnectFailed: 'No se pudo desconectar Google Calendar.',
    feedConnectFailed: 'No se pudo crear la suscripción al calendario.', feedOpenFailed: 'No se pudo abrir la suscripción al calendario.', feedDisconnectFailed: 'No se pudo desconectar la suscripción al calendario.',
    synced: 'Se sincronizaron {count} trabajo(s){failed}.'
  },
  vi: {
    section: 'Kết nối lịch', checking: 'Đang kiểm tra trạng thái lịch…', googleTitle: 'Kết nối Google Calendar',
    connected: 'Đã kết nối', connectedAs: 'Đã kết nối bằng {email}. Công việc được đồng bộ với lịch của tổ chức.',
    connectedNoEmail: 'Đã kết nối. Công việc được đồng bộ với lịch của tổ chức.', connectHelp: 'Kết nối Google Calendar để đồng bộ trực tiếp công việc EverittOS.',
    lastSync: 'Lần đồng bộ gần nhất', connect: 'Kết nối Google Calendar', syncNow: 'Đồng bộ ngay', disconnect: 'Ngắt kết nối', refresh: 'Làm mới trạng thái', working: 'Đang xử lý…',
    subscriptionTitle: 'Apple Calendar, Outlook và ứng dụng lịch', subscriptionHelp: 'Thêm trực tiếp các công việc EverittOS được phép. Đăng ký này hoạt động độc lập và không cần Google Calendar.',
    addSubscription: 'Thêm đăng ký lịch', openSubscription: 'Mở đăng ký lịch', syncFailed: 'Đồng bộ Google Calendar không thành công.', disconnectFailed: 'Không thể ngắt kết nối Google Calendar.',
    feedConnectFailed: 'Không thể tạo đăng ký lịch.', feedOpenFailed: 'Không thể mở đăng ký lịch.', feedDisconnectFailed: 'Không thể ngắt kết nối đăng ký lịch.',
    synced: 'Đã đồng bộ {count} công việc{failed}.'
  }
} as const;

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

type CalendarAction = 'google-sync' | 'google-disconnect' | 'feed-sync' | 'feed-disconnect' | null;

export function ScheduleCalendarConnections({ role }: { role: UserRole }) {
  const appFeedback = useAppFeedback();
  const { locale } = useTranslation();
  const text = copy[locale];
  const canManageGoogle = canManageOrganizationSettings(role);
  const [status, setStatus] = useState<CalendarStatus | null>(null);
  const [feed, setFeed] = useState<FeedInfo>(null);
  const [activeAction, setActiveAction] = useState<CalendarAction>(null);
  const [loading, setLoading] = useState(true);
  const busy = activeAction !== null;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [statusResult, feedResult] = await Promise.allSettled([
        fetch('/api/integrations/google-calendar/status', { cache: 'no-store' }),
        fetch('/api/calendar/feed', { cache: 'no-store' })
      ]);

      if (statusResult.status === 'fulfilled') {
        const statusJson = await statusResult.value.json().catch(() => ({}));
        if (statusResult.value.ok) {
          setStatus({
            configured: Boolean(statusJson.configured), connected: Boolean(statusJson.connected),
            healthLabel: statusJson.healthLabel || statusJson.health || 'Unknown', canManage: Boolean(statusJson.canManage),
            googleEmail: statusJson.googleEmail || null, lastSyncAt: statusJson.lastSyncAt || statusJson.last_sync_at || null,
            lastError: statusJson.lastError || statusJson.last_sync_error || null, setupMessage: statusJson.setupMessage || null
          });
        }
      }

      if (feedResult.status === 'fulfilled') {
        const feedJson = await feedResult.value.json().catch(() => ({}));
        if (feedResult.value.ok) setFeed(feedJson.feed || null);
      }
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { void load(); }, [load]);

  async function syncNow() {
    if (busy) return;
    setActiveAction('google-sync');
    try {
      const res = await fetch('/api/integrations/google-calendar/sync', { method: 'POST' });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) { appFeedback.error(json.error || text.syncFailed); return; }
      const failed = json.failed ? ` (${json.failed} ${locale === 'vi' ? 'không thành công' : locale === 'es' ? 'fallidos' : 'failed'})` : '';
      appFeedback.success(text.synced.replace('{count}', String(json.synced ?? 0)).replace('{failed}', failed));
      await load();
    } finally { setActiveAction(null); }
  }

  async function disconnect() {
    if (busy) return;
    setActiveAction('google-disconnect');
    try {
      const res = await fetch('/api/integrations/google-calendar/disconnect', { method: 'POST' });
      if (!res.ok) { const json = await res.json().catch(() => ({})); appFeedback.error(json.error || text.disconnectFailed); return; }
      appFeedback.disconnected();
      await load();
    } finally { setActiveAction(null); }
  }

  async function openCalendarSubscription() {
    if (busy) return;
    if (feed?.webcalUrl) { window.location.assign(feed.webcalUrl); return; }
    setActiveAction('feed-sync');
    try {
      const res = await fetch('/api/calendar/feed', { method: 'POST' });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) { appFeedback.error(json.error || text.feedConnectFailed); return; }
      const nextFeed = json.feed || null;
      setFeed(nextFeed);
      if (nextFeed?.webcalUrl) window.location.assign(nextFeed.webcalUrl);
      else appFeedback.error(text.feedOpenFailed);
    } finally { setActiveAction(null); }
  }

  async function disconnectCalendarSubscription() {
    if (busy || !feed) return;
    setActiveAction('feed-disconnect');
    try {
      const res = await fetch('/api/calendar/feed', { method: 'DELETE' });
      if (!res.ok) { const json = await res.json().catch(() => ({})); appFeedback.error(json.error || text.feedDisconnectFailed); return; }
      setFeed(null);
      appFeedback.disconnected();
    } finally { setActiveAction(null); }
  }

  const connectedMessage = status?.googleEmail
    ? text.connectedAs.replace('{email}', status.googleEmail)
    : text.connectedNoEmail;

  return (
    <details style={{ marginTop: 24 }} open>
      <summary><strong>{text.section}</strong></summary>
      <div className="card" style={{ marginTop: 12 }}>
        {loading ? <p className="muted">{text.checking}</p> : null}
        <h3 style={{ marginTop: 0 }}>{text.googleTitle}</h3>
        <p className="muted">{status?.connected ? connectedMessage : status?.setupMessage || text.connectHelp}</p>
        {status?.lastSyncAt ? <p className="muted">{text.lastSync}: {new Date(status.lastSyncAt).toLocaleString(locale)}</p> : null}
        {status?.lastError ? <p className="auth-message auth-message-error" role="alert">{status.lastError}</p> : null}
        <div className="inline-actions" style={{ flexWrap: 'wrap', gap: 8 }}>
          {canManageGoogle && !status?.connected ? <a className="btn btn-primary" href="/api/integrations/google-calendar/connect">{text.connect}</a> : null}
          {canManageGoogle && status?.connected ? <>
            <button type="button" className="btn" disabled={busy} onClick={() => void syncNow()}>{activeAction === 'google-sync' ? text.working : text.syncNow}</button>
            <button type="button" className="btn" disabled={busy} onClick={() => void disconnect()}>{activeAction === 'google-disconnect' ? text.working : text.disconnect}</button>
          </> : null}
          <button type="button" className="btn" disabled={loading || busy} onClick={() => void load()}>{text.refresh}</button>
        </div>
        <h3 style={{ marginTop: 24 }}>{text.subscriptionTitle}</h3>
        <p className="muted">{text.subscriptionHelp}</p>
        <div className="inline-actions" style={{ flexWrap: 'wrap', gap: 8 }}>
          <button type="button" className="btn btn-primary" disabled={busy} onClick={() => void openCalendarSubscription()}>
            {activeAction === 'feed-sync' ? text.working : feed ? text.openSubscription : text.addSubscription}
          </button>
          {feed ? <button type="button" className="btn" disabled={busy} onClick={() => void disconnectCalendarSubscription()}>{activeAction === 'feed-disconnect' ? text.working : text.disconnect}</button> : null}
        </div>
      </div>
    </details>
  );
}
