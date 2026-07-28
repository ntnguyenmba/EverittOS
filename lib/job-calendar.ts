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

function resolveJobWindow(job: JobCalendarFields): { startsAt: string; endsAt: string } | null {
  if (job.scheduled_start) {
    const startsAt = job.scheduled_start;
    const endsAt =
      job.scheduled_end ||
      new Date(new Date(startsAt).getTime() + 2 * 60 * 60 * 1000).toISOString();
    return { startsAt, endsAt };
  }

  const day = job.start_date || job.due_date;
  if (!day) return null;
  const startsAt = day.includes('T') ? day : `${day}T09:00:00.000Z`;
  const endsAt = new Date(new Date(startsAt).getTime() + 2 * 60 * 60 * 1000).toISOString();
  return { startsAt, endsAt };
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
