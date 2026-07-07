import type { ScheduleJob } from '@/components/schedule-views';

function isIsoDate(value: string | null | undefined): value is string {
  return Boolean(value && /^\d{4}-\d{2}-\d{2}$/.test(value));
}

function dateFromDateTime(value: string | null | undefined): string | null {
  if (!value) return null;
  const direct = value.slice(0, 10);
  if (isIsoDate(direct)) return direct;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString().slice(0, 10);
}

export function legacyScheduleRange(job: ScheduleJob): { start: string | null; end: string | null } {
  const dates = [
    job.start_date,
    job.due_date,
    dateFromDateTime(job.scheduled_start),
    dateFromDateTime(job.scheduled_end)
  ].filter(isIsoDate).sort();

  return {
    start: dates[0] || null,
    end: dates[dates.length - 1] || null
  };
}
