'use client';

import { useCallback, useEffect, useState } from 'react';
import { useAppFeedback } from '@/components/feedback/use-app-feedback';
import { useTranslation } from '@/components/locale-provider';
import { formatDateTimeLocale } from '@/lib/i18n/locale-format';

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
};

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
    error: payload.error || null
  };
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
  const failure =
    failed === 1
      ? t('pages.calendarImport.syncResultFailedOne', { failed })
      : t('pages.calendarImport.syncResultFailedMany', { failed });
  return `${summary} ${failure}`;
}

export function CalendarImportPanel() {
  const { t, locale } = useTranslation();
  const feedback = useAppFeedback();
  const [status, setStatus] = useState<CalendarImportStatus | null>(null);
  const [feedUrl, setFeedUrl] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<'connect' | 'sync' | 'disconnect' | ''>('');

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
      if (payload.created != null) {
        feedback.success(resultMessage(t, payload));
      }
    } catch (error) {
      feedback.error(error instanceof Error ? error.message : t('pages.calendarImport.connectError'));
    } finally {
      setBusy('');
    }
  }

  async function syncNow() {
    setBusy('sync');
    try {
      const response = await fetch('/api/integrations/calendar-import/sync', { method: 'POST' });
      const payload = (await response.json().catch(() => ({}))) as CalendarImportStatus;
      if (!response.ok) throw new Error(payload.error || t('pages.calendarImport.syncError'));
      setStatus(readStatus(payload));
      feedback.success(resultMessage(t, payload));
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
              <button className="btn btn-primary" type="button" disabled={busy !== '' || !feedUrl.trim()} onClick={() => void connect()}>
                {busy === 'connect' ? t('pages.calendarImport.connecting') : t('pages.calendarImport.connect')}
              </button>
            </div>
          </div>
        </>
      ) : null}
      {!loading && connected ? (
        <>
          <p>{t('pages.calendarImport.connected')}</p>
          <p className="muted">
            {t('pages.calendarImport.lastSync')}: {lastSyncLabel}
          </p>
          {status?.lastSyncError ? <p className="auth-message auth-message-error">{status.lastSyncError}</p> : null}
          <div className="inline-actions" style={{ marginTop: 12 }}>
            <button className="btn btn-primary" type="button" disabled={busy !== ''} onClick={() => void syncNow()}>
              {busy === 'sync' ? t('pages.calendarImport.syncing') : t('pages.calendarImport.syncNow')}
            </button>
            <button className="btn" type="button" disabled={busy !== ''} onClick={() => void disconnect()}>
              {busy === 'disconnect' ? t('pages.calendarImport.disconnecting') : t('pages.calendarImport.disconnect')}
            </button>
          </div>
        </>
      ) : null}
    </div>
  );
}
