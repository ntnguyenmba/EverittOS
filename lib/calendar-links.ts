import { bookingIcsFilename, generateBookingIcs } from '@/lib/booking/ics';

export type CalendarEventInput = {
  id: string;
  title: string;
  description?: string;
  location?: string;
  startsAt: string;
  endsAt?: string;
};

function toUtcStamp(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return date.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
}

function ensureEnd(startsAt: string, endsAt?: string): string {
  if (endsAt) return endsAt;
  const start = new Date(startsAt);
  if (Number.isNaN(start.getTime())) return startsAt;
  return new Date(start.getTime() + 2 * 60 * 60 * 1000).toISOString();
}

/** Google Calendar template URL for a one-time event. */
export function googleCalendarEventUrl(input: CalendarEventInput): string {
  const endsAt = ensureEnd(input.startsAt, input.endsAt);
  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: input.title,
    dates: `${toUtcStamp(input.startsAt)}/${toUtcStamp(endsAt)}`
  });
  if (input.description?.trim()) params.set('details', input.description.trim());
  if (input.location?.trim()) params.set('location', input.location.trim());
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

/** Outlook web compose URL for a one-time event. */
export function outlookCalendarEventUrl(input: CalendarEventInput): string {
  const endsAt = ensureEnd(input.startsAt, input.endsAt);
  const params = new URLSearchParams({
    path: '/calendar/action/compose',
    rru: 'addevent',
    subject: input.title,
    startdt: new Date(input.startsAt).toISOString(),
    enddt: new Date(endsAt).toISOString()
  });
  if (input.description?.trim()) params.set('body', input.description.trim());
  if (input.location?.trim()) params.set('location', input.location.trim());
  return `https://outlook.live.com/calendar/0/deeplink/compose?${params.toString()}`;
}

export function downloadCalendarIcs(input: CalendarEventInput): void {
  const endsAt = ensureEnd(input.startsAt, input.endsAt);
  const ics = generateBookingIcs({
    uid: input.id,
    title: input.title,
    description: input.description,
    location: input.location,
    startsAt: input.startsAt,
    endsAt
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
}): CalendarEventInput | null {
  if (!job.date) return null;
  const startsAt = job.date.includes('T') ? job.date : `${job.date}T09:00:00.000Z`;
  return {
    id: job.id,
    title: job.title,
    description: job.customerName ? `Customer: ${job.customerName}` : undefined,
    location: job.address || undefined,
    startsAt
  };
}
