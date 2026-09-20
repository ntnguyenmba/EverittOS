import { displayPersonName } from '@/lib/exports/format';

export type JobListSortMode = 'date' | 'assigned';

export type SortableJob = {
  status?: string | null;
  assigned_to?: string | null;
  assigned_email?: string | null;
  scheduled_start?: string | null;
  start_date?: string | null;
  due_date?: string | null;
  created_at?: string | null;
};

export function jobDateValue(job: SortableJob): string {
  return job.scheduled_start || job.start_date || job.due_date || '';
}

function normalizedStatus(job: SortableJob) {
  return String(job.status || '').trim().toLowerCase();
}

function isClosedJob(job: SortableJob) {
  return ['completed', 'finished', 'cancelled', 'canceled'].includes(normalizedStatus(job));
}

export function compareJobsByDate(a: SortableJob, b: SortableJob): number {
  const today = new Date();
  const todayKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  const aValue = jobDateValue(a);
  const bValue = jobDateValue(b);

  if (!aValue && !bValue) {
    return String(b.created_at || '').localeCompare(String(a.created_at || ''));
  }
  if (!aValue) return 1;
  if (!bValue) return -1;

  const aDate = aValue.slice(0, 10);
  const bDate = bValue.slice(0, 10);
  const aUpcoming = aDate >= todayKey;
  const bUpcoming = bDate >= todayKey;

  // Upcoming work comes first, nearest date first.
  // Overdue work follows, with the most recently overdue first.
  if (aUpcoming !== bUpcoming) return aUpcoming ? -1 : 1;

  const byDate = aUpcoming ? aValue.localeCompare(bValue) : bValue.localeCompare(aValue);
  if (byDate !== 0) return byDate;

  return String(b.created_at || '').localeCompare(String(a.created_at || ''));
}

export function assignedWorkerSortName(job: SortableJob, workerNames: Record<string, string>): string | null {
  const mapped = job.assigned_to ? workerNames[job.assigned_to] : '';
  const label = displayPersonName(mapped, job.assigned_email);
  return label || null;
}

export function sortJobs<T extends SortableJob>(
  rows: T[],
  mode: JobListSortMode = 'date',
  workerNames: Record<string, string> = {},
  locale = 'en'
): T[] {
  return [...rows].sort((a, b) => {
    if (mode === 'assigned') {
      const aName = assignedWorkerSortName(a, workerNames);
      const bName = assignedWorkerSortName(b, workerNames);
      const aUnassigned = !aName;
      const bUnassigned = !bName;
      if (aUnassigned !== bUnassigned) return aUnassigned ? -1 : 1;
      if (aName && bName) {
        const byName = aName.localeCompare(bName, locale, { sensitivity: 'base' });
        if (byName !== 0) return byName;
      }
      return compareJobsByDate(a, b);
    }

    const aClosed = isClosedJob(a);
    const bClosed = isClosedJob(b);

    // In the default All jobs view, all open work is shown before completed/cancelled work.
    if (aClosed !== bClosed) return aClosed ? 1 : -1;

    return compareJobsByDate(a, b);
  });
}
