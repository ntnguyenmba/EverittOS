import type { SupabaseClient } from '@supabase/supabase-js';
import {
  classifyJobWriteError,
  logCalendarImportIssue,
  maskCalendarUid,
  safeGroupedFailureMessage,
  type CalendarImportFailureCode
} from '@/lib/calendar-import/errors';
import { looksLikeIcsCalendar, parseIcsCalendar } from '@/lib/calendar-import/ical-parser';
import { fetchPublicCalendarFeed } from '@/lib/calendar-import/feed-security';
import { findConfidentProperty, isHighConfidenceManualDuplicate, isPossibleExistingJob, looksLikeAddress } from '@/lib/calendar-import/matching';
import { toSafeCalendarImportResult } from '@/lib/calendar-import/safe-status';
import { updateCalendarImportSyncState } from '@/lib/calendar-import/connections';
import { syncJobToGoogleCalendarSafe } from '@/lib/google-calendar-sync-job';
import { isMissingSchemaError } from '@/lib/supabase-schema-errors';
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

const JOB_MATCH_COLUMNS_LEGACY =
  'id, title, notes, address, status, start_date, due_date, scheduled_start, scheduled_end, timezone, assigned_to, assigned_email, revenue_amount, property_id, customer_id, completed_at';

const PROPERTY_COLUMNS = 'id, customer_id, name, address, formatted_address, timezone, is_archived';
const PROPERTY_COLUMNS_LEGACY = 'id, customer_id, name, address';

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
  if (!start && !end) return true;
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
    title: event.summary.trim() || event.location?.trim() || 'Calendar event',
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

function isUniqueConflict(error: { message?: string; code?: string } | null): boolean {
  const code = String(error?.code || '');
  const message = String(error?.message || '').toLowerCase();
  return code === '23505' || message.includes('duplicate') || message.includes('unique');
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
  if (!error) return (data || []) as CalendarImportJobRow[];
  if (isMissingSchemaError(error)) {
    const fallback = await admin
      .from('jobs')
      .select(JOB_MATCH_COLUMNS_LEGACY)
      .eq('organization_id', organizationId)
      .in('start_date', []);
    return (fallback.data || []) as CalendarImportJobRow[];
  }
  logCalendarImportIssue({
    organizationId,
    code: 'imported_job_lookup_failed',
    dbCode: error.code,
    dbMessage: error.message
  });
  return [];
}

async function findJobByExternalUid(
  admin: SupabaseClient,
  organizationId: string,
  uid: string
): Promise<CalendarImportJobRow | null> {
  const { data, error } = await admin
    .from('jobs')
    .select(JOB_MATCH_COLUMNS)
    .eq('organization_id', organizationId)
    .eq('external_source', CALENDAR_IMPORT_SOURCE)
    .eq('external_uid', uid)
    .maybeSingle();
  if (error || !data) return null;
  return data as CalendarImportJobRow;
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
  if (error) {
    if (isMissingSchemaError(error)) {
      const fallback = await admin
        .from('jobs')
        .select(JOB_MATCH_COLUMNS_LEGACY)
        .eq('organization_id', organizationId)
        .in('start_date', dates);
      return (fallback.data || []) as CalendarImportJobRow[];
    }
    return [];
  }
  return (data || []) as CalendarImportJobRow[];
}

async function loadProperties(admin: SupabaseClient, organizationId: string): Promise<CalendarImportPropertyRow[]> {
  const full = await admin
    .from('customer_properties')
    .select(PROPERTY_COLUMNS)
    .eq('organization_id', organizationId);
  if (!full.error) {
    return ((full.data || []) as CalendarImportPropertyRow[]).filter((property) => !property.is_archived);
  }
  const legacy = await admin
    .from('customer_properties')
    .select(PROPERTY_COLUMNS_LEGACY)
    .eq('organization_id', organizationId);
  if (legacy.error) return [];
  return (legacy.data || []) as CalendarImportPropertyRow[];
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

function fallbackPayloads(payload: Record<string, unknown>): Record<string, unknown>[] {
  const withoutLinks = { ...payload, property_id: null, customer_id: null };
  const withoutTimezone = { ...withoutLinks, timezone: null };
  const withoutExternal = { ...withoutTimezone };
  delete withoutExternal.external_source;
  delete withoutExternal.external_uid;
  delete withoutExternal.external_last_modified;
  return [payload, withoutLinks, withoutTimezone, withoutExternal];
}

async function insertJobWithFallback(
  admin: SupabaseClient,
  payload: Record<string, unknown>
): Promise<{ row: CalendarImportJobRow | null; error: { message?: string; code?: string } | null }> {
  let lastError: { message?: string; code?: string } | null = null;
  for (const candidate of fallbackPayloads(payload)) {
    const inserted = await admin.from('jobs').insert(candidate).select(JOB_MATCH_COLUMNS).single();
    if (!inserted.error && inserted.data) return { row: inserted.data as CalendarImportJobRow, error: null };
    lastError = inserted.error;
    if (inserted.error && isMissingSchemaError(inserted.error)) {
      const legacy = await admin.from('jobs').insert(candidate).select(JOB_MATCH_COLUMNS_LEGACY).single();
      if (!legacy.error && legacy.data) return { row: legacy.data as CalendarImportJobRow, error: null };
      lastError = legacy.error;
    }
    if (lastError && isUniqueConflict(lastError)) return { row: null, error: lastError };
  }
  return { row: null, error: lastError };
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

  const first = await insertJobWithFallback(admin, insertPayload);
  if (first.row) return first.row;

  if (first.error && isUniqueConflict(first.error)) {
    throw Object.assign(new Error(first.error.message || 'duplicate'), {
      code: first.error.code,
      failureCode: 'duplicate_conflict' as CalendarImportFailureCode
    });
  }

  throw Object.assign(new Error(first.error?.message || 'Could not create imported job.'), {
    code: first.error?.code,
    failureCode: classifyJobWriteError(first.error?.message || '', first.error?.code)
  });
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
    title: patch.title,
    notes: patch.notes,
    address: patch.address,
    start_date: patch.start_date,
    due_date: patch.due_date,
    scheduled_start: patch.scheduled_start,
    scheduled_end: patch.scheduled_end,
    timezone: patch.timezone,
    external_source: CALENDAR_IMPORT_SOURCE,
    external_uid: event.uid,
    external_last_modified: patch.external_last_modified
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

  const attempts = [next, { ...next, timezone: null }, { ...next, property_id: job.property_id || null, customer_id: job.customer_id || null }];
  let lastError: { message?: string; code?: string } | null = null;
  for (const attempt of attempts) {
    const updated = await admin.from('jobs').update(attempt).eq('id', job.id).eq('organization_id', connection.organization_id);
    if (!updated.error) return 'updated';
    lastError = updated.error;
    if (!isMissingSchemaError(updated.error) && !String(updated.error.message || '').toLowerCase().includes('timezone')) {
      break;
    }
  }

  throw Object.assign(new Error(lastError?.message || 'Could not update imported job.'), {
    code: lastError?.code,
    failureCode: 'job_update_failed' as CalendarImportFailureCode
  });
}

export async function importCalendarConnection(
  admin: SupabaseClient,
  connection: CalendarImportConnection,
  options: ImportCalendarOptions = {}
): Promise<CalendarImportResult> {
  const counts: CalendarImportCounts = { created: 0, updated: 0, skipped: 0, failed: 0 };
  const failures: CalendarImportFailureCode[] = [];
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

    for (const event of events) {
      if (!event.uid) {
        failures.push('missing_event_uid');
        counts.failed += 1;
      }
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
        let property: CalendarImportPropertyRow | null = null;
        try {
          property = findConfidentProperty(event, properties);
        } catch {
          property = null;
        }
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

        if (!ownerUserId) throw Object.assign(new Error('Could not determine the workspace owner for imported jobs.'), { failureCode: 'job_insert_failed' });
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
          try {
            await syncJobToGoogleCalendarSafe(admin, connection.organization_id, created.id);
          } catch {
            /* outbound Google sync must not fail calendar import */
          }
        }
      } catch (error) {
        const failureCode =
          error && typeof error === 'object' && 'failureCode' in error
            ? ((error as { failureCode?: CalendarImportFailureCode }).failureCode as CalendarImportFailureCode)
            : classifyJobWriteError(error instanceof Error ? error.message : '');
        if (failureCode === 'duplicate_conflict') {
          const existing = await findJobByExternalUid(admin, connection.organization_id, event.uid);
          if (existing) {
            importedByUid.set(event.uid, existing);
            try {
              const outcome = await updateImportedJob(admin, existing, event, property, connection, fallbackTimeZone);
              if (outcome === 'updated') counts.updated += 1;
              else counts.skipped += 1;
            } catch {
              counts.skipped += 1;
            }
            continue;
          }
          counts.skipped += 1;
          continue;
        }
        failures.push(failureCode || 'job_insert_failed');
        counts.failed += 1;
        logCalendarImportIssue({
          organizationId: connection.organization_id,
          code: failureCode || 'job_insert_failed',
          uidHash: maskCalendarUid(event.uid),
          summary: event.summary,
          dbMessage: error instanceof Error ? error.message : null
        });
      }
    }

    const lastSyncAt = now.toISOString();
    const error = safeGroupedFailureMessage(failures);
    await updateCalendarImportSyncState(admin, connection.id, {
      last_sync_at: lastSyncAt,
      last_sync_error: error
    });

    return toSafeCalendarImportResult(
      { ...connection, last_sync_at: lastSyncAt, last_sync_error: error },
      counts,
      error
    );
  } catch (error) {
    const message = error instanceof Error && 'code' in error ? error.message : 'The calendar feed could not be imported.';
    await updateCalendarImportSyncState(admin, connection.id, { last_sync_error: message }).catch(() => undefined);
    throw error;
  }
}
