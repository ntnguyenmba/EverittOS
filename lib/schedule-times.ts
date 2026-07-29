/** Local / wall-clock date-time helpers for job scheduling.
 *
 * Field-service scheduling uses two shapes:
 * 1. Visit rows: visit_date (YYYY-MM-DD) + start_time/end_time (HH:mm) — wall clock, no TZ.
 * 2. Legacy jobs.scheduled_start/end (timestamptz) — may be naive wall-clock or zoned UTC ISO.
 *
 * Rule: never shift a user-selected local date/time when round-tripping through storage.
 */

function pad2(value: number): string {
  return String(value).padStart(2, '0');
}

/** Calendar date in the runtime's local timezone (YYYY-MM-DD). */
export function formatLocalDate(date: Date = new Date()): string {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
}

/** Local clock time (HH:mm). */
export function formatLocalTime(date: Date = new Date()): string {
  return `${pad2(date.getHours())}:${pad2(date.getMinutes())}`;
}

export function localToday(): string {
  return formatLocalDate(new Date());
}

export function addLocalDays(dateStr: string, days: number): string {
  const match = dateStr.trim().match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return localToday();
  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  date.setDate(date.getDate() + days);
  return formatLocalDate(date);
}

export function normalizeTimeInput(value: string | null | undefined, fallback = ''): string {
  const trimmed = value?.trim() || '';
  const match = trimmed.match(/^(\d{2}):(\d{2})(?::\d{2})?$/);
  return match ? `${match[1]}:${match[2]}` : fallback;
}

export function normalizeDateInput(value: string | null | undefined): string {
  const trimmed = value?.trim() || '';
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;
  const wall = wallClockFromTimestamp(trimmed);
  return wall?.date || '';
}

/** True when the timestamp string includes an explicit zone (Z or ±offset). */
export function hasExplicitTimeZone(value: string): boolean {
  return /(?:[zZ]|[+-]\d{2}:?\d{2})$/.test(value.trim());
}

/**
 * Extract the wall-clock date + HH:mm a user selected.
 *
 * Legacy EverittOS job timestamps may end in Z even though the written clock
 * was the user's intended local business time. Preserve the written clock so
 * historical jobs do not shift backward when displayed or exported.
 */
export function wallClockFromTimestamp(
  value: string | null | undefined,
  fallbackTime = '09:00'
): { date: string; time: string } | null {
  if (!value?.trim()) return null;
  const trimmed = value.trim();
  const match = trimmed.match(/^(\d{4}-\d{2}-\d{2})(?:[T\s](\d{2}):(\d{2}))?/);
  if (!match) return null;
  return {
    date: match[1],
    time: match[2] ? `${match[2]}:${match[3]}` : fallbackTime
  };
}

/** Persist a wall-clock appointment as a timezone-less local datetime string. */
export function wallClockDateTime(dateStr: string, timeStr: string): string | null {
  const date = normalizeDateInput(dateStr);
  const time = normalizeTimeInput(timeStr);
  if (!date || !time) return null;
  return `${date}T${time}:00`;
}

export function localTimeFromIso(iso: string | null | undefined, fallback = '09:00'): string {
  const wall = wallClockFromTimestamp(iso, fallback);
  return wall?.time || fallback;
}

export function localDateFromIso(iso: string | null | undefined): string {
  const wall = wallClockFromTimestamp(iso);
  return wall?.date || '';
}

/**
 * Combine YYYY-MM-DD and HH:mm without converting the selected wall-clock
 * value through the browser or server timezone. The organization's selected
 * IANA timezone is applied when displaying, syncing, or exporting the event.
 */
export function combineDateAndTime(dateStr: string, timeStr: string): string | null {
  if (!dateStr?.trim()) return null;
  return wallClockDateTime(dateStr, normalizeTimeInput(timeStr, '09:00') || '09:00');
}

export function hoursBetween(startIso: string | null | undefined, endIso: string | null | undefined): number | null {
  if (!startIso || !endIso) return null;
  const startWall = wallClockFromTimestamp(startIso);
  const endWall = wallClockFromTimestamp(endIso);
  if (startWall && endWall) {
    const start = new Date(`${startWall.date}T${startWall.time}:00`).getTime();
    const end = new Date(`${endWall.date}T${endWall.time}:00`).getTime();
    if (Number.isNaN(start) || Number.isNaN(end) || end <= start) return null;
    return Math.round(((end - start) / 3600000) * 100) / 100;
  }
  const start = new Date(startIso).getTime();
  const end = new Date(endIso).getTime();
  if (Number.isNaN(start) || Number.isNaN(end) || end <= start) return null;
  return Math.round(((end - start) / 3600000) * 100) / 100;
}

export function formatScheduleDuration(
  startIso: string | null | undefined,
  endIso: string | null | undefined
): string {
  const hours = hoursBetween(startIso, endIso);
  if (hours == null) return '';
  if (hours < 1) return `${Math.round(hours * 60)} min`;
  return `${hours} hr${hours === 1 ? '' : 's'}`;
}

export function formatScheduleTimeRange(
  startIso: string | null | undefined,
  endIso: string | null | undefined,
  startDate?: string | null,
  dueDate?: string | null
): string {
  const datePart = startDate || localDateFromIso(startIso) || dueDate || 'No date';
  const startTime = localTimeFromIso(startIso, '');
  const endTime = localTimeFromIso(endIso, '');
  if (startTime && endTime) {
    const duration = formatScheduleDuration(startIso, endIso);
    return `${datePart} · ${startTime}–${endTime}${duration ? ` (${duration})` : ''}`;
  }
  return datePart;
}
