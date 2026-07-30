export type BookingIcsInput = {
  uid: string;
  title: string;
  description?: string;
  location?: string;
  startsAt: string;
  endsAt: string;
  timeZone?: string;
  organizerName?: string;
  organizerEmail?: string;
  lastModified?: string;
  sequence?: number;
};

function isValidTimeZone(value: string): boolean {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: value }).format();
    return true;
  } catch {
    return false;
  }
}

function hasExplicitTimeZone(value: string): boolean {
  return /(?:[zZ]|[+-]\d{2}:?\d{2})$/.test(value.trim());
}

function formatUtcIcsDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return date.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
}

type WallClockParts = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
};

function parseWallClock(value: string): WallClockParts | null {
  const match = value
    .trim()
    .match(/^(\d{4})-(\d{2})-(\d{2})[T\s](\d{2}):(\d{2})(?::(\d{2}))?/);
  if (!match) return null;

  return {
    year: Number(match[1]),
    month: Number(match[2]),
    day: Number(match[3]),
    hour: Number(match[4]),
    minute: Number(match[5]),
    second: Number(match[6] || '0')
  };
}

function partsInTimeZone(date: Date, timeZone: string): WallClockParts | null {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hour12: false,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  });
  const values = Object.fromEntries(
    formatter
      .formatToParts(date)
      .filter((part) => part.type !== 'literal')
      .map((part) => [part.type, Number(part.value)])
  );
  if (!values.year || !values.month || !values.day) return null;

  return {
    year: values.year,
    month: values.month,
    day: values.day,
    hour: values.hour === 24 ? 0 : values.hour,
    minute: values.minute,
    second: values.second
  };
}

/** Convert a business-local wall-clock timestamp into the matching UTC instant. */
function wallClockToUtcIso(value: string, timeZone: string): string {
  const desired = parseWallClock(value);
  if (!desired) return '';

  const desiredAsUtc = Date.UTC(
    desired.year,
    desired.month - 1,
    desired.day,
    desired.hour,
    desired.minute,
    desired.second
  );
  let candidate = new Date(desiredAsUtc);

  // Two passes handle daylight-saving offsets without relying on the server timezone.
  for (let pass = 0; pass < 2; pass += 1) {
    const represented = partsInTimeZone(candidate, timeZone);
    if (!represented) return '';
    const representedAsUtc = Date.UTC(
      represented.year,
      represented.month - 1,
      represented.day,
      represented.hour,
      represented.minute,
      represented.second
    );
    candidate = new Date(candidate.getTime() + (desiredAsUtc - representedAsUtc));
  }

  return candidate.toISOString();
}

function escapeIcsText(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/,/g, '\\,').replace(/;/g, '\\;');
}

/** Generate RFC 5545 ICS content for a booking or job calendar event. */
export function generateBookingIcs(input: BookingIcsInput): string {
  const requestedTimeZone = input.timeZone?.trim() || '';
  const timeZone = requestedTimeZone && isValidTimeZone(requestedTimeZone) ? requestedTimeZone : null;
  const normalizedStart = timeZone && !hasExplicitTimeZone(input.startsAt)
    ? wallClockToUtcIso(input.startsAt, timeZone)
    : input.startsAt;
  const normalizedEnd = timeZone && !hasExplicitTimeZone(input.endsAt)
    ? wallClockToUtcIso(input.endsAt, timeZone)
    : input.endsAt;
  const dtStart = formatUtcIcsDate(normalizedStart);
  const dtEnd = formatUtcIcsDate(normalizedEnd);
  const dtStamp = formatUtcIcsDate(new Date().toISOString());
  const lastModified = input.lastModified ? formatUtcIcsDate(input.lastModified) : '';
  const sequence = Number.isInteger(input.sequence) && input.sequence! >= 0 ? input.sequence : null;
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//EverittOS//Booking//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    timeZone ? `X-WR-TIMEZONE:${escapeIcsText(timeZone)}` : null,
    'BEGIN:VEVENT',
    `UID:${escapeIcsText(input.uid)}@everittos.com`,
    `DTSTAMP:${dtStamp}`,
    lastModified ? `LAST-MODIFIED:${lastModified}` : null,
    sequence !== null ? `SEQUENCE:${sequence}` : null,
    `DTSTART:${dtStart}`,
    `DTEND:${dtEnd}`,
    `SUMMARY:${escapeIcsText(input.title)}`
  ].filter((line): line is string => Boolean(line));

  if (input.description?.trim()) {
    lines.push(`DESCRIPTION:${escapeIcsText(input.description.trim())}`);
  }
  if (input.location?.trim()) {
    lines.push(`LOCATION:${escapeIcsText(input.location.trim())}`);
  }
  if (input.organizerEmail?.trim()) {
    const organizer = input.organizerName?.trim()
      ? `${escapeIcsText(input.organizerName.trim())}:mailto:${input.organizerEmail.trim()}`
      : `mailto:${input.organizerEmail.trim()}`;
    lines.push(`ORGANIZER;CN=${organizer}`);
  }

  lines.push('END:VEVENT', 'END:VCALENDAR');
  return `${lines.join('\r\n')}\r\n`;
}

export function bookingIcsFilename(bookingId: string): string {
  return `everittos-booking-${bookingId.slice(0, 8)}.ics`;
}
