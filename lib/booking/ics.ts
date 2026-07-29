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

function formatWallClockIcsDate(value: string): string {
  const match = value
    .trim()
    .match(/^(\d{4})-(\d{2})-(\d{2})[T\s](\d{2}):(\d{2})(?::(\d{2}))?/);
  if (!match) return '';
  return `${match[1]}${match[2]}${match[3]}T${match[4]}${match[5]}${match[6] || '00'}`;
}

function escapeIcsText(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/,/g, '\\,').replace(/;/g, '\\;');
}

/** Generate RFC 5545 ICS content for a booking or job calendar event. */
export function generateBookingIcs(input: BookingIcsInput): string {
  const requestedTimeZone = input.timeZone?.trim() || '';
  const timeZone = requestedTimeZone && isValidTimeZone(requestedTimeZone) ? requestedTimeZone : null;
  const startUsesTimeZone = Boolean(timeZone && !hasExplicitTimeZone(input.startsAt));
  const endUsesTimeZone = Boolean(timeZone && !hasExplicitTimeZone(input.endsAt));
  const dtStart = startUsesTimeZone ? formatWallClockIcsDate(input.startsAt) : formatUtcIcsDate(input.startsAt);
  const dtEnd = endUsesTimeZone ? formatWallClockIcsDate(input.endsAt) : formatUtcIcsDate(input.endsAt);
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
    startUsesTimeZone
      ? `DTSTART;TZID=${escapeIcsText(timeZone!)}:${dtStart}`
      : `DTSTART:${dtStart}`,
    endUsesTimeZone
      ? `DTEND;TZID=${escapeIcsText(timeZone!)}:${dtEnd}`
      : `DTEND:${dtEnd}`,
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
