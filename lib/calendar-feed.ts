import { randomBytes } from 'node:crypto';
import type { SupabaseClient } from '@supabase/supabase-js';
import { PRODUCTION_APP_ORIGIN } from '@/lib/app-url';
import { generateBookingIcs } from '@/lib/booking/ics';
import { jobCalendarEvent } from '@/lib/job-calendar';
import { isContractorRole, isManagerRole, normalizeRole, type UserRole } from '@/lib/roles';

const CALENDAR_FEED_REVISION = 'tz4';
const CALENDAR_FEED_REVISION_AT = '2026-07-30T00:35:00.000Z';
const CALENDAR_FEED_REVISION_SEQUENCE = Math.floor(Date.parse(CALENDAR_FEED_REVISION_AT) / 1000);

export function generateCalendarFeedToken(): string {
  return randomBytes(24).toString('hex');
}

export function maskCalendarToken(token: string): string {
  if (token.length < 12) return '••••';
  return `${token.slice(0, 6)}…${token.slice(-4)}`;
}

export function calendarFeedUrl(token: string): string {
  return `${PRODUCTION_APP_ORIGIN}/calendar-feed/${token}.ics`;
}

export function webcalFeedUrl(token: string): string {
  return calendarFeedUrl(token).replace(/^https?:\/\//i, 'webcal://');
}

type FeedJobRow = {
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
  status?: string | null;
  updated_at?: string | null;
};

function calendarEnvelope(timeZone: string, vevents: string[] = []): string {
  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//EverittOS//Authorized Job Schedule//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'NAME:EverittOS Jobs',
    'X-WR-CALNAME:EverittOS Jobs',
    'X-WR-CALDESC:Authorized EverittOS job schedule',
    `X-WR-TIMEZONE:${timeZone}`,
    'REFRESH-INTERVAL;VALUE=DURATION:PT15M',
    'X-PUBLISHED-TTL:PT15M',
    ...vevents,
    'END:VCALENDAR'
  ].join('\r\n') + '\r\n';
}

function eventSequence(updatedAt?: string | null): number {
  const timestamp = updatedAt ? Date.parse(updatedAt) : 0;
  const jobSequence = Number.isFinite(timestamp) && timestamp > 0 ? Math.floor(timestamp / 1000) : 0;
  return Math.max(jobSequence, CALENDAR_FEED_REVISION_SEQUENCE);
}

function eventLastModified(updatedAt?: string | null): string {
  const timestamp = updatedAt ? Date.parse(updatedAt) : 0;
  if (Number.isFinite(timestamp) && timestamp > Date.parse(CALENDAR_FEED_REVISION_AT)) {
    return updatedAt!;
  }
  return CALENDAR_FEED_REVISION_AT;
}

function resolveCalendarTimeZone(value?: string): string {
  const configured = value?.trim();
  if (!configured || configured.toUpperCase() === 'UTC' || configured === 'Etc/UTC') {
    return 'America/Chicago';
  }
  return configured;
}

async function contractorAccessibleJobIds(
  admin: SupabaseClient,
  organizationId: string,
  userId: string
): Promise<Set<string>> {
  const ids = new Set<string>();
  const { data: workers } = await admin
    .from('workers')
    .select('id')
    .eq('organization_id', organizationId)
    .eq('auth_user_id', userId);
  const workerIds = (workers || []).map((row) => String(row.id));

  if (workerIds.length) {
    const [{ data: assignments }, { data: visits }] = await Promise.all([
      admin.from('job_assignments').select('job_id').eq('organization_id', organizationId).in('worker_id', workerIds),
      admin.from('job_visits').select('job_id').eq('organization_id', organizationId).in('worker_id', workerIds)
    ]);
    for (const row of assignments || []) if (row.job_id) ids.add(String(row.job_id));
    for (const row of visits || []) if (row.job_id) ids.add(String(row.job_id));
  }

  const { data: shares } = await admin
    .from('record_shares')
    .select('record_id')
    .eq('organization_id', organizationId)
    .eq('record_type', 'job')
    .eq('shared_with_user_id', userId);
  for (const row of shares || []) if (row.record_id) ids.add(String(row.record_id));

  return ids;
}

export async function buildAuthorizedCalendarFeedIcs(input: {
  admin: SupabaseClient;
  organizationId: string;
  userId: string;
  role: UserRole | string;
  timeZone?: string;
}): Promise<string> {
  const role = normalizeRole(input.role);
  const timeZone = resolveCalendarTimeZone(input.timeZone);
  let jobsQuery = input.admin
    .from('jobs')
    .select(
      'id, title, customer_name, address, notes, customer_notes, scheduled_start, scheduled_end, start_date, due_date, status, updated_at'
    )
    .eq('organization_id', input.organizationId)
    .not('status', 'eq', 'cancelled')
    .order('scheduled_start', { ascending: true })
    .limit(250);

  if (isContractorRole(role)) {
    const allowed = await contractorAccessibleJobIds(input.admin, input.organizationId, input.userId);
    if (!allowed.size) return calendarEnvelope(timeZone);
    jobsQuery = jobsQuery.in('id', Array.from(allowed));
  } else if (!isManagerRole(role)) {
    jobsQuery = jobsQuery.or(`assigned_user_id.eq.${input.userId},created_by.eq.${input.userId}`);
  }

  const { data: jobs } = await jobsQuery;
  const rows = (jobs || []) as FeedJobRow[];
  const vevents = rows
    .map((job) => {
      const event = jobCalendarEvent(job);
      if (!event) return '';
      const ics = generateBookingIcs({
        uid: `${event.id}-${CALENDAR_FEED_REVISION}`,
        title: event.title,
        description: event.description,
        location: event.location,
        startsAt: event.startsAt,
        endsAt: event.endsAt || event.startsAt,
        timeZone,
        lastModified: eventLastModified(job.updated_at),
        sequence: eventSequence(job.updated_at)
      });
      const start = ics.indexOf('BEGIN:VEVENT');
      const end = ics.indexOf('END:VEVENT');
      if (start < 0 || end < 0) return '';
      return ics.slice(start, end + 'END:VEVENT'.length);
    })
    .filter(Boolean);

  return calendarEnvelope(timeZone, vevents);
}
