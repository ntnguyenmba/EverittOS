/** Schedule queue classification for active work only. */

export type ScheduleClassifiableJob = {
  id?: string | null;
  status?: string | null;
  start_date?: string | null;
  due_date?: string | null;
  scheduled_start?: string | null;
};

export function isCompletedJobStatus(status: string | null | undefined): boolean {
  const value = String(status || '').toLowerCase().replace(/\s+/g, '_');
  return value === 'completed' || value === 'complete' || value === 'done';
}

export function isCancelledJobStatus(status: string | null | undefined): boolean {
  const value = String(status || '').toLowerCase().replace(/\s+/g, '_');
  return value === 'cancelled' || value === 'canceled';
}

/** Active jobs that still need scheduling or appear on the calendar. */
export function isActiveScheduleJob(job: ScheduleClassifiableJob): boolean {
  return !isCompletedJobStatus(job.status) && !isCancelledJobStatus(job.status);
}

export function scheduleJobDateKey(job: ScheduleClassifiableJob): string | null {
  if (job.start_date) return String(job.start_date).slice(0, 10);
  if (job.due_date) return String(job.due_date).slice(0, 10);
  if (job.scheduled_start) {
    const raw = String(job.scheduled_start).trim();
    const match = raw.match(/^(\d{4}-\d{2}-\d{2})/);
    if (match) return match[1];
  }
  return null;
}

export function partitionScheduleJobs<T extends ScheduleClassifiableJob>(
  jobs: T[],
  todayKey: string,
  tomorrowKey: string,
  weekEndKey: string
): {
  today: T[];
  tomorrow: T[];
  week: T[];
  unscheduled: T[];
  active: T[];
} {
  const active = jobs.filter(isActiveScheduleJob);
  const today: T[] = [];
  const tomorrow: T[] = [];
  const week: T[] = [];
  const unscheduled: T[] = [];

  for (const job of active) {
    const key = scheduleJobDateKey(job);
    if (!key) {
      unscheduled.push(job);
      continue;
    }
    if (key === todayKey) today.push(job);
    if (key === tomorrowKey) tomorrow.push(job);
    if (key >= todayKey && key <= weekEndKey) week.push(job);
  }

  return { today, tomorrow, week, unscheduled, active };
}
