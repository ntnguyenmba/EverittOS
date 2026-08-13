import type { SupabaseClient } from '@supabase/supabase-js';
import { looksLikeIcsCalendar, parseIcsCalendar } from '@/lib/calendar-import/ical-parser';
import { fetchPublicCalendarFeed } from '@/lib/calendar-import/feed-security';
import { findConfidentProperty, isHighConfidenceManualDuplicate, isPossibleExistingJob, looksLikeAddress } from '@/lib/calendar-import/matching';
import { toSafeCalendarImportResult } from '@/lib/calendar-import/safe-status';
import { updateCalendarImportSyncState } from '@/lib/calendar-import/connections';
import { syncJobToGoogleCalendarSafe } from '@/lib/google-calendar-sync-job';
import { DEFAULT_TIME_ZONE, isValidTimeZone } from '@/lib/time-zones';
import {
  CALENDAR_IMPORT_SOURCE,
  type CalendarImportConnection,
  type CalendarImportCounts,
  type CalendarImportJobRow,
  type CalendarImportPropertyRow,
  type CalendarImportResult,
  type ParsedCalendarEvent
} from '@/lib/calendar-import/types';

const JOB_MATCH_COLUMNS =
  'id, title, notes, address, status, start_date, due_date, scheduled_start, scheduled_end, timezone, assigned_to, assigned_email, revenue_amount, property_id, customer_id, external_source, external_uid, external_last_modified, completed_at';

const PROPERTY_COLUMNS = 'id, customer_id, name, address, formatted_address, timezone, is_archived';

export type ImportCalendarOptions = {
  now?: Date;
  events?: ParsedCalendarEvent[];
  icsText?: string;
  organizationTimeZone?: string;
  ownerUserId?: string;
  syncGoogle?: boolean;
  writeActivity?: boolean;
  fetchImpl?: typeof fetch;
};

function todayInTimeZone(now: Date, timeZone: string): string {
  try {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    }).format(now);
  } catch {
    return now.toISOString().slice(0, 10);
  }
}

function addDays(dateStr: string, days: number): string {
  const match = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return dateStr;
  const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function resolveJobTimeZone(event: ParsedCalendarEvent, property: CalendarImportPropertyRow | null, fallback: string): string | null {
  if (event.timezone && isValidTimeZone(event.timezone)) return event.timezone;
  if (property?.timezone && isValidTimeZone(property.timezone)) return property.timezone;
  return isValidTimeZone(fallback) ? fallback : null;
}

function eventAddress(event: ParsedCalendarEvent, property: CalendarImportPropertyRow | null): string | null {
  if (looksLikeAddress(event.location)) return event.location;
  return property?.formatted_address || property?.address || null;
}

function sameCalendarField(left: string | null | undefined, right: string | null | undefined): boolean {
  return String(left || '').trim() === String(right || '').trim();
}

function isCancelledEvent(event: ParsedCalendarEvent): boolean {
  return event.status === 'CANCELLED';
}

function isRelevantEvent(event: ParsedCalendarEvent, today: string): boolean {
  const start = event.startDate;
  const end = event.endDate || event.startDate;
  if (!start && !end) return false;
  const horizon = addDays(today, 730);
  const lookback = addDays(today, -1);
  if (start && start > horizon) return false;
  return Boolean((end && end >= lookback) || (start && start >= lookback));
}

function calendarControlledPatch(
  event: ParsedCalendarEvent,
  property: CalendarImportPropertyRow | null,
  fallbackTimeZone: string
): Record<string, string | null> {
  return {
    title: event.summary.trim() || 'Calendar event',
    notes: event.description,
    address: eventAddress(event, property),
    start_date: event.startDate,
    due_date: event.endDate || event.startDate,
    scheduled_start: event.dtStart,
    scheduled_end: event.dtEnd,
    timezone: resolveJobTimeZone(event, property, fallbackTimeZone),
    external_last_modified: event.lastModified
  };
}

function calendarFieldsUnchanged(job: CalendarImportJobRow, patch: Record<string, string | null>): boolean {
  return (
    sameCalendarField(job.title, patch.title) &&
    sameCalendarField(job.notes, patch.notes) &&
    sameCalendarField(job.address, patch.address) &&
    sameCalendarField(job.start_date, patch.start_date) &&
    sameCalendarField(job.due_date, patch.due_date) &&
    sameCalendarField(job.scheduled_start, patch.scheduled_start) &&
    sameCalendarField(job.scheduled_end, patch.scheduled_end) &&
    sameCalendarField(job.timezone, patch.timezone) &&
    sameCalendarField(job.external_last_modified, patch.external_last_modified)
  );
}

async function loadOrganizationTimeZone(admin: SupabaseClient, organizationId: string, fallback: string): Promise<string> {
  const { data } = await admin
    .from('organization_settings')
    .select('timezone')
    .eq('organization_id', organizationId)
    .maybeSingle();
  return data?.timezone && isValidTimeZone(data.timezone) ? data.timezone : fallback;
}

async function loadOwnerUserId(
  admin: SupabaseClient,
  organizationId: string,
  createdBy: string | null
): Promise<string | null> {
  if (createdBy) return createdBy;
  const { data } = await admin.from('organizations').select('owner_user_id').eq('id', organizationId).maybeSingle();
  return data?.owner_user_id || null;
}

async function loadImportedJobs(
  admin: SupabaseClient,
  organizationId: string,
  uids: string[]
): Promise<CalendarImportJobRow[]> {
  if (uids.length === 0) return [];
  const { data, error } = await admin
    .from('jobs')
    .select(JOB_MATCH_COLUMNS)
    .eq('organization_id', organizationId)
    .eq('external_source', CALENDAR_IMPORT_SOURCE)
    .in('external_uid', uids);
  if (error) throw new Error('Could not load imported jobs.');
  return (data || []) as CalendarImportJobRow[];
}

async function loadCandidateJobs(
  admin: SupabaseClient,
  organizationId: string,
  dates: string[]
): Promise<CalendarImportJobRow[]> {
  if (dates.length === 0) return [];
  const { data, error } = await admin
    .from('jobs')
    .select(JOB_MATCH_COLUMNS)
    .eq('organization_id', organizationId)
    .in('start_date', dates);
  if (error) throw new Error('Could not load existing jobs.');
  return (data || []) as CalendarImportJobRow[];
}

async function loadProperties(admin: SupabaseClient, organizationId: string): Promise<CalendarImportPropertyRow[]> {
  const { data, error } = await admin
    .from('customer_properties')
    .select(PROPERTY_COLUMNS)
    .eq('organization_id', organizationId)
    .eq('is_archived', false);
  if (error) return [];
  return (data || []) as CalendarImportPropertyRow[];
}

async function writeSafeActivity(
  admin: SupabaseClient,
  input: {
    organizationId: string;
    userId?: string | null;
    entityType: string;
    entityId?: string | null;
    action: string;
    message: string;
    metadata?: Record<string, unknown>;
  }
): Promise<void> {
  try {
    await admin.from('activity_logs').insert({
      organization_id: input.organizationId,
      user_id: input.userId || null,
      entity_type: input.entityType,
      entity_id: input.entityId || null,
      action: input.action,
      message: input.message,
      metadata: input.metadata || {}
    });
  } catch {
    /* activity must never fail calendar import */
  }
}

async function createImportedJob(
  admin: SupabaseClient,
  connection: CalendarImportConnection,
  event: ParsedCalendarEvent,
  property: CalendarImportPropertyRow | null,
  ownerUserId: string,
  fallbackTimeZone: string
): Promise<CalendarImportJobRow> {
  const patch = calendarControlledPatch(event, property, fallbackTimeZone);
  const revenue =
    connection.default_revenue_amount === null || connection.default_revenue_amount === undefined
      ? null
      : Number(connection.default_revenue_amount);

  const insertPayload: Record<string, unknown> = {
    user_id: ownerUserId,
    organization_id: connection.organization_id,
    title: patch.title,
    notes: patch.notes,
    address: patch.address,
    status: 'scheduled',
    start_date: patch.start_date,
    due_date: patch.due_date,
    scheduled_start: patch.scheduled_start,
    scheduled_end: patch.scheduled_end,
    timezone: patch.timezone,
    revenue_amount: Number.isFinite(revenue as number) ? revenue : null,
    property_id: property?.id || connection.default_property_id || null,
    customer_id: property?.customer_id || connection.default_customer_id || null,
    assigned_to: null,
    assigned_email: null,
    external_source: CALENDAR_IMPORT_SOURCE,
    external_uid: event.uid,
    external_last_modified: patch.external_last_modified
  };

  const { data, error } = await admin.from('jobs').insert(insertPayload).select(JOB_MATCH_COLUMNS).single();
  if (error || !data) throw new Error('Could not create imported job.');
  return data as CalendarImportJobRow;
}

async function updateImportedJob(
  admin: SupabaseClient,
  job: CalendarImportJobRow,
  event: ParsedCalendarEvent,
  property: CalendarImportPropertyRow | null,
  connection: CalendarImportConnection,
  fallbackTimeZone: string
): Promise<'updated' | 'unchanged'> {
  const patch = calendarControlledPatch(event, property, fallbackTimeZone);
  const next: Record<string, unknown> = {
    ...patch,
    external_source: CALENDAR_IMPORT_SOURCE,
    external_uid: event.uid
  };

  if ((job.revenue_amount === null || job.revenue_amount === undefined) && connection.default_revenue_amount != null) {
    next.revenue_amount = Number(connection.default_revenue_amount);
  }

  if (!job.property_id && property?.id) {
    next.property_id = property.id;
    if (!job.customer_id && property.customer_id) next.customer_id = property.customer_id;
  }

  const cancelled = isCancelledEvent(event);
  const alreadyComplete = String(job.status || '').toLowerCase() === 'completed' || Boolean(job.completed_at);
  if (cancelled && !alreadyComplete && String(job.status || '').toLowerCase() !== 'cancelled') {
    next.status = 'cancelled';
  }

  const revenueUnchanged =
    next.revenue_amount === undefined || Number(next.revenue_amount) === Number(job.revenue_amount);
  const statusUnchanged = next.status === undefined || next.status === job.status;
  const propertyUnchanged = next.property_id === undefined || next.property_id === job.property_id;

  if (calendarFieldsUnchanged(job, patch) && revenueUnchanged && statusUnchanged && propertyUnchanged) {
    return 'unchanged';
  }

  const { error } = await admin.from('jobs').update(next).eq('id', job.id).eq('organization_id', connection.organization_id);
  if (error) throw new Error('Could not update imported job.');
  return 'updated';
}

export async function importCalendarConnection(
  admin: SupabaseClient,
  connection: CalendarImportConnection,
  options: ImportCalendarOptions = {}
): Promise<CalendarImportResult> {
  const counts: CalendarImportCounts = { created: 0, updated: 0, skipped: 0, failed: 0 };
  const now = options.now || new Date();
  const fallbackTimeZone = options.organizationTimeZone || (await loadOrganizationTimeZone(admin, connection.organization_id, DEFAULT_TIME_ZONE));
  const today = todayInTimeZone(now, fallbackTimeZone);
  const ownerUserId = options.ownerUserId || (await loadOwnerUserId(admin, connection.organization_id, connection.created_by));
  const writeActivity = options.writeActivity !== false;
  const syncGoogle = options.syncGoogle !== false;

  let events = options.events;
  try {
    if (!events) {
      const icsText =
        options.icsText ||
        (await fetchPublicCalendarFeed(connection.feed_url, { fetchImpl: options.fetchImpl })).body;
      if (!looksLikeIcsCalendar(icsText)) {
        throw Object.assign(new Error('The URL did not return a calendar feed.'), { code: 'not_calendar' });
      }
      events = parseIcsCalendar(icsText, fallbackTimeZone);
    }

    const relevant = events.filter((event) => event.uid && isRelevantEvent(event, today));
    const imported = await loadImportedJobs(
      admin,
      connection.organization_id,
      relevant.map((event) => event.uid)
    );
    const importedByUid = new Map(imported.map((job) => [job.external_uid, job]));
    const candidates = await loadCandidateJobs(
      admin,
      connection.organization_id,
      Array.from(new Set(relevant.map((event) => event.startDate).filter((value): value is string => Boolean(value))))
    );
    const properties = await loadProperties(admin, connection.organization_id);

    for (const event of relevant) {
      try {
        const property = findConfidentProperty(event, properties);
        const existing = importedByUid.get(event.uid) || null;

        if (existing) {
          const outcome = await updateImportedJob(admin, existing, event, property, connection, fallbackTimeZone);
          if (outcome === 'updated') counts.updated += 1;
          else counts.skipped += 1;
          continue;
        }

        if (isCancelledEvent(event)) {
          counts.skipped += 1;
          continue;
        }

        const highConfidence = candidates.find(
          (job) => !job.external_uid && isHighConfidenceManualDuplicate(job, event)
        );
        if (highConfidence) {
          const outcome = await updateImportedJob(admin, highConfidence, event, property, connection, fallbackTimeZone);
          importedByUid.set(event.uid, { ...highConfidence, external_uid: event.uid, external_source: CALENDAR_IMPORT_SOURCE });
          if (outcome === 'updated') counts.updated += 1;
          else counts.skipped += 1;
          continue;
        }

        const possible = candidates.find((job) => !job.external_uid && isPossibleExistingJob(job, event));
        if (possible) {
          counts.skipped += 1;
          continue;
        }

        if (!ownerUserId) throw new Error('Could not determine the workspace owner for imported jobs.');
        const created = await createImportedJob(admin, connection, event, property, ownerUserId, fallbackTimeZone);
        importedByUid.set(event.uid, created);
        candidates.push(created);
        counts.created += 1;
        if (writeActivity) {
          await writeSafeActivity(admin, {
            organizationId: connection.organization_id,
            userId: ownerUserId,
            entityType: 'job',
            entityId: created.id,
            action: 'job_created',
            message: 'Job imported from calendar',
            metadata: { source: CALENDAR_IMPORT_SOURCE }
          });
        }
        if (syncGoogle) {
          await syncJobToGoogleCalendarSafe(admin, connection.organization_id, created.id);
        }
      } catch {
        counts.failed += 1;
      }
    }

    const lastSyncAt = now.toISOString();
    await updateCalendarImportSyncState(admin, connection.id, {
      last_sync_at: lastSyncAt,
      last_sync_error: counts.failed > 0 ? 'Some calendar events could not be imported.' : null
    });

    return toSafeCalendarImportResult(
      { ...connection, last_sync_at: lastSyncAt, last_sync_error: counts.failed > 0 ? 'Some calendar events could not be imported.' : null },
      counts
    );
  } catch (error) {
    const message = error instanceof Error && 'code' in error ? error.message : 'The calendar feed could not be imported.';
    await updateCalendarImportSyncState(admin, connection.id, { last_sync_error: message }).catch(() => undefined);
    throw error;
  }
}
