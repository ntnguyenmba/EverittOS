import {
  CALENDAR_IMPORT_LABEL,
  type CalendarImportConnection,
  type CalendarImportCounts,
  type CalendarImportResult,
  type CalendarImportStatus
} from '@/lib/calendar-import/types';

const EMPTY_COUNTS: CalendarImportCounts = {
  created: 0,
  updated: 0,
  skipped: 0,
  failed: 0
};

export function toSafeCalendarImportStatus(
  connection: Pick<CalendarImportConnection, 'label' | 'last_sync_at' | 'last_sync_error'> | null | undefined
): CalendarImportStatus {
  if (!connection) {
    return {
      connected: false,
      label: CALENDAR_IMPORT_LABEL,
      lastSyncAt: null,
      lastSyncError: null
    };
  }

  return {
    connected: true,
    label: connection.label?.trim() || CALENDAR_IMPORT_LABEL,
    lastSyncAt: connection.last_sync_at || null,
    lastSyncError: connection.last_sync_error || null
  };
}

export function toSafeCalendarImportResult(
  connection: Pick<CalendarImportConnection, 'label' | 'last_sync_at' | 'last_sync_error'> | null | undefined,
  counts: Partial<CalendarImportCounts> = {}
): CalendarImportResult {
  return {
    ...toSafeCalendarImportStatus(connection),
    ...EMPTY_COUNTS,
    ...counts
  };
}

export function assertNoFeedSecret(payload: unknown): void {
  const serialized = JSON.stringify(payload || {});
  if (/"feed_url"\s*:/i.test(serialized) || /"feedUrl"\s*:/i.test(serialized)) {
    throw new Error('Calendar feed URL must not be included in API responses.');
  }
}
