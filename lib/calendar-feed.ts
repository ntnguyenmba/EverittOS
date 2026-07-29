import { createHash, randomBytes } from 'node:crypto';
import type { SupabaseClient } from '@supabase/supabase-js';
import { appOrigin, PRODUCTION_APP_ORIGIN } from '@/lib/app-url';
import { generateBookingIcs } from '@/lib/booking/ics';
import { jobCalendarEvent } from '@/lib/job-calendar';
import { isContractorRole, isManagerRole, normalizeRole, type UserRole } from '@/lib/roles';

export function generateCalendarFeedToken(): string {
  return randomBytes(24).toString('hex');
}

export function maskCalendarToken(token: string): string {
  if (token.length < 12) return '••••';
  return `${token.slice(0, 6)}…${token.slice(-4)}`;
}

function secureCalendarOrigin(): string {
  if (process.env.NODE_ENV === 'production') return PRODUCTION_APP_ORIGIN;

  try {
    const url = new URL(appOrigin());
    const isLocal = url.hostname === 'localhost' || url.hostname === '127.0.0.1' || url.hostname === '::1';
    if (url.protocol === 'http:' && !isLocal) url.protocol = 'https:';
    if (url.protocol !== 'https:' && !isLocal) return PRODUCTION_APP_ORIGIN;
    return url.origin;
  } catch {
    return PRODUCTION_APP_ORIGIN;
  }
}

export function calendarFeedUrl(token: string): string {
  return `${secureCalendarOrigin()}/api/calendar/feed/${token}.ics`;
}

export function webcalFeedUrl(token: string): string {
  return calendarFeedUrl(token).replace(/^https:/, 'webcals:').replace(/^http:/, 'webcal:');
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
    'REFRESH-INTERVAL;VALUE=DURATION:PT30M',
    'X-PUBLISHED-TTL:PT30M',
    ...vevents,
    'END:VCALENDAR'
  ].join('\r\n') + '\r\n';
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
  const timeZone = input.timeZone?.trim() || 'America/Chicago';
  let jobsQuery = input.admin
    .from('jobs')
    .select(
      'id, title, customer_name, address, notes, customer_notes, scheduled_start, scheduled_end, start_date, due_date, status'
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
  const events = ((jobs || []) as FeedJobRow[])
    .map((job) => jobCalendarEvent(job))
    .filter(Boolean);

  if (!events.length) return calendarEnvelope(timeZone);

  const vevents = events
    .map((event) =>
      generateBookingIcs({
        uid: event!.id,
        title: event!.title,
        description: event!.description,
        location: event!.location,
        startsAt: event!.startsAt,
        endsAt: event!.endsAt || event!.startsAt,
        timeZone
      })
    )
    .map((ics) => {
      const start = ics.indexOf('BEGIN:VEVENT');
      const end = ics.indexOf('END:VEVENT');
      if (start < 0 || end < 0) return '';
      return ics.slice(start, end + 'END:VEVENT'.length);
    })
    .filter(Boolean);

  return calendarEnvelope(timeZone, vevents);
}
