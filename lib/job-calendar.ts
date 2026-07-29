import { appUrl } from '@/lib/app-url';
import type { CalendarEventInput } from '@/lib/calendar-links';

export type JobCalendarFields = {
  id: string;
  title: string;
  customer_name?: string | null;
  address?: string | null;
  notes?: string | null;
  customer_notes?: string | null;
  scheduled_start?: string | null;
  scheduled_end?: string | null;
  start_date?: string | null;
  due_date?: string | null;
  assignedNames?: string[];
};

function hasExplicitTimeZone(value: string): boolean {
  return /(?:[zZ]|[+-]\d{2}:?\d{2})$/.test(value.trim());
}

function asLocalWallClock(value: string): string {
  const match = value
    .trim()
    .match(/^(\d{4})-(\d{2})-(\d{2})[T\s](\d{2}):(\d{2})(?::(\d{2}))?/);
  if (!match) return value;
  return `${match[1]}-${match[2]}-${match[3]}T${match[4]}:${match[5]}:${match[6] || '00'}`;
}

function addHours(value: string, hours: number): string {
  if (hasExplicitTimeZone(value)) {
    const instant = new Date(value);
    if (!Number.isNaN(instant.getTime())) {
      return new Date(instant.getTime() + hours * 60 * 60 * 1000).toISOString();
    }
  }

  const match = value
    .trim()
    .match(/^(\d{4})-(\d{2})-(\d{2})[T\s](\d{2}):(\d{2})(?::(\d{2}))?/);
  if (!match) return value;

  const date = new Date(
    Date.UTC(
      Number(match[1]),
      Number(match[2]) - 1,
      Number(match[3]),
      Number(match[4]) + hours,
      Number(match[5]),
      Number(match[6] || '0')
    )
  );

  return date.toISOString().replace(/\.000Z$/, '');
}

function calendarDateTime(value: string): string {
  return hasExplicitTimeZone(value) ? value.trim() : asLocalWallClock(value);
}

function resolveJobWindow(job: JobCalendarFields): { startsAt: string; endsAt: string } | null {
  if (job.scheduled_start) {
    const startsAt = calendarDateTime(job.scheduled_start);
    const endsAt = job.scheduled_end
      ? calendarDateTime(job.scheduled_end)
      : addHours(startsAt, 2);
    return { startsAt, endsAt };
  }

  const day = job.start_date || job.due_date;
  if (!day) return null;

  if (!day.includes('T')) {
    const startsAt = `${day}T09:00:00`;
    return { startsAt, endsAt: `${day}T11:00:00` };
  }

  const startsAt = calendarDateTime(day);
  return { startsAt, endsAt: addHours(startsAt, 2) };
}

/** Calendar-safe job event: no internal notes, invoices, or financial fields. */
export function jobCalendarEvent(job: JobCalendarFields): CalendarEventInput | null {
  const window = resolveJobWindow(job);
  if (!window) return null;

  const lines = [
    job.customer_name ? `Customer: ${job.customer_name}` : null,
    job.notes?.trim() || job.customer_notes?.trim()
      ? `Instructions: ${(job.notes || job.customer_notes || '').trim()}`
      : null,
    job.assignedNames?.length ? `Assigned: ${job.assignedNames.join(', ')}` : null,
    `EverittOS: ${appUrl(`/jobs/${job.id}`)}`
  ].filter(Boolean);

  return {
    id: job.id,
    title: job.title,
    description: lines.join('\n'),
    location: job.address || undefined,
    startsAt: window.startsAt,
    endsAt: window.endsAt
  };
}
