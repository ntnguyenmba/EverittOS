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

function formatWallClockIcsDate(value: string, timeZone: string): string {
  const trimmed = value.trim();
  if (!hasExplicitTimeZone(trimmed)) {
    const match = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})[T\s](\d{2}):(\d{2})(?::(\d{2}))?/);
    if (!match) return '';
    return `${match[1]}${match[2]}${match[3]}T${match[4]}${match[5]}${match[6] || '00'}`;
  }

  const date = new Date(trimmed);
  if (Number.isNaN(date.getTime())) return '';
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
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}${values.month}${values.day}T${values.hour}${values.minute}${values.second}`;
}

function escapeIcsText(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/,/g, '\\,').replace(/;/g, '\\;');
}

/** Generate RFC 5545 ICS content for a booking or job calendar event. */
export function generateBookingIcs(input: BookingIcsInput): string {
  const requestedTimeZone = input.timeZone?.trim() || '';
  const timeZone = requestedTimeZone && isValidTimeZone(requestedTimeZone) ? requestedTimeZone : null;
  const dtStart = timeZone ? formatWallClockIcsDate(input.startsAt, timeZone) : formatUtcIcsDate(input.startsAt);
  const dtEnd = timeZone ? formatWallClockIcsDate(input.endsAt, timeZone) : formatUtcIcsDate(input.endsAt);
  const dtStamp = formatUtcIcsDate(new Date().toISOString());
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
    timeZone ? `DTSTART;TZID=${escapeIcsText(timeZone)}:${dtStart}` : `DTSTART:${dtStart}`,
    timeZone ? `DTEND;TZID=${escapeIcsText(timeZone)}:${dtEnd}` : `DTEND:${dtEnd}`,
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
