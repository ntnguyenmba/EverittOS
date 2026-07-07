import type { ScheduleJob } from '@/components/schedule-views';
import { legacyScheduleRange } from '@/lib/legacy-schedule-range';

export type ScheduleVisit = {
  id: string;
  job_id: string;
  visit_date: string;
  start_time: string;
  end_time: string;
  notes: string | null;
};

function addDays(dateKey: string, days: number): string {
  const date = new Date(`${dateKey}T00:00:00`);
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}

function timeFromDateTime(value: string | null | undefined, fallback: string): string {
  if (!value) return fallback;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return fallback;
  return date.toTimeString().slice(0, 5);
}

function fallbackRangeEntries(job: ScheduleJob): ScheduleJob[] {
  const { start, end } = legacyScheduleRange(job);
  if (!start || !end || end <= start) return [job];

  const entries: ScheduleJob[] = [];
  let cursor = start;
  let index = 0;
  const startTime = timeFromDateTime(job.scheduled_start, '09:00');
  const endTime = timeFromDateTime(job.scheduled_end, '17:00');

  while (cursor <= end && index < 31) {
    entries.push({
      ...job,
      schedule_key: `${job.id}:range:${cursor}`,
      visit_id: null,
      visit_date: cursor,
      visit_start_time: startTime,
      visit_end_time: endTime,
      visit_notes: null
    });
    cursor = addDays(cursor, 1);
    index += 1;
  }

  return entries.length ? entries : [job];
}

export function expandScheduleJobsByVisits(jobs: ScheduleJob[], visits: ScheduleVisit[]): ScheduleJob[] {
  const visitsByJob = new Map<string, ScheduleVisit[]>();
  visits.forEach((visit) => {
    const current = visitsByJob.get(visit.job_id) || [];
    current.push(visit);
    visitsByJob.set(visit.job_id, current);
  });

  return jobs.flatMap((job) => {
    const jobVisits = visitsByJob.get(job.id) || [];
    if (!jobVisits.length) return fallbackRangeEntries(job);
    return jobVisits.map((visit) => ({
      ...job,
      schedule_key: `${job.id}:${visit.id}`,
      visit_id: visit.id,
      visit_date: visit.visit_date,
      visit_start_time: visit.start_time,
      visit_end_time: visit.end_time,
      visit_notes: visit.notes
    }));
  });
}
