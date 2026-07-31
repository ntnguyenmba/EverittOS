import {
  addMoneyDollars,
  calculateExpectedJobFinance,
  centsToDollars,
  dollarsToCents,
  parseMoneyDollars
} from '@/lib/money-decimal';
import { getRecurrenceCopy, recurrenceLocaleTag } from '@/lib/i18n/recurrence-copy';
import { isValidTimeZone, normalizeTimeZone } from '@/lib/time-zones';

/**
 * Rolling generation window for materialised recurring occurrences.
 * Keep a full year scheduled ahead. The series itself may continue indefinitely.
 * Centralized so create, top-up, and UI copy stay aligned.
 */
export const RECURRING_GENERATION_WINDOW_DAYS = 365;

export const RECURRENCE_FREQUENCIES = [
  'none',
  'daily',
  'weekly',
  'biweekly',
  'every_three_weeks',
  'every_four_weeks',
  'monthly',
  'custom'
] as const;

export type RecurrenceFrequency = (typeof RECURRENCE_FREQUENCIES)[number];
export type RecurrenceIntervalUnit = 'days' | 'weeks' | 'months';
export type RecurrenceEndMode = 'never' | 'on_date' | 'after_count';

export type RecurringSeriesInput = {
  frequency: RecurrenceFrequency;
  interval?: number;
  intervalUnit?: RecurrenceIntervalUnit;
  /** Single weekday (legacy). Prefer weekdays when multiple days are selected. */
  weekday?: number | null;
  /** Selected weekdays 0=Sun..6=Sat for weekly-style schedules. */
  weekdays?: number[] | null;
  startDate: string; // YYYY-MM-DD
  endDate?: string | null;
  /**
   * Max successfully generated jobs for the series.
   * Counts inserted rows including skipped/cancelled. Failed inserts do not count.
   */
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

function addMonthsCivil(date: string, months: number, anchorDay?: number): string {
  const parts = parseDateParts(date);
  if (!parts) return date;
  const utc = new Date(Date.UTC(parts.y, parts.m - 1 + months, 1));
  const year = utc.getUTCFullYear();
  const month = utc.getUTCMonth();
  const lastDay = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  // Prefer the original series day-of-month so Jan 31 → Feb 28 → Mar 31.
  const desiredDay = anchorDay && anchorDay >= 1 && anchorDay <= 31 ? anchorDay : parts.d;
  const day = Math.min(desiredDay, lastDay);
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

function daysBetweenCivil(from: string, to: string): number {
  const a = parseDateParts(from);
  const b = parseDateParts(to);
  if (!a || !b) return 0;
  const ms =
    Date.UTC(b.y, b.m - 1, b.d) - Date.UTC(a.y, a.m - 1, a.d);
  return Math.round(ms / 86_400_000);
}

export function civilDateInTimeZone(timeZone: string | null | undefined, now = new Date()): string {
  const tz = timeZone && isValidTimeZone(timeZone) ? timeZone : normalizeTimeZone(timeZone);
  try {
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: tz,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    }).formatToParts(now);
    const y = parts.find((p) => p.type === 'year')?.value;
    const m = parts.find((p) => p.type === 'month')?.value;
    const d = parts.find((p) => p.type === 'day')?.value;
    if (y && m && d) return `${y}-${m}-${d}`;
  } catch {
    // fall through
  }
  return formatDateParts(now.getFullYear(), now.getMonth() + 1, now.getDate());
}

export function localTimeHHmmInTimeZone(timeZone: string | null | undefined, now = new Date()): string {
  const tz = timeZone && isValidTimeZone(timeZone) ? timeZone : normalizeTimeZone(timeZone);
  try {
    const parts = new Intl.DateTimeFormat('en-GB', {
      timeZone: tz,
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23'
    }).formatToParts(now);
    const hour = parts.find((p) => p.type === 'hour')?.value || '00';
    const minute = parts.find((p) => p.type === 'minute')?.value || '00';
    return `${hour.padStart(2, '0')}:${minute.padStart(2, '0')}`;
  } catch {
    return `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  }
}

export function normalizeWeekdays(input: RecurringSeriesInput): number[] {
  const fromList = (input.weekdays || [])
    .map((value) => Number(value))
    .filter((value) => Number.isInteger(value) && value >= 0 && value <= 6);
  if (fromList.length) {
    return Array.from(new Set(fromList)).sort((a, b) => a - b);
  }
  if (input.weekday != null && input.weekday >= 0 && input.weekday <= 6) {
    return [input.weekday];
  }
  return [weekdayCivil(input.startDate)];
}

export function resolveRecurrenceInterval(input: RecurringSeriesInput): {
  frequency: RecurrenceFrequency;
  interval: number;
  intervalUnit: RecurrenceIntervalUnit;
} {
  const customInterval = Math.min(365, Math.max(1, Number(input.interval || 1)));
  switch (input.frequency) {
    case 'daily':
      return { frequency: 'daily', interval: 1, intervalUnit: 'days' };
    case 'weekly':
      return { frequency: 'weekly', interval: 1, intervalUnit: 'weeks' };
    case 'biweekly':
      return { frequency: 'biweekly', interval: 2, intervalUnit: 'weeks' };
    case 'every_three_weeks':
      return { frequency: 'every_three_weeks', interval: 3, intervalUnit: 'weeks' };
    case 'every_four_weeks':
      return { frequency: 'every_four_weeks', interval: 4, intervalUnit: 'weeks' };
    case 'monthly':
      return { frequency: 'monthly', interval: 1, intervalUnit: 'months' };
    case 'custom':
      return {
        frequency: 'custom',
        interval: customInterval,
        intervalUnit:
          input.intervalUnit === 'days' || input.intervalUnit === 'months' ? input.intervalUnit : 'weeks'
      };
    default:
      return { frequency: 'none', interval: 1, intervalUnit: 'weeks' };
  }
}

export function resolveRecurrenceEndMode(input: {
  endDate?: string | null;
  occurrenceLimit?: number | null;
  endMode?: RecurrenceEndMode | null;
}): RecurrenceEndMode {
  if (input.endMode === 'never' || input.endMode === 'on_date' || input.endMode === 'after_count') {
    return input.endMode;
  }
  if (input.occurrenceLimit && input.occurrenceLimit > 0) return 'after_count';
  if (input.endDate) return 'on_date';
  return 'never';
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

export function alignStartToWeekdays(startDate: string, weekdays: number[]): string {
  if (!weekdays.length) return startDate;
  let cursor = startDate;
  for (let i = 0; i < 7; i += 1) {
    if (weekdays.includes(weekdayCivil(cursor))) return cursor;
    cursor = addDaysCivil(cursor, 1);
  }
  return startDate;
}

export function windowEndDate(startFrom: string, windowDays = RECURRING_GENERATION_WINDOW_DAYS): string {
  return addDaysCivil(startFrom, windowDays);
}

function advanceCursor(
  cursor: string,
  interval: number,
  intervalUnit: RecurrenceIntervalUnit,
  anchorDay?: number
): string {
  if (intervalUnit === 'months') return addMonthsCivil(cursor, interval, anchorDay);
  if (intervalUnit === 'days') return addDaysCivil(cursor, interval);
  return addDaysCivil(cursor, interval * 7);
}

/**
 * Generate occurrence dates using civil calendar math in the series timezone context.
 * Never emits dates before startDate. End date is inclusive. Rolling window caps output.
 */
export function generateOccurrenceDates(
  input: RecurringSeriesInput,
  options?: { fromDate?: string; windowDays?: number; existingCount?: number }
): string[] {
  if (input.frequency === 'none') return [input.startDate];

  const { interval, intervalUnit } = resolveRecurrenceInterval(input);
  const weekdays = normalizeWeekdays(input);
  const fromDate = options?.fromDate || input.startDate;
  const hardWindowEnd = windowEndDate(fromDate, options?.windowDays ?? RECURRING_GENERATION_WINDOW_DAYS);
  const seriesEnd =
    input.endDate && compareCivil(input.endDate, hardWindowEnd) < 0 ? input.endDate : hardWindowEnd;
  const limit = input.occurrenceLimit && input.occurrenceLimit > 0 ? input.occurrenceLimit : null;
  let produced = options?.existingCount || 0;
  const dates: string[] = [];

  // Daily / custom days / monthly: single stream.
  if (intervalUnit === 'days' || intervalUnit === 'months' || weekdays.length <= 1) {
    const weekday = weekdays[0] ?? weekdayCivil(input.startDate);
    const anchorDay = parseDateParts(input.startDate)?.d;
    let cursor =
      intervalUnit === 'weeks' ? alignStartToWeekday(input.startDate, weekday) : input.startDate;

    let guard = 0;
    while (compareCivil(cursor, fromDate) < 0) {
      cursor = advanceCursor(cursor, interval, intervalUnit, anchorDay);
      guard += 1;
      if (guard > 1000) break;
    }

    while (compareCivil(cursor, seriesEnd) <= 0) {
      if (limit != null && produced >= limit) break;
      if (compareCivil(cursor, input.startDate) >= 0) {
        dates.push(cursor);
        produced += 1;
      }
      cursor = advanceCursor(cursor, interval, intervalUnit, anchorDay);
      // Cap above a 365-day daily stream so the rolling window is fully materialisable.
      if (dates.length > 400) break;
    }
    return dates;
  }

  // Weekly-style multi-weekday: include each selected weekday on matching week intervals.
  const first = alignStartToWeekdays(input.startDate, weekdays);
  let cursor = first;
  // Rewind to the start of the first aligned week cycle if fromDate is later.
  if (compareCivil(cursor, fromDate) < 0) {
    const deltaDays = daysBetweenCivil(first, fromDate);
    const weekBlocks = Math.floor(deltaDays / (7 * interval)) * interval;
    cursor = addDaysCivil(first, weekBlocks * 7);
    while (compareCivil(cursor, fromDate) < 0) {
      cursor = addDaysCivil(cursor, 1);
      if (daysBetweenCivil(first, cursor) > 4000) break;
    }
  }

  let emitGuard = 0;
  while (compareCivil(cursor, seriesEnd) <= 0) {
    if (limit != null && produced >= limit) break;
    const weeksFromStart = Math.floor(daysBetweenCivil(first, cursor) / 7);
    const onCadence = weeksFromStart % interval === 0;
    if (
      onCadence &&
      weekdays.includes(weekdayCivil(cursor)) &&
      compareCivil(cursor, input.startDate) >= 0 &&
      compareCivil(cursor, fromDate) >= 0
    ) {
      dates.push(cursor);
      produced += 1;
    }
    cursor = addDaysCivil(cursor, 1);
    emitGuard += 1;
    if (emitGuard > 1400 || dates.length > 400) break;
  }

  return dates;
}

export function buildOccurrenceSchedule(
  occurrenceDate: string,
  preferredStartTime: string | null | undefined,
  durationMinutes: number | null | undefined,
  timezone: string | null | undefined
): GeneratedOccurrence {
  void timezone;
  const match = String(preferredStartTime || '')
    .trim()
    .match(/^(\d{2}):(\d{2})$/);
  // No silent 9:00 AM default. Missing time uses midnight wall-clock storage only.
  const hh = match?.[1] || '00';
  const mm = match?.[2] || '00';
  const scheduledStart = `${occurrenceDate}T${hh}:${mm}:00`;
  const minutes = Number(durationMinutes);
  let scheduledEnd: string | null = null;
  if (match && Number.isFinite(minutes) && minutes > 0) {
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

/**
 * Drop today's occurrence when its local start time has already passed.
 * Prefers the next valid occurrence over creating an immediately overdue job.
 */
export function skipOverdueTodayOccurrences(
  occurrences: GeneratedOccurrence[],
  options: {
    timezone?: string | null;
    preferredStartTime?: string | null;
    now?: Date;
  }
): GeneratedOccurrence[] {
  const tz = options.timezone;
  const today = civilDateInTimeZone(tz, options.now);
  const nowHm = localTimeHHmmInTimeZone(tz, options.now);
  const preferred = String(options.preferredStartTime || '').trim().slice(0, 5);
  const hasTime = /^\d{2}:\d{2}$/.test(preferred);

  return occurrences.filter((occurrence) => {
    if (compareCivil(occurrence.occurrenceDate, today) < 0) return false;
    if (compareCivil(occurrence.occurrenceDate, today) > 0) return true;
    if (!hasTime) return true;
    return preferred > nowHm;
  });
}

export function formatTimezoneAbbreviation(
  timezone: string | null | undefined,
  date: string,
  time?: string | null
): string {
  if (!timezone || !isValidTimeZone(timezone)) return '';
  try {
    const clock = /^\d{2}:\d{2}$/.test(String(time || '').trim()) ? String(time).trim().slice(0, 5) : '12:00';
    const probe = new Date(`${date}T${clock}:00`);
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      timeZoneName: 'short'
    }).formatToParts(Number.isNaN(probe.getTime()) ? new Date() : probe);
    return parts.find((part) => part.type === 'timeZoneName')?.value || '';
  } catch {
    return '';
  }
}

export function generateOccurrences(
  input: RecurringSeriesInput,
  options?: { fromDate?: string; windowDays?: number; existingCount?: number; now?: Date; skipOverdueToday?: boolean }
): GeneratedOccurrence[] {
  const tz = input.timezone && isValidTimeZone(input.timezone) ? input.timezone.trim() : normalizeTimeZone(input.timezone);
  let rows = generateOccurrenceDates(input, options).map((date) =>
    buildOccurrenceSchedule(date, input.preferredStartTime, input.durationMinutes, tz)
  );
  if (options?.skipOverdueToday !== false) {
    rows = skipOverdueTodayOccurrences(rows, {
      timezone: tz,
      preferredStartTime: input.preferredStartTime,
      now: options?.now
    });
  }
  return rows;
}

/** Generation fromDate for an active series: never before start, never before local today. */
export function resolveGenerationFromDate(
  startDate: string,
  timezone?: string | null,
  now = new Date()
): string {
  const today = civilDateInTimeZone(timezone, now);
  return compareCivil(startDate, today) > 0 ? startDate : today;
}

function formatDisplayDate(date: string, locale?: string | null): string {
  const parts = parseDateParts(date);
  if (!parts) return '';
  try {
    return new Intl.DateTimeFormat(recurrenceLocaleTag(locale), {
      month: 'long',
      day: 'numeric',
      year: 'numeric',
      timeZone: 'UTC'
    }).format(new Date(Date.UTC(parts.y, parts.m - 1, parts.d)));
  } catch {
    return `${parts.y}-${String(parts.m).padStart(2, '0')}-${String(parts.d).padStart(2, '0')}`;
  }
}

function weekdayName(day: number, locale?: string | null): string {
  // 2024-01-07 is a Sunday in UTC.
  try {
    return new Intl.DateTimeFormat(recurrenceLocaleTag(locale), {
      weekday: 'long',
      timeZone: 'UTC'
    }).format(new Date(Date.UTC(2024, 0, 7 + day)));
  } catch {
    return WEEKDAY_LABELS[day] || 'day';
  }
}

function joinWeekdayNames(names: string[], locale?: string | null): string {
  const tag = String(locale || 'en').toLowerCase();
  if (names.length <= 1) return names[0] || '';
  if (tag.startsWith('es')) {
    return names.length === 2 ? `${names[0]} y ${names[1]}` : `${names.slice(0, -1).join(', ')} y ${names[names.length - 1]}`;
  }
  if (tag.startsWith('vi')) {
    return names.join(', ');
  }
  return names.length === 2 ? `${names[0]} and ${names[1]}` : `${names.slice(0, -1).join(', ')}, and ${names[names.length - 1]}`;
}

/** Language-aware recurrence summary. Never renders “starting .” when the start date is missing. */
export function summarizeRecurrenceForLocale(input: RecurringSeriesInput, locale?: string | null): string {
  const copy = getRecurrenceCopy(locale);
  const tag = String(locale || 'en').toLowerCase();

  if (input.frequency === 'none') {
    if (!parseDateParts(input.startDate)) return copy.selectStartDateToPreview;
    const dateLabel = formatDisplayDate(input.startDate, locale);
    const time = input.preferredStartTime ? ` ${formatTimeLabel(input.preferredStartTime)}` : '';
    if (tag.startsWith('es')) return `Trabajo único el ${dateLabel}${time}.`;
    if (tag.startsWith('vi')) return `Công việc một lần vào ${dateLabel}${time}.`;
    return `One-time job on ${dateLabel}${time ? ` at${time}` : ''}.`;
  }

  if (!parseDateParts(input.startDate)) {
    return copy.selectStartDateToPreview;
  }

  const { interval, intervalUnit } = resolveRecurrenceInterval(input);
  const weekdays = normalizeWeekdays(input);
  const dayNames = weekdays.map((day) => weekdayName(day, locale));
  const dayLabel = joinWeekdayNames(dayNames, locale);
  const hasTime = Boolean(input.preferredStartTime && /^\d{2}:\d{2}$/.test(input.preferredStartTime.trim()));
  const tzAbbrev = formatTimezoneAbbreviation(input.timezone, input.startDate, input.preferredStartTime);
  const timeLabel = hasTime
    ? ` ${formatTimeLabel(input.preferredStartTime!)}${tzAbbrev ? ` ${tzAbbrev}` : ''}`
    : '';
  const startLabel = formatDisplayDate(input.startDate, locale);
  const endMode = resolveRecurrenceEndMode(input);
  const endDateLabel =
    endMode === 'on_date' && input.endDate ? formatDisplayDate(input.endDate, locale) : '';
  const visitCount = endMode === 'after_count' && input.occurrenceLimit ? Number(input.occurrenceLimit) : 0;

  if (tag.startsWith('es')) {
    let cadence = 'Cada semana';
    if (input.frequency === 'daily' || (intervalUnit === 'days' && interval === 1)) cadence = 'Cada día';
    else if (intervalUnit === 'days') cadence = `Cada ${interval} días`;
    else if (input.frequency === 'biweekly' || (intervalUnit === 'weeks' && interval === 2)) cadence = 'Cada dos semanas';
    else if (input.frequency === 'every_three_weeks' || (intervalUnit === 'weeks' && interval === 3)) cadence = 'Cada tres semanas';
    else if (input.frequency === 'every_four_weeks' || (intervalUnit === 'weeks' && interval === 4)) cadence = 'Cada cuatro semanas';
    else if (input.frequency === 'monthly' || intervalUnit === 'months') {
      cadence = interval === 1 ? 'Cada mes' : `Cada ${interval} meses`;
    } else if (intervalUnit === 'weeks' && interval !== 1) cadence = `Cada ${interval} semanas`;
    const dayPart = intervalUnit === 'weeks' ? `, los ${dayLabel.toLowerCase()}` : '';
    const timePart = timeLabel ? ` a las${timeLabel}` : '';
    if (endDateLabel) return `${cadence}${dayPart}${timePart}, a partir del ${startLabel} y hasta el ${endDateLabel}.`;
    if (visitCount > 0) return `${cadence}${dayPart}${timePart}, a partir del ${startLabel}, durante ${visitCount} visitas.`;
    return `${cadence}${dayPart}${timePart}, a partir del ${startLabel}.`;
  }

  if (tag.startsWith('vi')) {
    let cadence = 'Lặp lại hàng tuần';
    if (input.frequency === 'daily' || (intervalUnit === 'days' && interval === 1)) cadence = 'Lặp lại hàng ngày';
    else if (intervalUnit === 'days') cadence = `Lặp lại mỗi ${interval} ngày`;
    else if (input.frequency === 'biweekly' || (intervalUnit === 'weeks' && interval === 2)) {
      cadence = 'Lặp lại hai tuần một lần';
    } else if (input.frequency === 'every_three_weeks' || (intervalUnit === 'weeks' && interval === 3)) {
      cadence = 'Lặp lại ba tuần một lần';
    } else if (input.frequency === 'every_four_weeks' || (intervalUnit === 'weeks' && interval === 4)) {
      cadence = 'Lặp lại bốn tuần một lần';
    } else if (input.frequency === 'monthly' || intervalUnit === 'months') {
      cadence = interval === 1 ? 'Lặp lại hàng tháng' : `Lặp lại mỗi ${interval} tháng`;
    } else if (intervalUnit === 'weeks' && interval !== 1) cadence = `Lặp lại mỗi ${interval} tuần`;
    const dayPart = intervalUnit === 'weeks' ? ` vào ${dayLabel}` : '';
    const timePart = timeLabel ? ` lúc${timeLabel}` : '';
    if (endDateLabel) {
      return `${cadence}${dayPart}${timePart}, bắt đầu từ ngày ${startLabel} và kết thúc vào ngày ${endDateLabel}.`;
    }
    if (visitCount > 0) {
      return `${cadence}${dayPart}${timePart}, bắt đầu từ ngày ${startLabel}, trong ${visitCount} lần ghé thăm.`;
    }
    return `${cadence}${dayPart}${timePart}, bắt đầu từ ngày ${startLabel}.`;
  }

  let cadence = 'Every week';
  if (input.frequency === 'daily' || (intervalUnit === 'days' && interval === 1)) cadence = 'Every day';
  else if (intervalUnit === 'days') cadence = `Every ${interval} days`;
  else if (input.frequency === 'biweekly' || (intervalUnit === 'weeks' && interval === 2)) cadence = 'Every two weeks';
  else if (input.frequency === 'every_three_weeks' || (intervalUnit === 'weeks' && interval === 3)) {
    cadence = 'Every three weeks';
  } else if (input.frequency === 'every_four_weeks' || (intervalUnit === 'weeks' && interval === 4)) {
    cadence = 'Every four weeks';
  } else if (input.frequency === 'monthly' || intervalUnit === 'months') {
    cadence = interval === 1 ? 'Every month' : `Every ${interval} months`;
  } else if (intervalUnit === 'weeks' && interval !== 1) cadence = `Every ${interval} weeks`;

  const dayPart = intervalUnit === 'weeks' ? ` on ${dayLabel}` : '';
  const timePart = timeLabel ? ` at${timeLabel}` : '';
  if (endDateLabel) return `${cadence}${dayPart}${timePart} starting ${startLabel} and ending ${endDateLabel}.`;
  if (visitCount > 0) return `${cadence}${dayPart}${timePart} starting ${startLabel} for ${visitCount} visits.`;
  return `${cadence}${dayPart}${timePart} starting ${startLabel}.`;
}

export function summarizeRecurrence(input: RecurringSeriesInput, locale?: string | null): string {
  return summarizeRecurrenceForLocale(input, locale);
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

/**
 * Normalize active schedule value to approximate monthly recurring revenue.
 * Not used for generated occurrence totals. Excludes paused/ended schedules in callers.
 */
export function normalizeScheduleToMrr(amount: number, input: RecurringSeriesInput): number {
  const value = Number(amount || 0);
  if (!Number.isFinite(value) || value <= 0) return 0;
  const { interval, intervalUnit } = resolveRecurrenceInterval(input);
  const safeInterval = Math.max(1, interval);
  if (intervalUnit === 'days') return (value * (365 / safeInterval)) / 12;
  if (intervalUnit === 'weeks') return (value * (52 / safeInterval)) / 12;
  return value / safeInterval;
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

export type ScheduledOccurrenceFinance = {
  price?: number | null;
  expected_contractor_cost?: number | null;
  expected_additional_expense?: number | null;
  status?: string | null;
  is_skipped?: boolean | null;
  occurrence_date?: string | null;
  recurring_series_id?: string | null;
};

function isActiveScheduledOccurrence(
  row: ScheduledOccurrenceFinance,
  asOfDate: string,
  options?: { includePastScheduled?: boolean; periodStart?: string | null; periodEnd?: string | null }
): boolean {
  if (isCancelledOrSkippedStatus(row.status, row.is_skipped)) return false;
  if (isCompletedLikeStatus(row.status)) return false;
  if (!row.occurrence_date) return false;
  if (!options?.includePastScheduled && compareCivil(row.occurrence_date, asOfDate) < 0) return false;
  if (options?.periodStart && compareCivil(row.occurrence_date, options.periodStart) < 0) return false;
  // periodEnd is exclusive (matches dashboard rangeBounds / inRange).
  if (options?.periodEnd && compareCivil(row.occurrence_date, options.periodEnd) >= 0) return false;
  return true;
}

/** Scheduled revenue = sum of client prices on generated active occurrences only (never unlimited). */
export function calculateScheduledRevenue(
  occurrences: ScheduledOccurrenceFinance[],
  asOfDate: string,
  options?: { includePastScheduled?: boolean; periodStart?: string | null; periodEnd?: string | null }
): number {
  let totalCents = 0;
  for (const row of occurrences) {
    if (!isActiveScheduledOccurrence(row, asOfDate, options)) continue;
    totalCents += dollarsToCents(row.price);
  }
  return centsToDollars(totalCents);
}

/** Aggregate expected finance for generated active occurrences inside a period/window. */
export function calculateScheduledExpectedFinance(
  occurrences: ScheduledOccurrenceFinance[],
  asOfDate: string,
  options?: { includePastScheduled?: boolean; periodStart?: string | null; periodEnd?: string | null }
): {
  scheduledRevenue: number;
  expectedContractorExpense: number;
  expectedAdditionalExpenses: number;
  expectedExpenses: number;
  expectedProfit: number;
  occurrenceCount: number;
} {
  let revenueCents = 0;
  let contractorCents = 0;
  let additionalCents = 0;
  let occurrenceCount = 0;
  for (const row of occurrences) {
    if (!isActiveScheduledOccurrence(row, asOfDate, options)) continue;
    occurrenceCount += 1;
    const finance = calculateExpectedJobFinance({
      clientPrice: row.price,
      contractorPay: row.expected_contractor_cost,
      additionalExpenses: row.expected_additional_expense
    });
    revenueCents += dollarsToCents(finance.expectedRevenue);
    contractorCents += dollarsToCents(finance.expectedContractorCost);
    additionalCents += dollarsToCents(finance.expectedAdditionalExpense);
  }
  const scheduledRevenue = centsToDollars(revenueCents);
  const expectedContractorExpense = centsToDollars(contractorCents);
  const expectedAdditionalExpenses = centsToDollars(additionalCents);
  return {
    scheduledRevenue,
    expectedContractorExpense,
    expectedAdditionalExpenses,
    expectedExpenses: addMoneyDollars(expectedContractorExpense, expectedAdditionalExpenses),
    expectedProfit: centsToDollars(revenueCents - contractorCents - additionalCents),
    occurrenceCount
  };
}

export function parseOccurrenceLocalTime(scheduledStart: string | null | undefined, preferredStartTime?: string | null): string {
  if (preferredStartTime && /^\d{2}:\d{2}/.test(preferredStartTime.trim())) {
    return preferredStartTime.trim().slice(0, 5);
  }
  if (!scheduledStart) return '';
  const match = String(scheduledStart).match(/T(\d{2}:\d{2})/);
  return match?.[1] || '';
}

export { parseMoneyDollars, calculateExpectedJobFinance, compareCivil, addDaysCivil, addMonthsCivil };
