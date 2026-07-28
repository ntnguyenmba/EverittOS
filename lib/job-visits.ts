import { normalizeDateInput, normalizeTimeInput, wallClockDateTime } from '@/lib/schedule-times';

export type VisitInput = {
  id?: string;
  visit_date?: string;
  start_time?: string;
  end_time?: string;
  notes?: string | null;
};

export type CleanVisit = {
  id?: string;
  visit_date: string;
  start_time: string;
  end_time: string;
  notes: string | null;
};

export function cleanVisits(visits: VisitInput[]): CleanVisit[] {
  return visits.map((visit) => ({
    id: visit.id || undefined,
    visit_date: normalizeDateInput(visit.visit_date),
    start_time: normalizeTimeInput(visit.start_time),
    end_time: normalizeTimeInput(visit.end_time),
    notes: visit.notes?.trim() || null
  }));
}

export function validateVisits(visits: CleanVisit[]): string | null {
  if (visits.length === 0) return 'At least one visit is required.';
  for (const visit of visits) {
    if (!visit.visit_date || !visit.start_time || !visit.end_time) {
      return 'Each visit needs a valid date, start time, and end time.';
    }
    if (visit.end_time <= visit.start_time) {
      return 'Visit end time must be after start time.';
    }
  }
  return null;
}

export function sortVisits(visits: CleanVisit[]): CleanVisit[] {
  return [...visits].sort((a, b) =>
    `${a.visit_date} ${a.start_time}`.localeCompare(`${b.visit_date} ${b.start_time}`)
  );
}

/** Derive legacy job schedule columns from ordered visits (wall-clock, no TZ shift). */
export function scheduleFieldsFromVisits(visits: CleanVisit[]): {
  start_date: string;
  due_date: string;
  scheduled_start: string | null;
  scheduled_end: string | null;
} {
  const ordered = sortVisits(visits);
  const first = ordered[0];
  const last = ordered[ordered.length - 1];
  return {
    start_date: first.visit_date,
    due_date: last.visit_date,
    scheduled_start: wallClockDateTime(first.visit_date, first.start_time),
    scheduled_end: wallClockDateTime(last.visit_date, last.end_time)
  };
}

/**
 * Round-trip helper used by regression tests:
 * UI selection → API payload shape → stored visit/job fields → edit-form values.
 */
export function scheduleRoundTripFromUiVisits(
  visits: Array<{ visit_date: string; start_time: string; end_time: string; notes?: string | null }>
): {
  payload: { start_date: string; due_date: string; scheduled_start: string | null; scheduled_end: string | null; visits: CleanVisit[] };
  storedVisits: CleanVisit[];
  editForm: Array<{ visit_date: string; start_time: string; end_time: string }>;
} {
  const cleaned = sortVisits(cleanVisits(visits));
  const schedule = scheduleFieldsFromVisits(cleaned);
  return {
    payload: { ...schedule, visits: cleaned },
    storedVisits: cleaned,
    editForm: cleaned.map((visit) => ({
      visit_date: visit.visit_date,
      start_time: visit.start_time,
      end_time: visit.end_time
    }))
  };
}
