import type { CalendarImportJobRow, CalendarImportPropertyRow, ParsedCalendarEvent } from '@/lib/calendar-import/types';

const TRAILING_SERVICE_WORDS = /\s+(cleaning|turnover|clean|service)$/i;

export function normalizeCalendarTitle(value: string | null | undefined): string {
  return String(value || '')
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ')
    .replace(TRAILING_SERVICE_WORDS, '')
    .trim();
}

export function wallClockTime(value: string | null | undefined): string | null {
  const match = String(value || '').match(/T(\d{2}):(\d{2})/);
  return match ? `${match[1]}:${match[2]}` : null;
}

export function looksLikeAddress(location: string | null | undefined): boolean {
  const value = String(location || '').trim();
  if (value.length < 5) return false;
  if (/\d/.test(value)) return true;
  if (/,/.test(value)) return true;
  return /\b(st|street|ln|lane|ave|avenue|rd|road|dr|drive|blvd|way|ct|court|hwy|highway)\b/i.test(value);
}

export function isHighConfidencePropertyMatch(eventTitle: string, property: CalendarImportPropertyRow): boolean {
  const eventName = normalizeCalendarTitle(eventTitle);
  const propertyName = normalizeCalendarTitle(property.name);
  if (!eventName || !propertyName) return false;
  if (eventName === propertyName) return true;

  const propertyAddress = normalizeCalendarTitle(property.formatted_address || property.address || '');
  return Boolean(propertyAddress && eventName === propertyAddress);
}

export function findConfidentProperty(
  event: ParsedCalendarEvent,
  properties: CalendarImportPropertyRow[]
): CalendarImportPropertyRow | null {
  const matches = properties.filter((property) => !property.is_archived && isHighConfidencePropertyMatch(event.summary, property));
  return matches.length === 1 ? matches[0] : null;
}

export function isHighConfidenceManualDuplicate(job: CalendarImportJobRow, event: ParsedCalendarEvent): boolean {
  if (normalizeCalendarTitle(job.title) !== normalizeCalendarTitle(event.summary)) return false;
  const jobDate = String(job.start_date || job.scheduled_start || '').slice(0, 10);
  if (!jobDate || !event.startDate || jobDate !== event.startDate) return false;
  const jobTime = wallClockTime(job.scheduled_start);
  const eventTime = wallClockTime(event.dtStart);
  if (event.allDay && !jobTime) return true;
  if (!jobTime || !eventTime) return false;
  return jobTime === eventTime;
}

export function isPossibleExistingJob(job: CalendarImportJobRow, event: ParsedCalendarEvent): boolean {
  if (isHighConfidenceManualDuplicate(job, event)) return true;
  const jobDate = String(job.start_date || job.scheduled_start || '').slice(0, 10);
  if (!jobDate || !event.startDate || jobDate !== event.startDate) return false;
  const jobTime = wallClockTime(job.scheduled_start);
  const eventTime = wallClockTime(event.dtStart);
  if (jobTime && eventTime && jobTime === eventTime) {
    const jobTitle = normalizeCalendarTitle(job.title);
    const eventTitle = normalizeCalendarTitle(event.summary);
    return Boolean(jobTitle && eventTitle && (jobTitle.includes(eventTitle) || eventTitle.includes(jobTitle)));
  }
  return false;
}
