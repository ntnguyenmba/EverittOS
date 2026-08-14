'use client';

import { useCallback, useEffect, useState } from 'react';
import { useAppFeedback } from '@/components/feedback/use-app-feedback';
import { useTranslation } from '@/components/locale-provider';
import { inferFailureCodeFromSafeMessage } from '@/lib/calendar-import/errors';
import { formatDateTimeLocale } from '@/lib/i18n/locale-format';

const FAILURE_REASON_KEYS = new Set([
  'schema_mismatch',
  'invalid_timezone',
  'invalid_event_time',
  'job_insert_failed',
  'job_update_failed',
  'missing_event_uid',
  'duplicate_conflict',
  'unsupported_all_day'
]);

type CalendarImportStatus = {
  connected?: boolean;
  label?: string;
  lastSyncAt?: string | null;
  lastSyncError?: string | null;
  created?: number;
  updated?: number;
  skipped?: number;
  failed?: number;
  error?: string | null;
  failureReason?: string | null;
};

type ReviewKind = 'new' | 'changed' | 'possible_match' | 'cancelled' | 'no_change';
type ReviewItem = {
  uid: string;
  title: string;
  location: string | null;
  start: string | null;
  end: string | null;
  kind: ReviewKind;
  changes: Array<'time' | 'location' | 'title' | 'status'>;
  jobId: string | null;
  jobTitle: string | null;
};

const reviewCopy = {
  en: {
    review: 'Review changes',
    reviewing: 'Checking…',
    apply: 'Apply selected',
    applying: 'Applying…',
    new: 'New event',
    changed: 'Job changed',
    possible_match: 'Possible match',
    cancelled: 'Cancellation',
    no_change: 'No change',
    time: 'Time changed',
    location: 'Location changed',
    title: 'Name changed',
    status: 'Status changed',
    none: 'No calendar changes need action.',
    intro: 'Calendar events stay here for review. Nothing is added to or changed in Jobs until you approve it.',
    matched: 'Possible existing job',
    reviewError: 'Calendar changes could not be reviewed.',
    add: 'Add as Job',
    update: 'Update Job',
    selectCancellation: 'Apply cancellation',
    selected: 'Selected',
    ignore: 'Ignore',
    viewJob: 'View existing job',
    possibleHelp: 'Review the existing job before deciding. EverittOS will not create a duplicate automatically.',
    selectOne: 'Choose at least one calendar change to apply.'
  },
  es: {
    review: 'Revisar cambios',
    reviewing: 'Revisando…',
    apply: 'Aplicar seleccionados',
    applying: 'Aplicando…',
    new: 'Evento nuevo',
    changed: 'Trabajo modificado',
    possible_match: 'Posible coincidencia',
    cancelled: 'Cancelación',
    no_change: 'Sin cambios',
    time: 'Cambió la hora',
    location: 'Cambió la ubicación',
    title: 'Cambió el nombre',
    status: 'Cambió el estado',
    none: 'No hay cambios del calendario que requieran acción.',
    intro: 'Los eventos del calendario permanecen aquí para revisión. Nada se agrega ni cambia en Trabajos hasta que lo apruebe.',
    matched: 'Posible trabajo existente',
    reviewError: 'No se pudieron revisar los cambios del calendario.',
    add: 'Agregar como trabajo',
    update: 'Actualizar trabajo',
    selectCancellation: 'Aplicar cancelación',
    selected: 'Seleccionado',
    ignore: 'Ignorar',
    viewJob: 'Ver trabajo existente',
    possibleHelp: 'Revise el trabajo existente antes de decidir. EverittOS no creará un duplicado automáticamente.',
    selectOne: 'Elija al menos un cambio del calendario para aplicar.'
  },
  vi: {
    review: 'Xem thay đổi',
    reviewing: 'Đang kiểm tra…',
    apply: 'Áp dụng mục đã chọn',
    applying: 'Đang áp dụng…',
    new: 'Sự kiện mới',
    changed: 'Công việc đã thay đổi',
    possible_match: 'Có thể trùng',
    cancelled: 'Hủy lịch',
    no_change: 'Không thay đổi',
    time: 'Đổi thời gian',
    location: 'Đổi địa điểm',
    title: 'Đổi tên',
    status: 'Đổi trạng thái',
    none: 'Không có thay đổi lịch nào cần xử lý.',
    intro: 'Sự kiện lịch sẽ ở đây để bạn xem trước. Không có gì được thêm hoặc thay đổi trong Công việc cho đến khi bạn đồng ý.',
    matched: 'Có thể là công việc hiện có',
    reviewError: 'Không thể xem các thay đổi của lịch.',
    add: 'Thêm thành công việc',
    update: 'Cập nhật công việc',
    selectCancellation: 'Áp dụng hủy lịch',
    selected: 'Đã chọn',
    ignore: 'Bỏ qua',
    viewJob: 'Xem công việc hiện có',
    possibleHelp: 'Xem công việc hiện có trước khi quyết định. EverittOS sẽ không tự tạo bản trùng.',
    selectOne: 'Chọn ít nhất một thay đổi lịch để áp dụng.'
  }
} as const;

function readStatus(payload: CalendarImportStatus): CalendarImportStatus {
  return {
    connected: Boolean(payload.connected),
    label: payload.label,
    lastSyncAt: payload.lastSyncAt || null,
    lastSyncError: payload.lastSyncError || null,
    created: payload.created,
    updated: payload.updated,
    skipped: payload.skipped,
    failed: payload.failed,
    error: payload.error || null,
    failureReason: payload.failureReason || inferFailureCodeFromSafeMessage(payload.lastSyncError)
  };
}

function failureReasonKey(code: string | null | undefined): string | null {
  return !code || !FAILURE_REASON_KEYS.has(code) ? null : code;
}

function resultMessage(
  t: (path: string, values?: Record<string, string | number>) => string,
  payload: CalendarImportStatus
): string {
  const created = payload.created ?? 0;
  const updated = payload.updated ?? 0;
  const skipped = payload.skipped ?? 0;
  const failed = payload.failed ?? 0;
  const summary = t('pages.calendarImport.syncResult', { created, updated, skipped });
  if (failed <= 0) return summary;
  const reasonKey = failureReasonKey(payload.failureReason);
  if (reasonKey) {
    const reason = t(`pages.calendarImport.failureReason.${reasonKey}`);
    const failure = failed === 1
      ? t('pages.calendarImport.syncResultFailedOneWithReason', { failed, reason })
      : t('pages.calendarImport.syncResultFailedManyWithReason', { failed, reason });
    return `${summary} ${failure}`;
  }
  return `${summary} ${failed === 1
    ? t('pages.calendarImport.syncResultFailedOne', { failed })
    : t('pages.calendarImport.syncResultFailedMany', { failed })}`;
}

function lastErrorMessage(
  t: (path: string, values?: Record<string, string | number>) => string,
  payload: CalendarImportStatus
): string | null {
  if (!payload.lastSyncError) return null;
  const reasonKey = failureReasonKey(payload.failureReason || inferFailureCodeFromSafeMessage(payload.lastSyncError));
  return reasonKey ? t(`pages.calendarImport.lastError.${reasonKey}`) : payload.lastSyncError;
}

export function CalendarImportPanel() {
  const { t, locale } = useTranslation();
  const c = reviewCopy[locale] || reviewCopy.en;
  const feedback = useAppFeedback();
  const [status, setStatus] = useState<CalendarImportStatus | null>(null);
  const [feedUrl, setFeedUrl] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<'connect' | 'sync' | 'disconnect' | 'review' | ''>('');
  const [reviewItems, setReviewItems] = useState<ReviewItem[] | null>(null);
  const [selectedUids, setSelectedUids] = useState<Set<string>>(new Set());

  const loadStatus = useCallback(async () => {
    const response = await fetch('/api/integrations/calendar-import/status', { cache: 'no-store' });
    const payload = (await response.json().catch(() => ({}))) as CalendarImportStatus;
    if (!response.ok) throw new Error(payload.error || t('pages.calendarImport.loadError'));
    setStatus(readStatus(payload));
  }, [t]);

  useEffect(() => {
    let active = true;
    setLoading(true);
    void loadStatus()
      .catch(() => {
        if (active) feedback.error(t('pages.calendarImport.loadError'));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [feedback, loadStatus, t]);

  async function connect() {
    setBusy('connect');
    try {
      const response = await fetch('/api/integrations/calendar-import/connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ feedUrl })
      });
      const payload = (await response.json().catch(() => ({}))) as CalendarImportStatus;
      if (!response.ok) throw new Error(payload.error || t('pages.calendarImport.connectError'));
      setFeedUrl('');
      setStatus(readStatus(payload));
    } catch (error) {
      feedback.error(error instanceof Error ? error.message : t('pages.calendarImport.connectError'));
    } finally {
      setBusy('');
    }
  }

  async function reviewChanges() {
    setBusy('review');
    try {
      const response = await fetch('/api/integrations/calendar-import/review', { cache: 'no-store' });
      const payload = (await response.json().catch(() => ({}))) as { items?: ReviewItem[]; error?: string };
      if (!response.ok) throw new Error(payload.error || c.reviewError);
      setReviewItems(payload.items || []);
      setSelectedUids(new Set());
    } catch (error) {
      feedback.error(error instanceof Error ? error.message : c.reviewError);
    } finally {
      setBusy('');
    }
  }

  function selectItem(uid: string) {
    setSelectedUids((current) => {
      const next = new Set(current);
      next.add(uid);
      return next;
    });
  }

  function ignoreItem(uid: string) {
    setSelectedUids((current) => {
      const next = new Set(current);
      next.delete(uid);
      return next;
    });
    setReviewItems((current) => current?.filter((item) => item.uid !== uid) || current);
  }

  async function applySelected() {
    if (selectedUids.size === 0) {
      feedback.error(c.selectOne);
      return;
    }
    setBusy('sync');
    try {
      const response = await fetch('/api/integrations/calendar-import/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ eventUids: Array.from(selectedUids) })
      });
      const payload = (await response.json().catch(() => ({}))) as CalendarImportStatus;
      if (!response.ok) throw new Error(payload.error || t('pages.calendarImport.syncError'));
      setStatus(readStatus(payload));
      setSelectedUids(new Set());
      feedback.success(resultMessage(t, payload));
      await reviewChanges();
      await loadStatus();
    } catch (error) {
      feedback.error(error instanceof Error ? error.message : t('pages.calendarImport.syncError'));
    } finally {
      setBusy('');
    }
  }

  async function disconnect() {
    setBusy('disconnect');
    try {
      const response = await fetch('/api/integrations/calendar-import/disconnect', { method: 'POST' });
      const payload = (await response.json().catch(() => ({}))) as CalendarImportStatus;
      if (!response.ok) throw new Error(payload.error || t('pages.calendarImport.disconnectError'));
      setStatus(readStatus(payload));
      setFeedUrl('');
      setReviewItems(null);
      setSelectedUids(new Set());
    } catch (error) {
      feedback.error(error instanceof Error ? error.message : t('pages.calendarImport.disconnectError'));
    } finally {
      setBusy('');
    }
  }

  const connected = Boolean(status?.connected);
  const lastSyncLabel = status?.lastSyncAt
    ? formatDateTimeLocale(status.lastSyncAt, locale)
    : t('pages.calendarImport.neverSynced');
  const actionable = reviewItems?.filter((item) => item.kind !== 'no_change') || [];

  return (
    <div>
      <h3 style={{ marginBottom: 8 }}>{t('pages.calendarImport.title')}</h3>
      {loading ? <p className="muted">{t('pages.calendarImport.connecting')}</p> : null}

      {!loading && !connected ? (
        <>
          <p className="muted">{t('pages.calendarImport.helper')}</p>
          <div className="form" style={{ marginTop: 12, maxWidth: 520 }}>
            <label htmlFor="calendar-import-url">{t('pages.calendarImport.urlPlaceholder')}</label>
            <input
              id="calendar-import-url"
              className="input"
              type="text"
              inputMode="url"
              autoComplete="off"
              spellCheck={false}
              value={feedUrl}
              onChange={(event) => setFeedUrl(event.target.value)}
              placeholder={t('pages.calendarImport.urlPlaceholder')}
            />
            <div className="inline-actions" style={{ marginTop: 12 }}>
              <button
                className="btn btn-primary"
                type="button"
                disabled={busy !== '' || !feedUrl.trim()}
                onClick={() => void connect()}
              >
                {busy === 'connect' ? t('pages.calendarImport.connecting') : t('pages.calendarImport.connect')}
              </button>
            </div>
          </div>
        </>
      ) : null}

      {!loading && connected ? (
        <>
          <p>{t('pages.calendarImport.connected')}</p>
          <p className="muted">{t('pages.calendarImport.lastSync')}: {lastSyncLabel}</p>
          {reviewItems === null && status && lastErrorMessage(t, status) ? (
            <p className="auth-message auth-message-error">{lastErrorMessage(t, status)}</p>
          ) : null}

          <p className="muted" style={{ marginTop: 12 }}>{c.intro}</p>

          <div className="inline-actions" style={{ marginTop: 12 }}>
            <button className="btn btn-primary" type="button" disabled={busy !== ''} onClick={() => void reviewChanges()}>
              {busy === 'review' ? c.reviewing : c.review}
            </button>
            {reviewItems !== null && selectedUids.size > 0 ? (
              <button className="btn" type="button" disabled={busy !== ''} onClick={() => void applySelected()}>
                {busy === 'sync' ? c.applying : `${c.apply} (${selectedUids.size})`}
              </button>
            ) : null}
            <button className="btn" type="button" disabled={busy !== ''} onClick={() => void disconnect()}>
              {busy === 'disconnect' ? t('pages.calendarImport.disconnecting') : t('pages.calendarImport.disconnect')}
            </button>
          </div>

          {reviewItems !== null ? (
            <div style={{ marginTop: 14 }}>
              {actionable.length === 0 ? <p className="muted">{c.none}</p> : actionable.map((item) => {
                const selected = selectedUids.has(item.uid);
                const actionLabel = item.kind === 'new'
                  ? c.add
                  : item.kind === 'cancelled'
                    ? c.selectCancellation
                    : c.update;

                return (
                  <div className="card" key={item.uid} style={{ marginTop: 8, padding: 12 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'baseline', flexWrap: 'wrap' }}>
                      <strong>{item.title}</strong>
                      <span className="muted">{c[item.kind]}</span>
                    </div>
                    {item.start ? <div className="muted" style={{ marginTop: 4 }}>{formatDateTimeLocale(item.start, locale)}</div> : null}
                    {item.location ? <div className="muted">{item.location}</div> : null}
                    {item.jobTitle && item.kind === 'possible_match' ? (
                      <div className="muted" style={{ marginTop: 4 }}>{c.matched}: {item.jobTitle}</div>
                    ) : null}
                    {item.changes.length ? (
                      <div className="muted" style={{ marginTop: 4 }}>{item.changes.map((change) => c[change]).join(' · ')}</div>
                    ) : null}
                    {item.kind === 'possible_match' ? <p className="muted" style={{ marginTop: 8 }}>{c.possibleHelp}</p> : null}
                    <div className="inline-actions" style={{ marginTop: 10 }}>
                      {item.kind !== 'possible_match' ? (
                        <button className={selected ? 'btn btn-primary' : 'btn'} type="button" disabled={busy !== ''} onClick={() => selectItem(item.uid)}>
                          {selected ? c.selected : actionLabel}
                        </button>
                      ) : null}
                      {item.kind === 'possible_match' && item.jobId ? (
                        <a className="btn" href={`/jobs/${item.jobId}`}>{c.viewJob}</a>
                      ) : null}
                      <button className="btn" type="button" disabled={busy !== ''} onClick={() => ignoreItem(item.uid)}>{c.ignore}</button>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : null}
        </>
      ) : null}
    </div>
  );
}
