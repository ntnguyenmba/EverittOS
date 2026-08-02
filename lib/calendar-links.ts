import { bookingIcsFilename, generateBookingIcs } from '@/lib/booking/ics';

export type CalendarEventInput = {
  id: string;
  title: string;
  description?: string;
  location?: string;
  startsAt: string;
  endsAt?: string;
  timeZone?: string;
};

function hasExplicitTimeZone(value: string): boolean {
  return /(?:[zZ]|[+-]\d{2}:?\d{2})$/.test(value.trim());
}

function parseWallClock(value: string): number[] | null {
  const match = value
    .trim()
    .match(/^(\d{4})-(\d{2})-(\d{2})[T\s](\d{2}):(\d{2})(?::(\d{2}))?/);
  if (!match) return null;
  return match.slice(1, 7).map((part) => Number(part || 0));
}

function isValidTimeZone(value: string): boolean {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: value }).format();
    return true;
  } catch {
    return false;
  }
}

function wallClockToUtcIso(value: string, timeZone: string): string | null {
  const parts = parseWallClock(value);
  if (!parts || !isValidTimeZone(timeZone)) return null;
  const [year, month, day, hour, minute, second] = parts;
  const targetWallClock = Date.UTC(year, month - 1, day, hour, minute, second);
  let instant = targetWallClock;
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23'
  });

  for (let attempt = 0; attempt < 3; attempt += 1) {
    const formatted = Object.fromEntries(
      formatter
        .formatToParts(new Date(instant))
        .filter((part) => part.type !== 'literal')
        .map((part) => [part.type, Number(part.value)])
    ) as Record<string, number>;
    const renderedWallClock = Date.UTC(
      formatted.year,
      formatted.month - 1,
      formatted.day,
      formatted.hour,
      formatted.minute,
      formatted.second
    );
    const adjustment = targetWallClock - renderedWallClock;
    instant += adjustment;
    if (adjustment === 0) break;
  }

  return new Date(instant).toISOString();
}

function calendarInstant(value: string, timeZone?: string): string {
  if (!hasExplicitTimeZone(value) && timeZone?.trim()) {
    const converted = wallClockToUtcIso(value, timeZone.trim());
    if (converted) return converted;
  }
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toISOString();
}

function toUtcStamp(value: string, timeZone?: string): string {
  const date = new Date(calendarInstant(value, timeZone));
  if (Number.isNaN(date.getTime())) return '';
  return date.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
}

function ensureEnd(startsAt: string, endsAt?: string): string {
  if (endsAt) return endsAt;
  const parts = parseWallClock(startsAt);
  if (parts && !hasExplicitTimeZone(startsAt)) {
    const [year, month, day, hour, minute, second] = parts;
    const end = new Date(Date.UTC(year, month - 1, day, hour + 2, minute, second));
    return end.toISOString().replace(/\.000Z$/, '');
  }
  const start = new Date(startsAt);
  if (Number.isNaN(start.getTime())) return startsAt;
  return new Date(start.getTime() + 2 * 60 * 60 * 1000).toISOString();
}

function browserTimeZone(): string | undefined {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || undefined;
  } catch {
    return undefined;
  }
}

/** Google Calendar template URL for a one-time event. */
export function googleCalendarEventUrl(input: CalendarEventInput): string {
  const endsAt = ensureEnd(input.startsAt, input.endsAt);
  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: input.title,
    dates: `${toUtcStamp(input.startsAt, input.timeZone)}/${toUtcStamp(endsAt, input.timeZone)}`
  });
  if (input.description?.trim()) params.set('details', input.description.trim());
  if (input.location?.trim()) params.set('location', input.location.trim());
  if (input.timeZone?.trim()) params.set('ctz', input.timeZone.trim());
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

/** Outlook web compose URL for a one-time event. */
export function outlookCalendarEventUrl(input: CalendarEventInput): string {
  const endsAt = ensureEnd(input.startsAt, input.endsAt);
  const params = new URLSearchParams({
    path: '/calendar/action/compose',
    rru: 'addevent',
    subject: input.title,
    startdt: calendarInstant(input.startsAt, input.timeZone),
    enddt: calendarInstant(endsAt, input.timeZone)
  });
  if (input.description?.trim()) params.set('body', input.description.trim());
  if (input.location?.trim()) params.set('location', input.location.trim());
  return `https://outlook.live.com/calendar/0/deeplink/compose?${params.toString()}`;
}

export function downloadCalendarIcs(input: CalendarEventInput): void {
  const endsAt = ensureEnd(input.startsAt, input.endsAt);
  const timeZone = input.timeZone || browserTimeZone();
  const ics = generateBookingIcs({
    uid: input.id,
    title: input.title,
    description: input.description,
    location: input.location,
    startsAt: input.startsAt,
    endsAt,
    timeZone
  });
  const blob = new Blob([ics], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = bookingIcsFilename(input.id);
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

/** Build a contractor-safe calendar description (no internal finance/notes). */
export function contractorJobCalendarEvent(job: {
  id: string;
  title: string;
  customerName?: string | null;
  address?: string | null;
  date?: string | null;
  timeZone?: string;
}): CalendarEventInput | null {
  if (!job.date) return null;
  const startsAt = job.date.includes('T') ? job.date : `${job.date}T09:00:00`;
  return {
    id: job.id,
    title: job.title,
    description: job.customerName ? `Customer: ${job.customerName}` : undefined,
    location: job.address || undefined,
    startsAt,
    timeZone: job.timeZone
  };
}
