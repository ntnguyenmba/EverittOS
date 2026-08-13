import { isValidTimeZone } from '@/lib/time-zones';
import type { ParsedCalendarEvent } from '@/lib/calendar-import/types';

type IcsProperty = {
  name: string;
  params: Record<string, string>;
  value: string;
};

function unfoldIcs(source: string): string[] {
  const raw = source.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');
  const lines: string[] = [];
  for (const line of raw) {
    if ((line.startsWith(' ') || line.startsWith('\t')) && lines.length > 0) {
      lines[lines.length - 1] += line.slice(1);
    } else {
      lines.push(line);
    }
  }
  return lines.filter((line) => line.length > 0);
}

export function unescapeIcsText(value: string): string {
  return value
    .replace(/\\n/gi, '\n')
    .replace(/\\,/g, ',')
    .replace(/\\;/g, ';')
    .replace(/\\\\/g, '\\');
}

function parseIcsProperty(line: string): IcsProperty | null {
  const colon = line.indexOf(':');
  if (colon <= 0) return null;
  const meta = line.slice(0, colon);
  const value = line.slice(colon + 1);
  const parts = meta.split(';');
  const name = (parts.shift() || '').trim().toUpperCase();
  if (!name) return null;
  const params: Record<string, string> = {};
  for (const part of parts) {
    const eq = part.indexOf('=');
    if (eq <= 0) continue;
    const key = part.slice(0, eq).trim().toUpperCase();
    let raw = part.slice(eq + 1).trim();
    if (raw.startsWith('"') && raw.endsWith('"') && raw.length >= 2) {
      raw = raw.slice(1, -1);
    }
    params[key] = raw;
  }
  return { name, params, value };
}

function pad2(value: number): string {
  return String(value).padStart(2, '0');
}

function formatWallClock(year: number, month: number, day: number, hour = 0, minute = 0, second = 0): string {
  return `${year}-${pad2(month)}-${pad2(day)}T${pad2(hour)}:${pad2(minute)}:${pad2(second)}`;
}

function formatDateOnly(year: number, month: number, day: number): string {
  return `${year}-${pad2(month)}-${pad2(day)}`;
}

function addDays(dateStr: string, days: number): string {
  const match = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return dateStr;
  const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
  date.setUTCDate(date.getUTCDate() + days);
  return formatDateOnly(date.getUTCFullYear(), date.getUTCMonth() + 1, date.getUTCDate());
}

function parseIcsDateParts(value: string): {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
  utc: boolean;
  dateOnly: boolean;
} | null {
  const trimmed = value.trim();
  const dateOnly = /^(\d{4})-?(\d{2})-?(\d{2})$/.exec(trimmed);
  if (dateOnly) {
    return {
      year: Number(dateOnly[1]),
      month: Number(dateOnly[2]),
      day: Number(dateOnly[3]),
      hour: 0,
      minute: 0,
      second: 0,
      utc: false,
      dateOnly: true
    };
  }
  const dateTime =
    /^(\d{4})-?(\d{2})-?(\d{2})[T ](\d{2}):?(\d{2})(?::?(\d{2}))?(?:\.(\d+))?(Z|[+-]\d{2}:?\d{2})?$/i.exec(
      trimmed
    );
  if (!dateTime) return null;
  return {
    year: Number(dateTime[1]),
    month: Number(dateTime[2]),
    day: Number(dateTime[3]),
    hour: Number(dateTime[4]),
    minute: Number(dateTime[5]),
    second: Number(dateTime[6] || '0'),
    utc: Boolean(dateTime[8] && (dateTime[8] === 'Z' || dateTime[8] === 'z' || dateTime[8].startsWith('+') || dateTime[8].startsWith('-'))),
    dateOnly: false
  };
}

function utcPartsInTimeZone(
  isoUtc: string,
  timeZone: string
): { year: number; month: number; day: number; hour: number; minute: number; second: number } | null {
  try {
    const date = new Date(isoUtc);
    if (Number.isNaN(date.getTime())) return null;
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hourCycle: 'h23'
    }).formatToParts(date);
    const read = (type: string) => Number(parts.find((part) => part.type === type)?.value || '0');
    return {
      year: read('year'),
      month: read('month'),
      day: read('day'),
      hour: read('hour'),
      minute: read('minute'),
      second: read('second')
    };
  } catch {
    return null;
  }
}

const WINDOWS_TIME_ZONES: Record<string, string> = {
  'central standard time': 'America/Chicago',
  'central daylight time': 'America/Chicago',
  'eastern standard time': 'America/New_York',
  'pacific standard time': 'America/Los_Angeles',
  'mountain standard time': 'America/Denver'
};

function normalizeTimeZoneName(value: string): string {
  const trimmed = value.trim().replace(/^\/+/, '');
  return WINDOWS_TIME_ZONES[trimmed.toLowerCase()] || trimmed;
}

function resolveTimeZone(candidate: string | null | undefined, fallback: string | null): string | null {
  const value = normalizeTimeZoneName(candidate || '');
  if (value && isValidTimeZone(value)) return value;
  const next = normalizeTimeZoneName(fallback || '');
  if (next && isValidTimeZone(next)) return next;
  return null;
}

function addDurationToWallClock(start: string, duration: string): string | null {
  const match = start.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})$/);
  const durationMatch = duration.trim().toUpperCase().match(/^P(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?)?$/);
  if (!match || !durationMatch) return null;
  const date = new Date(
    Date.UTC(
      Number(match[1]),
      Number(match[2]) - 1,
      Number(match[3]),
      Number(match[4]),
      Number(match[5]),
      Number(match[6])
    )
  );
  date.setUTCDate(date.getUTCDate() + Number(durationMatch[1] || 0));
  date.setUTCHours(date.getUTCHours() + Number(durationMatch[2] || 0));
  date.setUTCMinutes(date.getUTCMinutes() + Number(durationMatch[3] || 0));
  date.setUTCSeconds(date.getUTCSeconds() + Number(durationMatch[4] || 0));
  return formatWallClock(
    date.getUTCFullYear(),
    date.getUTCMonth() + 1,
    date.getUTCDate(),
    date.getUTCHours(),
    date.getUTCMinutes(),
    date.getUTCSeconds()
  );
}

export function parseIcsDateTime(
  value: string,
  params: Record<string, string> = {},
  fallbackTimeZone: string | null = null
): { wallClock: string | null; date: string | null; timezone: string | null; allDay: boolean; utcIso: string | null } {
  const parts = parseIcsDateParts(value);
  if (!parts) {
    return { wallClock: null, date: null, timezone: null, allDay: false, utcIso: null };
  }

  const valueType = (params.VALUE || '').toUpperCase();
  const allDay = parts.dateOnly || valueType === 'DATE';
  const tzid = resolveTimeZone(params.TZID, fallbackTimeZone);

  if (allDay) {
    const date = formatDateOnly(parts.year, parts.month, parts.day);
    return {
      wallClock: `${date}T00:00:00`,
      date,
      timezone: tzid,
      allDay: true,
      utcIso: null
    };
  }

  if (parts.utc) {
    const utcIso = `${formatWallClock(parts.year, parts.month, parts.day, parts.hour, parts.minute, parts.second)}Z`;
    const zone = tzid || 'UTC';
    const zoned = zone === 'UTC' ? parts : utcPartsInTimeZone(utcIso, zone);
    if (!zoned) {
      return {
        wallClock: formatWallClock(parts.year, parts.month, parts.day, parts.hour, parts.minute, parts.second),
        date: formatDateOnly(parts.year, parts.month, parts.day),
        timezone: 'UTC',
        allDay: false,
        utcIso
      };
    }
    return {
      wallClock: formatWallClock(zoned.year, zoned.month, zoned.day, zoned.hour, zoned.minute, zoned.second),
      date: formatDateOnly(zoned.year, zoned.month, zoned.day),
      timezone: zone,
      allDay: false,
      utcIso
    };
  }

  return {
    wallClock: formatWallClock(parts.year, parts.month, parts.day, parts.hour, parts.minute, parts.second),
    date: formatDateOnly(parts.year, parts.month, parts.day),
    timezone: tzid,
    allDay: false,
    utcIso: null
  };
}

function readEventField(block: IcsProperty[], name: string): IcsProperty | null {
  return block.find((property) => property.name === name) || null;
}

function eventFromBlock(block: IcsProperty[], calendarTimeZone: string | null): ParsedCalendarEvent {
  const uid = unescapeIcsText(readEventField(block, 'UID')?.value || '').trim();

  const summaryProp = readEventField(block, 'SUMMARY');
  const descriptionProp = readEventField(block, 'DESCRIPTION');
  const locationProp = readEventField(block, 'LOCATION');
  const startProp = readEventField(block, 'DTSTART');
  const endProp = readEventField(block, 'DTEND');
  const durationProp = readEventField(block, 'DURATION');
  const lastModifiedProp = readEventField(block, 'LAST-MODIFIED') || readEventField(block, 'DTSTAMP');
  const status = unescapeIcsText(readEventField(block, 'STATUS')?.value || '')
    .trim()
    .toUpperCase();

  const start = startProp
    ? parseIcsDateTime(startProp.value, startProp.params, calendarTimeZone)
    : { wallClock: null, date: null, timezone: calendarTimeZone, allDay: false, utcIso: null };
  let end = endProp
    ? parseIcsDateTime(endProp.value, endProp.params, start.timezone || calendarTimeZone)
    : { wallClock: null, date: null, timezone: start.timezone, allDay: start.allDay, utcIso: null };
  if (!end.wallClock && start.wallClock && durationProp?.value) {
    const durationEnd = addDurationToWallClock(start.wallClock, durationProp.value);
    if (durationEnd) {
      end = {
        wallClock: durationEnd,
        date: durationEnd.slice(0, 10),
        timezone: start.timezone,
        allDay: start.allDay,
        utcIso: null
      };
    }
  }

  let endDate = end.date;
  if (start.allDay && endDate && start.date && endDate > start.date) {
    endDate = addDays(endDate, -1);
  }

  const lastModified = lastModifiedProp
    ? parseIcsDateTime(lastModifiedProp.value, lastModifiedProp.params, 'UTC')
    : null;

  return {
    uid,
    summary: unescapeIcsText(summaryProp?.value || '').trim(),
    description: unescapeIcsText(descriptionProp?.value || '').trim() || null,
    location: unescapeIcsText(locationProp?.value || '').trim() || null,
    dtStart: start.wallClock,
    dtEnd: end.wallClock,
    startDate: start.date,
    endDate: endDate || start.date,
    timezone: start.timezone || end.timezone || calendarTimeZone,
    lastModified: lastModified?.utcIso || (lastModified?.wallClock ? `${lastModified.wallClock}Z` : null),
    status: status || null,
    allDay: start.allDay
  };
}

export function parseIcsCalendar(source: string, fallbackTimeZone: string | null = null): ParsedCalendarEvent[] {
  const lines = unfoldIcs(source);
  const events: ParsedCalendarEvent[] = [];
  let calendarTimeZone = fallbackTimeZone;
  let inEvent = false;
  let block: IcsProperty[] = [];

  for (const line of lines) {
    const property = parseIcsProperty(line);
    if (!property) continue;

    if (property.name === 'X-WR-TIMEZONE' && !inEvent) {
      calendarTimeZone = resolveTimeZone(unescapeIcsText(property.value), calendarTimeZone);
      continue;
    }

    if (property.name === 'BEGIN' && property.value.trim().toUpperCase() === 'VEVENT') {
      inEvent = true;
      block = [];
      continue;
    }

    if (property.name === 'END' && property.value.trim().toUpperCase() === 'VEVENT') {
      const event = eventFromBlock(block, calendarTimeZone);
      if (event) events.push(event);
      inEvent = false;
      block = [];
      continue;
    }

    if (inEvent) block.push(property);
  }

  return events;
}

export function looksLikeIcsCalendar(source: string): boolean {
  const normalized = source.replace(/^\uFEFF/, '').trimStart().toUpperCase();
  return normalized.includes('BEGIN:VCALENDAR') && normalized.includes('BEGIN:VEVENT');
}
