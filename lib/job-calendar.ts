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

/**
 * jobs.scheduled_start/end are timestamptz columns used as UTC-backed wall-clock
 * storage. Supabase returns a trailing Z even though the written date and clock
 * components are the business-local appointment time. Calendar providers must
 * receive those components without Z and with the workspace IANA timezone.
 */
function asJobWallClock(value: string): string {
  const match = value
    .trim()
    .match(/^(\d{4})-(\d{2})-(\d{2})[T\s](\d{2}):(\d{2})(?::(\d{2}))?/);
  if (!match) return value;
  return `${match[1]}-${match[2]}-${match[3]}T${match[4]}:${match[5]}:${match[6] || '00'}`;
}

function addHours(value: string, hours: number): string {
  const match = asJobWallClock(value).match(
    /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})$/
  );
  if (!match) return value;

  const date = new Date(
    Date.UTC(
      Number(match[1]),
      Number(match[2]) - 1,
      Number(match[3]),
      Number(match[4]) + hours,
      Number(match[5]),
      Number(match[6])
    )
  );

  return date.toISOString().replace(/\.000Z$/, '');
}

function resolveJobWindow(job: JobCalendarFields): { startsAt: string; endsAt: string } | null {
  if (job.scheduled_start) {
    const startsAt = asJobWallClock(job.scheduled_start);
    const endsAt = job.scheduled_end
      ? asJobWallClock(job.scheduled_end)
      : addHours(startsAt, 2);
    return { startsAt, endsAt };
  }

  const day = job.start_date || job.due_date;
  if (!day) return null;

  if (!day.includes('T')) {
    const startsAt = `${day}T09:00:00`;
    return { startsAt, endsAt: `${day}T11:00:00` };
  }

  const startsAt = asJobWallClock(day);
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
