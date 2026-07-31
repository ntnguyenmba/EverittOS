import { isValidTimeZone, normalizeTimeZone } from '@/lib/time-zones';

/** Generate individual occurrences this many days ahead. Consistent app-wide window. */
export const RECURRING_GENERATION_WINDOW_DAYS = 75;

export const RECURRENCE_FREQUENCIES = [
  'none',
  'weekly',
  'biweekly',
  'every_four_weeks',
  'monthly',
  'custom'
] as const;

export type RecurrenceFrequency = (typeof RECURRENCE_FREQUENCIES)[number];

export type RecurringSeriesInput = {
  frequency: RecurrenceFrequency;
  interval?: number; // for custom: every X weeks/months
  intervalUnit?: 'weeks' | 'months';
  weekday?: number | null; // 0=Sun .. 6=Sat
  startDate: string; // YYYY-MM-DD
  endDate?: string | null;
  occurrenceLimit?: number | null;
  preferredStartTime?: string | null; // HH:mm
  durationMinutes?: number | null;
  timezone?: string | null;
};

export type GeneratedOccurrence = {
  occurrenceDate: string;
  scheduledStart: string;
  scheduledEnd: string | null;
};

const WEEKDAY_LABELS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

function parseDateParts(value: string): { y: number; m: number; d: number } | null {
  const match = value.trim().match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;
  return { y: Number(match[1]), m: Number(match[2]), d: Number(match[3]) };
}

function formatDateParts(y: number, m: number, d: number): string {
  return `${String(y).padStart(4, '0')}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

/** Treat YYYY-MM-DD as a civil date (no browser TZ shift). */
function addDaysCivil(date: string, days: number): string {
  const parts = parseDateParts(date);
  if (!parts) return date;
  const utc = new Date(Date.UTC(parts.y, parts.m - 1, parts.d + days));
  return formatDateParts(utc.getUTCFullYear(), utc.getUTCMonth() + 1, utc.getUTCDate());
}

function addMonthsCivil(date: string, months: number): string {
  const parts = parseDateParts(date);
  if (!parts) return date;
  const utc = new Date(Date.UTC(parts.y, parts.m - 1 + months, 1));
  const year = utc.getUTCFullYear();
  const month = utc.getUTCMonth();
  const lastDay = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  const day = Math.min(parts.d, lastDay);
  return formatDateParts(year, month + 1, day);
}

function weekdayCivil(date: string): number {
  const parts = parseDateParts(date);
  if (!parts) return 0;
  return new Date(Date.UTC(parts.y, parts.m - 1, parts.d)).getUTCDay();
}

function compareCivil(a: string, b: string): number {
  return a.localeCompare(b);
}

export function resolveRecurrenceInterval(input: RecurringSeriesInput): {
  frequency: RecurrenceFrequency;
  interval: number;
  intervalUnit: 'weeks' | 'months';
} {
  switch (input.frequency) {
    case 'weekly':
      return { frequency: 'weekly', interval: 1, intervalUnit: 'weeks' };
    case 'biweekly':
      return { frequency: 'biweekly', interval: 2, intervalUnit: 'weeks' };
    case 'every_four_weeks':
      return { frequency: 'every_four_weeks', interval: 4, intervalUnit: 'weeks' };
    case 'monthly':
      return { frequency: 'monthly', interval: 1, intervalUnit: 'months' };
    case 'custom':
      return {
        frequency: 'custom',
        interval: Math.max(1, Number(input.interval || 1)),
        intervalUnit: input.intervalUnit === 'months' ? 'months' : 'weeks'
      };
    default:
      return { frequency: 'none', interval: 1, intervalUnit: 'weeks' };
  }
}

export function alignStartToWeekday(startDate: string, weekday: number | null | undefined): string {
  if (weekday == null || weekday < 0 || weekday > 6) return startDate;
  let cursor = startDate;
  for (let i = 0; i < 7; i += 1) {
    if (weekdayCivil(cursor) === weekday) return cursor;
    cursor = addDaysCivil(cursor, 1);
  }
  return startDate;
}

export function windowEndDate(startFrom: string, windowDays = RECURRING_GENERATION_WINDOW_DAYS): string {
  return addDaysCivil(startFrom, windowDays);
}

/**
 * Generate occurrence dates in the series timezone calendar (civil dates).
 * Does not use the browser timezone for cadence math.
 */
export function generateOccurrenceDates(
  input: RecurringSeriesInput,
  options?: { fromDate?: string; windowDays?: number; existingCount?: number }
): string[] {
  if (input.frequency === 'none') return [input.startDate];

  const { interval, intervalUnit } = resolveRecurrenceInterval(input);
  const timezone = normalizeTimeZone(input.timezone);
  void timezone; // cadence uses civil dates; wall-clock applied separately

  const weekday = input.weekday ?? weekdayCivil(input.startDate);
  let cursor = alignStartToWeekday(input.startDate, weekday);
  const fromDate = options?.fromDate || input.startDate;
  const hardWindowEnd = windowEndDate(fromDate, options?.windowDays ?? RECURRING_GENERATION_WINDOW_DAYS);
  const seriesEnd = input.endDate && compareCivil(input.endDate, hardWindowEnd) < 0 ? input.endDate : hardWindowEnd;
  const limit = input.occurrenceLimit && input.occurrenceLimit > 0 ? input.occurrenceLimit : null;
  let produced = options?.existingCount || 0;
  const dates: string[] = [];

  // Advance cursor until it reaches the generation-from date.
  while (compareCivil(cursor, fromDate) < 0) {
    cursor =
      intervalUnit === 'months' ? addMonthsCivil(cursor, interval) : addDaysCivil(cursor, interval * 7);
    if (dates.length > 1000) break;
  }

  while (compareCivil(cursor, seriesEnd) <= 0) {
    if (limit != null && produced >= limit) break;
    dates.push(cursor);
    produced += 1;
    cursor =
      intervalUnit === 'months' ? addMonthsCivil(cursor, interval) : addDaysCivil(cursor, interval * 7);
    if (dates.length > 200) break;
  }

  return dates;
}

export function buildOccurrenceSchedule(
  occurrenceDate: string,
  preferredStartTime: string | null | undefined,
  durationMinutes: number | null | undefined,
  timezone: string | null | undefined
): GeneratedOccurrence {
  const time = (preferredStartTime || '09:00').trim();
  const match = time.match(/^(\d{2}):(\d{2})$/);
  const hh = match?.[1] || '09';
  const mm = match?.[2] || '00';
  const scheduledStart = `${occurrenceDate}T${hh}:${mm}:00`;
  const minutes = Number(durationMinutes);
  let scheduledEnd: string | null = null;
  if (Number.isFinite(minutes) && minutes > 0) {
    const parts = parseDateParts(occurrenceDate);
    if (parts) {
      const startUtc = Date.UTC(parts.y, parts.m - 1, parts.d, Number(hh), Number(mm));
      const end = new Date(startUtc + minutes * 60_000);
      scheduledEnd = `${formatDateParts(end.getUTCFullYear(), end.getUTCMonth() + 1, end.getUTCDate())}T${String(
        end.getUTCHours()
      ).padStart(2, '0')}:${String(end.getUTCMinutes()).padStart(2, '0')}:00`;
    }
  }
  return {
    occurrenceDate,
    scheduledStart,
    scheduledEnd
  };
}

export function generateOccurrences(
  input: RecurringSeriesInput,
  options?: { fromDate?: string; windowDays?: number; existingCount?: number }
): GeneratedOccurrence[] {
  const tz = input.timezone && isValidTimeZone(input.timezone) ? input.timezone.trim() : normalizeTimeZone(input.timezone);
  return generateOccurrenceDates(input, options).map((date) =>
    buildOccurrenceSchedule(date, input.preferredStartTime, input.durationMinutes, tz)
  );
}

export function summarizeRecurrence(input: RecurringSeriesInput): string {
  if (input.frequency === 'none') {
    return `One-time job on ${input.startDate}${input.preferredStartTime ? ` at ${formatTimeLabel(input.preferredStartTime)}` : ''}.`;
  }

  const { interval, intervalUnit } = resolveRecurrenceInterval(input);
  const weekday = input.weekday ?? weekdayCivil(input.startDate);
  const dayLabel = WEEKDAY_LABELS[weekday] || 'the selected day';
  const timeLabel = input.preferredStartTime ? ` at ${formatTimeLabel(input.preferredStartTime)}` : '';
  let cadence = '';
  if (input.frequency === 'weekly' || (intervalUnit === 'weeks' && interval === 1)) cadence = 'Every week';
  else if (input.frequency === 'biweekly' || (intervalUnit === 'weeks' && interval === 2)) cadence = 'Every two weeks';
  else if (input.frequency === 'every_four_weeks' || (intervalUnit === 'weeks' && interval === 4)) {
    cadence = 'Every four weeks';
  } else if (input.frequency === 'monthly' || intervalUnit === 'months') {
    cadence = interval === 1 ? 'Every month' : `Every ${interval} months`;
  } else cadence = `Every ${interval} weeks`;

  let ending = '';
  if (input.endDate) ending = ` until ${input.endDate}`;
  else if (input.occurrenceLimit) ending = ` for ${input.occurrenceLimit} visits`;
  else ending = `. Only the next ${RECURRING_GENERATION_WINDOW_DAYS} days are scheduled at one time`;

  return `${cadence} on ${dayLabel}${timeLabel} beginning ${input.startDate}${ending}.`;
}

function formatTimeLabel(value: string): string {
  const match = value.trim().match(/^(\d{2}):(\d{2})$/);
  if (!match) return value;
  let hour = Number(match[1]);
  const minute = match[2];
  const suffix = hour >= 12 ? 'PM' : 'AM';
  hour = hour % 12;
  if (hour === 0) hour = 12;
  return `${hour}:${minute} ${suffix}`;
}

export function isCompletedLikeStatus(status: string | null | undefined): boolean {
  const value = String(status || '').toLowerCase();
  return ['completed', 'done', 'complete', 'closed'].includes(value);
}

export function isCancelledOrSkippedStatus(
  status: string | null | undefined,
  isSkipped?: boolean | null
): boolean {
  if (isSkipped) return true;
  const value = String(status || '').toLowerCase();
  return value === 'cancelled' || value === 'canceled' || value === 'skipped';
}

/** Scheduled revenue = sum of prices on future generated occurrences only (never unlimited). */
export function calculateScheduledRevenue(
  occurrences: Array<{ price?: number | null; status?: string | null; is_skipped?: boolean | null; occurrence_date?: string | null }>,
  asOfDate: string
): number {
  let total = 0;
  for (const row of occurrences) {
    if (isCancelledOrSkippedStatus(row.status, row.is_skipped)) continue;
    if (isCompletedLikeStatus(row.status)) continue;
    if (!row.occurrence_date || compareCivil(row.occurrence_date, asOfDate) < 0) continue;
    const price = Number(row.price || 0);
    if (Number.isFinite(price) && price > 0) total += price;
  }
  return Number(total.toFixed(2));
}
