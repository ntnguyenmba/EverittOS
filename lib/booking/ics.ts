export type BookingIcsInput = {
  uid: string;
  title: string;
  description?: string;
  location?: string;
  startsAt: string;
  endsAt: string;
  organizerName?: string;
  organizerEmail?: string;
};

function formatIcsDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return date.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
}

function escapeIcsText(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/,/g, '\\,').replace(/;/g, '\\;');
}

/** Generate RFC 5545 ICS content for a booking (ready for email attachment later). */
export function generateBookingIcs(input: BookingIcsInput): string {
  const dtStart = formatIcsDate(input.startsAt);
  const dtEnd = formatIcsDate(input.endsAt);
  const dtStamp = formatIcsDate(new Date().toISOString());
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//EverittOS//Booking//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${escapeIcsText(input.uid)}@everittos.com`,
    `DTSTAMP:${dtStamp}`,
    `DTSTART:${dtStart}`,
    `DTEND:${dtEnd}`,
    `SUMMARY:${escapeIcsText(input.title)}`
  ];

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
