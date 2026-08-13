import type { SupabaseClient } from '@supabase/supabase-js';
import {
  classifyJobWriteError,
  dominantFailureCode,
  extractUnknownJobColumn,
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

const JOB_MATCH_COLUMNS_MINIMAL =
  'id, title, notes, address, status, start_date, due_date, scheduled_start, scheduled_end, completed_at';

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
    for (const columns of [JOB_MATCH_COLUMNS_LEGACY, JOB_MATCH_COLUMNS_MINIMAL]) {
      const fallback = await admin
        .from('jobs')
        .select(columns)
        .eq('organization_id', organizationId)
        .in('start_date', []);
      if (!fallback.error) return (fallback.data || []) as unknown as CalendarImportJobRow[];
    }
    return [];
  }
  logCalendarImportIssue({
    organizationId,
    code: 'imported_job_lookup_failed',
    operation: 'lookup',
    dbCode: error.code,
    dbMessage: error.message,
    phase: 'before_write'
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
      for (const columns of [JOB_MATCH_COLUMNS_LEGACY, JOB_MATCH_COLUMNS_MINIMAL]) {
        const fallback = await admin
          .from('jobs')
          .select(columns)
          .eq('organization_id', organizationId)
          .in('start_date', dates);
        if (!fallback.error) return (fallback.data || []) as unknown as CalendarImportJobRow[];
      }
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

const OPTIONAL_WRITE_COLUMNS = [
  'external_source',
  'external_uid',
  'external_last_modified',
  'timezone',
  'property_id',
  'customer_id',
  'assigned_email',
  'assigned_to',
  'revenue_amount',
  'notes',
  'address',
  'scheduled_end',
  'scheduled_start',
  'due_date',
  'start_date'
] as const;

function omitKeys(payload: Record<string, unknown>, keys: string[]): Record<string, unknown> {
  const next = { ...payload };
  for (const key of keys) delete next[key];
  return next;
}

function asTimestamptz(value: string | null | undefined): string | null {
  if (!value) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toISOString().replace(/\.000Z$/, 'Z');
}

function fallbackPayloads(payload: Record<string, unknown>): Record<string, unknown>[] {
  return [
    payload,
    omitKeys(payload, ['property_id', 'customer_id']),
    omitKeys(payload, ['property_id', 'customer_id', 'timezone']),
    omitKeys(payload, ['property_id', 'customer_id', 'timezone', 'external_source', 'external_uid', 'external_last_modified']),
    omitKeys(payload, [
      'property_id',
      'customer_id',
      'timezone',
      'external_source',
      'external_uid',
      'external_last_modified',
      'assigned_email',
      'assigned_to',
      'revenue_amount'
    ]),
    omitKeys(payload, [...OPTIONAL_WRITE_COLUMNS])
  ];
}

function rowFromInsert(
  id: string,
  payload: Record<string, unknown>
): CalendarImportJobRow {
  return {
    id,
    organization_id: String(payload.organization_id || ''),
    title: String(payload.title || 'Calendar event'),
    notes: (payload.notes as string | null) || null,
    address: (payload.address as string | null) || null,
    status: (payload.status as string | null) || 'new',
    start_date: (payload.start_date as string | null) || null,
    due_date: (payload.due_date as string | null) || null,
    scheduled_start: (payload.scheduled_start as string | null) || null,
    scheduled_end: (payload.scheduled_end as string | null) || null,
    timezone: (payload.timezone as string | null) || null,
    assigned_to: (payload.assigned_to as string | null) || null,
    assigned_email: (payload.assigned_email as string | null) || null,
    revenue_amount: payload.revenue_amount == null ? null : Number(payload.revenue_amount),
    property_id: (payload.property_id as string | null) || null,
    customer_id: (payload.customer_id as string | null) || null,
    external_source: (payload.external_source as string | null) || null,
    external_uid: (payload.external_uid as string | null) || null,
    external_last_modified: (payload.external_last_modified as string | null) || null
  };
}

async function insertJobWithFallback(
  admin: SupabaseClient,
  payload: Record<string, unknown>
): Promise<{ row: CalendarImportJobRow | null; error: { message?: string; code?: string } | null }> {
  let lastError: { message?: string; code?: string } | null = null;
  const extraOmit = new Set<string>();
  const seen = new Set<string>();
  const layers = [
    ...fallbackPayloads(payload),
    { ...omitKeys(payload, [...OPTIONAL_WRITE_COLUMNS]), status: 'new' },
    omitKeys({ ...payload, status: 'new' }, [...OPTIONAL_WRITE_COLUMNS, 'status'])
  ];

  for (const layer of layers) {
    let candidate = omitKeys(layer, [...extraOmit]);
    for (let inner = 0; inner < OPTIONAL_WRITE_COLUMNS.length + 4; inner += 1) {
      const signature = `${Object.keys(candidate).sort().join(',')}:${String(candidate.status || '')}`;
      if (seen.has(signature)) break;
      seen.add(signature);

      // Select only id. Returning optional/external columns rolls back the insert
      // when PostgREST's schema cache does not know those jobs columns.
      const inserted = await admin.from('jobs').insert(candidate).select('id').single();
      if (!inserted.error && inserted.data) {
        const id = String((inserted.data as { id?: string }).id || '');
        if (id) return { row: rowFromInsert(id, candidate), error: null };
      }
      lastError = inserted.error;
      if (lastError && isUniqueConflict(lastError)) return { row: null, error: lastError };

      const unknownColumn = extractUnknownJobColumn(lastError);
      if (unknownColumn && unknownColumn in candidate) {
        extraOmit.add(unknownColumn);
        candidate = omitKeys(candidate, [unknownColumn]);
        continue;
      }

      const classified = classifyJobWriteError(lastError?.message || '', lastError?.code);
      if (classified === 'invalid_timezone' && 'timezone' in candidate) {
        extraOmit.add('timezone');
        candidate = omitKeys(candidate, ['timezone']);
        continue;
      }
      if (classified === 'invalid_event_time') {
        const timeFields = ['external_last_modified', 'scheduled_end', 'scheduled_start'] as const;
        const nextTimeField = timeFields.find((field) => field in candidate);
        if (nextTimeField) {
          extraOmit.add(nextTimeField);
          candidate = omitKeys(candidate, [nextTimeField]);
          continue;
        }
      }
      if (candidate.status === 'scheduled') {
        candidate = { ...candidate, status: 'new' };
        continue;
      }
      break;
    }
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
    status: 'scheduled',
    start_date: patch.start_date,
    due_date: patch.due_date,
    scheduled_start: patch.scheduled_start,
    scheduled_end: patch.scheduled_end
  };
  if (patch.notes) insertPayload.notes = patch.notes;
  if (patch.address) insertPayload.address = patch.address;
  if (patch.timezone) insertPayload.timezone = patch.timezone;
  if (Number.isFinite(revenue as number)) insertPayload.revenue_amount = revenue;
  if (property?.id || connection.default_property_id) {
    insertPayload.property_id = property?.id || connection.default_property_id;
  }
  if (property?.customer_id || connection.default_customer_id) {
    insertPayload.customer_id = property?.customer_id || connection.default_customer_id;
  }
  insertPayload.external_source = CALENDAR_IMPORT_SOURCE;
  insertPayload.external_uid = event.uid;
  const lastModified = asTimestamptz(patch.external_last_modified);
  if (lastModified) insertPayload.external_last_modified = lastModified;

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
    external_source: CALENDAR_IMPORT_SOURCE,
    external_uid: event.uid
  };
  if (patch.timezone) next.timezone = patch.timezone;
  const lastModified = asTimestamptz(patch.external_last_modified);
  if (lastModified) next.external_last_modified = lastModified;

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

  const extraOmit = new Set<string>();
  const attempts = [
    next,
    omitKeys(next, ['timezone']),
    omitKeys(next, ['timezone', 'property_id', 'customer_id']),
    omitKeys(next, ['timezone', 'property_id', 'customer_id', 'external_source', 'external_uid', 'external_last_modified'])
  ];
  let lastError: { message?: string; code?: string } | null = null;
  for (const layer of attempts) {
    let attempt = omitKeys(layer, [...extraOmit]);
    for (let inner = 0; inner < OPTIONAL_WRITE_COLUMNS.length + 2; inner += 1) {
      const updated = await admin.from('jobs').update(attempt).eq('id', job.id).eq('organization_id', connection.organization_id);
      if (!updated.error) return 'updated';
      lastError = updated.error;
      const unknownColumn = extractUnknownJobColumn(updated.error);
      if (unknownColumn && unknownColumn in attempt) {
        extraOmit.add(unknownColumn);
        attempt = omitKeys(attempt, [unknownColumn]);
        continue;
      }
      const classified = classifyJobWriteError(updated.error?.message || '', updated.error?.code);
      if (classified === 'invalid_timezone' && 'timezone' in attempt) {
        extraOmit.add('timezone');
        attempt = omitKeys(attempt, ['timezone']);
        continue;
      }
      if (!isMissingSchemaError(updated.error) && classified !== 'invalid_timezone' && classified !== 'schema_mismatch') {
        break;
      }
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
      let property: CalendarImportPropertyRow | null = null;
      let existing: CalendarImportJobRow | null = null;
      try {
        try {
          property = findConfidentProperty(event, properties);
        } catch {
          property = null;
        }
        existing = importedByUid.get(event.uid) || null;

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
          eventIndex: relevant.indexOf(event),
          uidHash: maskCalendarUid(event.uid),
          operation: existing ? 'update' : 'insert',
          dbCode: error && typeof error === 'object' && 'code' in error ? String((error as { code?: string }).code || '') : null,
          dbMessage: error instanceof Error ? error.message : null,
          timezone: event.timezone,
          propertyMatched: Boolean(property),
          phase: 'db_write'
        });
      }
    }

    const lastSyncAt = now.toISOString();
    const error = safeGroupedFailureMessage(failures);
    const failureReason = dominantFailureCode(failures);
    await updateCalendarImportSyncState(admin, connection.id, {
      last_sync_at: lastSyncAt,
      last_sync_error: error
    });

    return toSafeCalendarImportResult(
      { ...connection, last_sync_at: lastSyncAt, last_sync_error: error },
      counts,
      error,
      failureReason
    );
  } catch (error) {
    const message = error instanceof Error && 'code' in error ? error.message : 'The calendar feed could not be imported.';
    await updateCalendarImportSyncState(admin, connection.id, { last_sync_error: message }).catch(() => undefined);
    throw error;
  }
}
