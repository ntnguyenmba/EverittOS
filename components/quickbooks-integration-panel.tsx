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
    needsReconnect?: boolean;
  };
  recentLogs?: SyncLog[];
  needsReconnect?: boolean;
  setupMessage?: string | null;
};

type Copy = {
  connectHint: string;
  checking: string;
  signInRequired: string;
  failed: string;
  syncing: string;
  synced: string;
  connected: string;
  reconnectRequired: string;
  disconnected: string;
  notConfigured: string;
  notChecked: string;
  running: string;
  resume: string;
  signInAgain: string;
  refresh: string;
  syncNow: string;
  disconnecting: string;
  connectedCompany: string;
  savedCompany: string;
  lastSync: string;
  noSync: string;
  currentSync: string;
  exportLine: string;
  importLine: string;
  reconcileLine: string;
  accountingTitle: string;
  accountingIntro: string;
  sentTitle: string;
  sentItems: string;
  staysTitle: string;
  staysItems: string;
  differenceNote: string;
  recentActivity: string;
  sessionExpired: string;
  statusUnavailable: string;
  slowStatus: string;
  connectError: string;
  disconnectError: string;
  slowDisconnect: string;
  syncError: string;
  syncedToast: string;
  recently: string;
  justNow: string;
  minutesAgo: string;
  hoursAgo: string;
  yesterday: string;
  daysAgo: string;
};

const COPY: Record<'en' | 'es' | 'vi', Copy> = {
  en: {
    connectHint: 'Connect QuickBooks to exchange supported accounting data.',
    checking: 'Checking...', signInRequired: 'Sign in required', failed: 'Failed', syncing: 'Syncing QuickBooks...', synced: 'Synced', connected: 'Connected', reconnectRequired: 'Reconnect required', disconnected: 'Disconnected', notConfigured: 'Not configured', notChecked: 'Not checked',
    running: 'Your sync is running. You can leave this page while it finishes.', resume: 'Reconnect QuickBooks to resume syncing.', signInAgain: 'Sign in again', refresh: 'Refresh status', syncNow: 'Sync now', disconnecting: 'Disconnecting...',
    connectedCompany: 'Connected company', savedCompany: 'Saved company', lastSync: 'Last sync', noSync: 'No successful sync recorded yet.', currentSync: 'Current sync',
    exportLine: 'Customers, invoices, and recorded direct payments export to QuickBooks.', importLine: 'Posted QuickBooks purchases and bills import as EverittOS expenses.', reconcileLine: 'Recorded payments reconcile exported EverittOS invoices.',
    accountingTitle: 'Why the numbers may differ', accountingIntro: 'EverittOS manages operations. QuickBooks records accounting transactions. Their totals will not always match.', sentTitle: 'Sent to QuickBooks', sentItems: 'Customers, invoices, recorded payments, sales receipts, and expenses.', staysTitle: 'Stays in EverittOS', staysItems: 'Scheduled jobs, expected revenue, expected profit, assignments, photos, and operational reports.', differenceNote: 'Expected revenue is not QuickBooks income until it is invoiced or recorded as paid. Collected means payments recorded in EverittOS.',
    recentActivity: 'Recent sync activity', sessionExpired: 'Your session expired. Sign in again to manage QuickBooks.', statusUnavailable: 'QuickBooks status is temporarily unavailable.', slowStatus: 'QuickBooks is taking too long to respond. Refresh status in a moment.', connectError: 'QuickBooks could not be connected. Please try again.', disconnectError: 'QuickBooks could not be disconnected. Please try again.', slowDisconnect: 'QuickBooks took too long to respond. Try again.', syncError: 'QuickBooks sync could not be started.', syncedToast: 'QuickBooks synced.',
    recently: 'recently', justNow: 'just now', minutesAgo: '{count} minutes ago', hoursAgo: '{count} hours ago', yesterday: 'yesterday', daysAgo: '{count} days ago'
  },
  es: {
    connectHint: 'Conecta QuickBooks para intercambiar los datos contables compatibles.',
    checking: 'Comprobando...', signInRequired: 'Se requiere iniciar sesión', failed: 'Falló', syncing: 'Sincronizando QuickBooks...', synced: 'Sincronizado', connected: 'Conectado', reconnectRequired: 'Se requiere reconectar', disconnected: 'Desconectado', notConfigured: 'No configurado', notChecked: 'Sin comprobar',
    running: 'La sincronización está en curso. Puedes salir de esta página mientras termina.', resume: 'Reconecta QuickBooks para continuar la sincronización.', signInAgain: 'Iniciar sesión de nuevo', refresh: 'Actualizar estado', syncNow: 'Sincronizar ahora', disconnecting: 'Desconectando...',
    connectedCompany: 'Empresa conectada', savedCompany: 'Empresa guardada', lastSync: 'Última sincronización', noSync: 'Todavía no hay una sincronización correcta.', currentSync: 'Sincronización actual',
    exportLine: 'Los clientes, las facturas y los pagos directos registrados se exportan a QuickBooks.', importLine: 'Las compras y facturas registradas en QuickBooks se importan como gastos de EverittOS.', reconcileLine: 'Los pagos registrados concilian las facturas de EverittOS exportadas.',
    accountingTitle: 'Por qué los números pueden ser diferentes', accountingIntro: 'EverittOS gestiona las operaciones. QuickBooks registra las transacciones contables. Los totales no siempre coincidirán.', sentTitle: 'Se envía a QuickBooks', sentItems: 'Clientes, facturas, pagos registrados, recibos de venta y gastos.', staysTitle: 'Permanece en EverittOS', staysItems: 'Trabajos programados, ingresos esperados, ganancia esperada, asignaciones, fotos e informes operativos.', differenceNote: 'Los ingresos esperados no son ingresos de QuickBooks hasta que se facturan o se registran como pagados. Cobrado significa pagos registrados en EverittOS.',
    recentActivity: 'Actividad reciente de sincronización', sessionExpired: 'Tu sesión venció. Inicia sesión de nuevo para administrar QuickBooks.', statusUnavailable: 'El estado de QuickBooks no está disponible temporalmente.', slowStatus: 'QuickBooks tarda demasiado en responder. Actualiza el estado en un momento.', connectError: 'No se pudo conectar QuickBooks. Inténtalo de nuevo.', disconnectError: 'No se pudo desconectar QuickBooks. Inténtalo de nuevo.', slowDisconnect: 'QuickBooks tardó demasiado en responder. Inténtalo de nuevo.', syncError: 'No se pudo iniciar la sincronización de QuickBooks.', syncedToast: 'QuickBooks se sincronizó.',
    recently: 'recientemente', justNow: 'ahora mismo', minutesAgo: 'hace {count} minutos', hoursAgo: 'hace {count} horas', yesterday: 'ayer', daysAgo: 'hace {count} días'
  },
  vi: {
    connectHint: 'Kết nối QuickBooks để trao đổi dữ liệu kế toán được hỗ trợ.',
    checking: 'Đang kiểm tra...', signInRequired: 'Cần đăng nhập', failed: 'Thất bại', syncing: 'Đang đồng bộ QuickBooks...', synced: 'Đã đồng bộ', connected: 'Đã kết nối', reconnectRequired: 'Cần kết nối lại', disconnected: 'Đã ngắt kết nối', notConfigured: 'Chưa thiết lập', notChecked: 'Chưa kiểm tra',
    running: 'Đang đồng bộ. Bạn có thể rời trang này trong khi hệ thống hoàn tất.', resume: 'Kết nối lại QuickBooks để tiếp tục đồng bộ.', signInAgain: 'Đăng nhập lại', refresh: 'Làm mới trạng thái', syncNow: 'Đồng bộ ngay', disconnecting: 'Đang ngắt kết nối...',
    connectedCompany: 'Công ty đã kết nối', savedCompany: 'Công ty đã lưu', lastSync: 'Lần đồng bộ cuối', noSync: 'Chưa có lần đồng bộ thành công.', currentSync: 'Dữ liệu đang đồng bộ',
    exportLine: 'Khách hàng, hóa đơn và khoản thanh toán trực tiếp đã ghi nhận được xuất sang QuickBooks.', importLine: 'Các khoản mua hàng và hóa đơn đã ghi trong QuickBooks được nhập thành chi phí EverittOS.', reconcileLine: 'Khoản thanh toán đã ghi nhận được đối chiếu với hóa đơn EverittOS đã xuất.',
    accountingTitle: 'Vì sao các con số có thể khác nhau', accountingIntro: 'EverittOS quản lý hoạt động. QuickBooks ghi nhận giao dịch kế toán. Tổng số không phải lúc nào cũng giống nhau.', sentTitle: 'Gửi sang QuickBooks', sentItems: 'Khách hàng, hóa đơn, khoản thanh toán đã ghi nhận, biên nhận bán hàng và chi phí.', staysTitle: 'Chỉ lưu trong EverittOS', staysItems: 'Công việc đã lên lịch, doanh thu dự kiến, lợi nhuận dự kiến, phân công, hình ảnh và báo cáo vận hành.', differenceNote: 'Doanh thu dự kiến chưa phải là thu nhập trong QuickBooks cho đến khi được lập hóa đơn hoặc ghi nhận đã thanh toán. Đã thu là các khoản thanh toán được ghi trong EverittOS.',
    recentActivity: 'Hoạt động đồng bộ gần đây', sessionExpired: 'Phiên đăng nhập đã hết hạn. Hãy đăng nhập lại để quản lý QuickBooks.', statusUnavailable: 'Trạng thái QuickBooks tạm thời không khả dụng.', slowStatus: 'QuickBooks phản hồi quá chậm. Hãy làm mới trạng thái sau ít phút.', connectError: 'Không thể kết nối QuickBooks. Hãy thử lại.', disconnectError: 'Không thể ngắt kết nối QuickBooks. Hãy thử lại.', slowDisconnect: 'QuickBooks phản hồi quá chậm. Hãy thử lại.', syncError: 'Không thể bắt đầu đồng bộ QuickBooks.', syncedToast: 'QuickBooks đã đồng bộ.',
    recently: 'gần đây', justNow: 'vừa xong', minutesAgo: '{count} phút trước', hoursAgo: '{count} giờ trước', yesterday: 'hôm qua', daysAgo: '{count} ngày trước'
  }
};

const REQUEST_TIMEOUT_MS = 12000;
const STATUS_RETRY_TIMEOUT_MS = 20000;
const SYNC_POLL_INTERVAL_MS = 4000;

function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === 'AbortError';
}

async function fetchWithTimeout(input: RequestInfo | URL, init?: RequestInit, timeoutMs = REQUEST_TIMEOUT_MS) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(input, { ...init, credentials: 'same-origin', cache: 'no-store', headers: { 'Cache-Control': 'no-cache', Pragma: 'no-cache', ...(init?.headers || {}) }, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

async function fetchQuickBooksStatus() {
  try {
    return await fetchWithTimeout(`/api/integrations/quickbooks/status?t=${Date.now()}`);
  } catch (error) {
    if (!isAbortError(error)) throw error;
    return fetchWithTimeout(`/api/integrations/quickbooks/status?t=${Date.now()}`, undefined, STATUS_RETRY_TIMEOUT_MS);
  }
}

async function readJson(response: Response): Promise<Record<string, unknown>> {
  return (await response.json().catch(() => ({}))) as Record<string, unknown>;
}

function interpolate(value: string, count: number) {
  return value.replace('{count}', String(count));
}

function formatRelativeTime(value: string, copy: Copy, locale: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return copy.recently;
  const minutes = Math.max(0, Math.floor((Date.now() - date.getTime()) / 60000));
  if (minutes < 2) return copy.justNow;
  if (minutes < 60) return interpolate(copy.minutesAgo, minutes);
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return interpolate(copy.hoursAgo, hours);
  const days = Math.floor(hours / 24);
  if (days === 1) return copy.yesterday;
  if (days < 7) return interpolate(copy.daysAgo, days);
  return date.toLocaleDateString(locale, { month: 'short', day: 'numeric', year: 'numeric' });
}

function maskRealmId(realmId: string | null | undefined) {
  if (!realmId) return null;
  return realmId.length <= 6 ? realmId : `${realmId.slice(0, 3)}…${realmId.slice(-3)}`;
}

export function QuickBooksIntegrationPanel({ canManage }: { canManage: boolean }) {
  const searchParams = useSearchParams();
  const { t, locale } = useTranslation();
  const copy = COPY[locale === 'es' || locale === 'vi' ? locale : 'en'];
  const appFeedback = useAppFeedback();
  const mounted = useRef(true);
  const loadingRef = useRef(false);
  const previousStatusRef = useRef<string | undefined>(undefined);
  const oauthHandledRef = useRef(false);
  const [status, setStatus] = useState<QuickBooksStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [syncCompleted, setSyncCompleted] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [unauthorized, setUnauthorized] = useState(false);

  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);

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
        if (res.status === 401) { setUnauthorized(true); setLoadError(copy.sessionExpired); }
        else setLoadError(typeof json.error === 'string' ? json.error : copy.statusUnavailable);
        if (!silent) setStatus(null);
        return;
      }
      const nextStatus: QuickBooksStatus = {
        configured: Boolean(json.configured), canConnect: Boolean(json.canConnect),
        connection: (json.connection || { status: 'disconnected' }) as QuickBooksStatus['connection'],
        recentLogs: Array.isArray(json.recentLogs) ? json.recentLogs as SyncLog[] : [],
        needsReconnect: Boolean(json.needsReconnect), setupMessage: typeof json.setupMessage === 'string' ? json.setupMessage : null
      };
      const previous = previousStatusRef.current;
      const next = nextStatus.connection?.status;
      previousStatusRef.current = next;
      setStatus(nextStatus);
      if (previous === 'syncing' && next === 'connected') {
        if (nextStatus.connection?.last_error) { setSyncCompleted(false); appFeedback.error(nextStatus.connection.last_error); }
        else { setSyncCompleted(true); appFeedback.success(copy.syncedToast); }
      } else if (previous === 'syncing' && next === 'error') {
        setSyncCompleted(false);
        appFeedback.error(nextStatus.connection?.last_error || copy.reconnectRequired);
      }
    } catch (error) {
      if (!mounted.current) return;
      setLoadError(isAbortError(error) ? copy.slowStatus : copy.statusUnavailable);
      if (!silent) setStatus(null);
    } finally {
      loadingRef.current = false;
      if (mounted.current && !silent) setLoading(false);
    }
  }, [appFeedback, copy]);

  useEffect(() => { void load(); }, [load]);
  useEffect(() => {
    if (status?.connection?.status !== 'syncing') return;
    const timer = window.setInterval(() => void load({ silent: true }), SYNC_POLL_INTERVAL_MS);
    return () => window.clearInterval(timer);
  }, [status?.connection?.status, load]);
  useEffect(() => {
    if (oauthHandledRef.current) return;
    const qb = searchParams.get('quickbooks');
    if (!qb) return;
    oauthHandledRef.current = true;
    if (qb === 'connected') { appFeedback.connected(); window.setTimeout(() => void load(), 500); }
    else if (qb === 'error') appFeedback.error(copy.connectError);
    window.history.replaceState({}, '', '/settings#integrations');
  }, [searchParams, appFeedback, load, copy]);

  async function disconnect() {
    if (busy || status?.connection?.status === 'syncing') return;
    setBusy(true);
    try {
      const res = await fetchWithTimeout('/api/integrations/quickbooks/disconnect', { method: 'POST' });
      if (!res.ok) { appFeedback.error(copy.disconnectError); return; }
      setSyncCompleted(false); appFeedback.disconnected(); await load();
    } catch (error) {
      appFeedback.error(isAbortError(error) ? copy.slowDisconnect : copy.disconnectError);
    } finally { setBusy(false); }
  }

  async function syncNow() {
    if (busy || status?.connection?.status === 'syncing') return;
    setBusy(true); setSyncCompleted(false);
    try {
      const res = await fetchWithTimeout('/api/integrations/quickbooks/sync-now', { method: 'POST' });
      const json = await readJson(res);
      if (!res.ok) {
        const message = typeof json.error === 'string' ? json.error : copy.syncError;
        appFeedback.error(message);
        if (json.status === 'reconnect_required') setStatus(current => current ? { ...current, needsReconnect: true, connection: { ...current.connection, status: 'error', needsReconnect: true, last_error: message } } : current);
        else await load();
        return;
      }
      previousStatusRef.current = 'connected'; setSyncCompleted(true);
      setStatus(current => current ? { ...current, connection: { ...current.connection, status: 'connected', last_sync_at: new Date().toISOString(), last_error: null, needsReconnect: false }, needsReconnect: false } : current);
      appFeedback.success(typeof json.message === 'string' ? json.message : copy.syncedToast);
      await load({ silent: true });
    } catch (error) {
      if (!isAbortError(error)) appFeedback.error(copy.syncError);
    } finally { setBusy(false); }
  }

  const connectionStatus = status?.connection?.status;
  const syncing = connectionStatus === 'syncing';
  const connected = connectionStatus === 'connected' || syncing;
  const needsReconnect = connectionStatus === 'error' || Boolean(status?.needsReconnect || status?.connection?.needsReconnect);
  const statusText = loading ? copy.checking : unauthorized ? copy.signInRequired : loadError ? copy.failed : syncing ? copy.syncing : connected ? (syncCompleted ? copy.synced : copy.connected) : needsReconnect ? copy.reconnectRequired : status?.configured ? copy.disconnected : status ? copy.notConfigured : copy.notChecked;
  const showConnect = canManage && !connected;
  const realmMasked = maskRealmId(status?.connection?.realm_id);
  const recentLogs = status?.recentLogs || [];

  return <div>
    {!status && !loading && !loadError ? <p className="muted">{copy.connectHint}</p> : null}
    <p style={{ marginBottom: 10 }}>{t('pages.quickbooks.statusLabel')}: <strong>{statusText}</strong></p>
    {syncing ? <p className="muted" role="status">{copy.running}</p> : null}
    {loadError ? <p className="auth-message auth-message-error" role="alert">{loadError}</p> : null}
    {status?.setupMessage && !connected ? <p className="muted">{status.setupMessage}</p> : null}
    {needsReconnect && !loadError ? <p className="muted">{copy.resume}</p> : null}

    <div className="settings-actions" style={{ marginTop: 12 }}>
      {unauthorized ? <a className="btn btn-primary" href="/login?next=/settings">{copy.signInAgain}</a> : showConnect ? <a className="btn btn-primary" href="/api/integrations/quickbooks/connect">{needsReconnect ? t('pages.quickbooks.reconnect') : t('pages.quickbooks.connect')}</a> : null}
      <button type="button" className="btn" disabled={loading || busy} onClick={() => void load()}>{loading ? copy.checking : copy.refresh}</button>
      {canManage && connected ? <button type="button" className="btn" disabled={busy || loading || syncing} onClick={() => void syncNow()}>{syncing || busy ? copy.syncing : syncCompleted ? copy.synced : copy.syncNow}</button> : null}
      {canManage && (connected || needsReconnect) ? <button type="button" className="btn" disabled={busy || loading || syncing} onClick={() => void disconnect()}>{busy ? copy.disconnecting : t('pages.quickbooks.disconnect')}</button> : null}
    </div>

    {status?.connection?.company_name ? <p className="muted" style={{ marginTop: 12 }}>{connected ? copy.connectedCompany : copy.savedCompany}: <strong>{status.connection.company_name}</strong>{realmMasked ? ` · Realm ${realmMasked}` : ''}</p> : null}
    {status?.connection?.last_sync_at ? <p className="muted">{copy.lastSync} {formatRelativeTime(status.connection.last_sync_at, copy, locale)}.</p> : connected && !syncing ? <p className="muted">{copy.noSync}</p> : null}
    {status?.connection?.last_error && !syncing ? <p className="auth-message auth-message-error" role="alert">{status.connection.last_error}</p> : null}

    <section className="card" style={{ marginTop: 16, padding: 16 }} aria-labelledby="quickbooks-difference-title">
      <h4 id="quickbooks-difference-title" style={{ marginBottom: 6 }}>{copy.accountingTitle}</h4>
      <p className="muted" style={{ marginTop: 0 }}>{copy.accountingIntro}</p>
      <p style={{ marginBottom: 4 }}><strong>{copy.sentTitle}</strong></p><p className="muted" style={{ marginTop: 0 }}>{copy.sentItems}</p>
      <p style={{ marginBottom: 4 }}><strong>{copy.staysTitle}</strong></p><p className="muted" style={{ marginTop: 0 }}>{copy.staysItems}</p>
      <p className="muted" style={{ marginBottom: 0 }}>{copy.differenceNote}</p>
    </section>

    <div style={{ marginTop: 16 }}>
      <h4 style={{ marginBottom: 6 }}>{copy.currentSync}</h4>
      <ul className="muted" style={{ margin: 0, paddingLeft: 18 }}><li>{copy.exportLine}</li><li>{copy.importLine}</li><li>{copy.reconcileLine}</li></ul>
    </div>

    {recentLogs.length ? <details style={{ marginTop: 16 }}><summary><strong>{copy.recentActivity}</strong></summary><ul style={{ margin: '8px 0 0', paddingLeft: 18 }}>{recentLogs.map((log, index) => <li key={log.id || `${log.created_at}-${index}`} className="muted">{(log.created_at || '').slice(0, 16).replace('T', ' ')} · {log.entity_type || 'item'} · {log.action || 'sync'} · <strong>{log.status || 'unknown'}</strong>{log.error_message ? ` — ${log.error_message}` : ''}</li>)}</ul></details> : null}
  </div>;
}
