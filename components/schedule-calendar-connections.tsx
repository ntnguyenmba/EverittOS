'use client';

import { useCallback, useEffect, useState } from 'react';
import { CalendarImportPanel } from '@/components/calendar-import-panel';
import { useAppFeedback } from '@/components/feedback/use-app-feedback';
import { useTranslation } from '@/components/locale-provider';
import { canManageOrganizationSettings, type UserRole } from '@/lib/roles';

const copy = {
  en: {
    section: 'Add all jobs to calendar', checking: 'Checking calendar status…', googleTitle: 'Google Calendar',
    connected: 'Connected', connectedAs: 'Connected as {email}. Organization jobs can be synced to this Google Calendar.',
    connectedNoEmail: 'Connected. Organization jobs can be synced to this Google Calendar.', connectHelp: 'Connect Google Calendar to add all organization jobs at once.',
    lastSync: 'Last sync', connect: 'Connect Google Calendar', syncNow: 'Sync all organization jobs', disconnect: 'Disconnect', refresh: 'Refresh status', working: 'Working…',
    subscriptionTitle: 'My job calendar', subscriptionHelp: 'Add every job available in your EverittOS view to Apple Calendar, Outlook, Google Calendar, or another calendar app. New and updated jobs stay in sync automatically.',
    addSubscription: 'Add all my jobs to calendar', openSubscription: 'Open my job calendar', syncFailed: 'Google Calendar sync failed.', disconnectFailed: 'Could not disconnect Google Calendar.',
    feedConnectFailed: 'Could not create your job calendar.', feedOpenFailed: 'Your job calendar could not be opened.', feedDisconnectFailed: 'Could not disconnect your job calendar.',
    synced: 'Synced {count} job(s){failed}.', importSection: 'Calendar Import'
  },
  es: {
    section: 'Añadir todos los trabajos al calendario', checking: 'Comprobando el estado del calendario…', googleTitle: 'Google Calendar',
    connected: 'Conectado', connectedAs: 'Conectado como {email}. Los trabajos de la organización se pueden sincronizar con este calendario.',
    connectedNoEmail: 'Conectado. Los trabajos de la organización se pueden sincronizar con este calendario.', connectHelp: 'Conecta Google Calendar para añadir todos los trabajos de la organización a la vez.',
    lastSync: 'Última sincronización', connect: 'Conectar Google Calendar', syncNow: 'Sincronizar todos los trabajos', disconnect: 'Desconectar', refresh: 'Actualizar estado', working: 'Procesando…',
    subscriptionTitle: 'Mi calendario de trabajos', subscriptionHelp: 'Añade todos los trabajos disponibles en tu vista de EverittOS a Apple Calendar, Outlook, Google Calendar u otra aplicación. Los trabajos nuevos y actualizados se mantienen sincronizados.',
    addSubscription: 'Añadir todos mis trabajos al calendario', openSubscription: 'Abrir mi calendario de trabajos', syncFailed: 'No se pudo sincronizar Google Calendar.', disconnectFailed: 'No se pudo desconectar Google Calendar.',
    feedConnectFailed: 'No se pudo crear tu calendario de trabajos.', feedOpenFailed: 'No se pudo abrir tu calendario de trabajos.', feedDisconnectFailed: 'No se pudo desconectar tu calendario de trabajos.',
    synced: 'Se sincronizaron {count} trabajo(s){failed}.', importSection: 'Importar calendario'
  },
  vi: {
    section: 'Thêm tất cả công việc vào lịch', checking: 'Đang kiểm tra trạng thái lịch…', googleTitle: 'Google Calendar',
    connected: 'Đã kết nối', connectedAs: 'Đã kết nối bằng {email}. Có thể đồng bộ toàn bộ công việc của tổ chức vào lịch này.',
    connectedNoEmail: 'Đã kết nối. Có thể đồng bộ toàn bộ công việc của tổ chức vào lịch này.', connectHelp: 'Kết nối Google Calendar để thêm toàn bộ công việc của tổ chức cùng lúc.',
    lastSync: 'Lần đồng bộ gần nhất', connect: 'Kết nối Google Calendar', syncNow: 'Đồng bộ tất cả công việc', disconnect: 'Ngắt kết nối', refresh: 'Làm mới trạng thái', working: 'Đang xử lý…',
    subscriptionTitle: 'Lịch công việc của tôi', subscriptionHelp: 'Thêm mọi công việc có trong chế độ xem EverittOS của bạn vào Apple Calendar, Outlook, Google Calendar hoặc ứng dụng lịch khác. Công việc mới và thay đổi sẽ tự động được đồng bộ.',
    addSubscription: 'Thêm tất cả công việc của tôi vào lịch', openSubscription: 'Mở lịch công việc của tôi', syncFailed: 'Đồng bộ Google Calendar không thành công.', disconnectFailed: 'Không thể ngắt kết nối Google Calendar.',
    feedConnectFailed: 'Không thể tạo lịch công việc của bạn.', feedOpenFailed: 'Không thể mở lịch công việc của bạn.', feedDisconnectFailed: 'Không thể ngắt kết nối lịch công việc của bạn.',
    synced: 'Đã đồng bộ {count} công việc{failed}.', importSection: 'Nhập lịch'
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
  const canManageCalendarImport = role === 'owner';
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
    <>
      <details style={{ marginTop: 24 }} open>
        <summary><strong>{text.section}</strong></summary>
        <div className="card" style={{ marginTop: 12 }}>
          {loading ? <p className="muted">{text.checking}</p> : null}
          {canManageGoogle ? (
            <>
              <h3 style={{ marginTop: 0 }}>{text.googleTitle}</h3>
              <p className="muted">{status?.connected ? connectedMessage : status?.setupMessage || text.connectHelp}</p>
              {status?.lastSyncAt ? <p className="muted">{text.lastSync}: {new Date(status.lastSyncAt).toLocaleString(locale)}</p> : null}
              {status?.lastError ? <p className="auth-message auth-message-error" role="alert">{status.lastError}</p> : null}
              <div className="inline-actions" style={{ flexWrap: 'wrap', gap: 8 }}>
                {!status?.connected ? <a className="btn btn-primary" href="/api/integrations/google-calendar/connect">{text.connect}</a> : null}
                {status?.connected ? <>
                  <button type="button" className="btn btn-primary" disabled={busy} onClick={() => void syncNow()}>{activeAction === 'google-sync' ? text.working : text.syncNow}</button>
                  <button type="button" className="btn" disabled={busy} onClick={() => void disconnect()}>{activeAction === 'google-disconnect' ? text.working : text.disconnect}</button>
                </> : null}
                <button type="button" className="btn" disabled={loading || busy} onClick={() => void load()}>{text.refresh}</button>
              </div>
            </>
          ) : null}

          <h3 style={{ marginTop: canManageGoogle ? 24 : 0 }}>{text.subscriptionTitle}</h3>
          <p className="muted">{text.subscriptionHelp}</p>
          <div className="inline-actions" style={{ flexWrap: 'wrap', gap: 8 }}>
            <button type="button" className="btn btn-primary" disabled={busy} onClick={() => void openCalendarSubscription()}>
              {activeAction === 'feed-sync' ? text.working : feed ? text.openSubscription : text.addSubscription}
            </button>
            {feed ? <button type="button" className="btn" disabled={busy} onClick={() => void disconnectCalendarSubscription()}>{activeAction === 'feed-disconnect' ? text.working : text.disconnect}</button> : null}
            {!canManageGoogle ? <button type="button" className="btn" disabled={loading || busy} onClick={() => void load()}>{text.refresh}</button> : null}
          </div>
        </div>
      </details>

      {canManageCalendarImport ? (
        <details style={{ marginTop: 18 }} open>
          <summary><strong>{text.importSection}</strong></summary>
          <div className="card" style={{ marginTop: 12 }}>
            <CalendarImportPanel mode="manage" />
          </div>
        </details>
      ) : null}
    </>
  );
}
