import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';
import type { SupabaseClient } from '@supabase/supabase-js';
import { disconnectCalendarImport } from '@/lib/calendar-import/connections';
import { importCalendarConnection } from '@/lib/calendar-import/import-calendar';
import { assertNoFeedSecret, toSafeCalendarImportStatus } from '@/lib/calendar-import/safe-status';
import {
  CALENDAR_IMPORT_SOURCE,
  type CalendarImportConnection,
  type CalendarImportJobRow,
  type CalendarImportPropertyRow,
  type ParsedCalendarEvent
} from '@/lib/calendar-import/types';

type Row = Record<string, unknown>;

function event(overrides: Partial<ParsedCalendarEvent> = {}): ParsedCalendarEvent {
  return {
    uid: 'evt-1',
    summary: 'Frances Ln, Little Elm (Opti) Cleaning',
    description: 'Bring supplies',
    location: '123 Frances Ln, Little Elm, TX',
    dtStart: '2026-08-14T14:10:00',
    dtEnd: '2026-08-14T16:10:00',
    startDate: '2026-08-14',
    endDate: '2026-08-14',
    timezone: 'America/Chicago',
    lastModified: '2026-08-01T12:00:00Z',
    status: 'CONFIRMED',
    allDay: false,
    ...overrides
  };
}

function connection(overrides: Partial<CalendarImportConnection> = {}): CalendarImportConnection {
  return {
    id: 'conn-1',
    organization_id: 'org-1',
    label: 'Calendar Import',
    feed_url: 'https://calendar.example.com/private/feed.ics',
    sync_enabled: true,
    default_customer_id: null,
    default_property_id: null,
    default_revenue_amount: 120,
    last_sync_at: null,
    last_sync_error: null,
    created_by: 'owner-1',
    ...overrides
  };
}

function createMemoryAdmin(state: {
  jobs?: CalendarImportJobRow[];
  properties?: CalendarImportPropertyRow[];
  connections?: CalendarImportConnection[];
  insertError?: { message?: string; code?: string } | null;
}) {
  const jobs = (state.jobs || []) as Row[];
  const properties = (state.properties || []) as Row[];
  const connections = (state.connections || [connection()]) as Row[];
  const activity: Row[] = [];
  let nextId = jobs.length + 1;

  const tables: Record<string, Row[]> = {
    jobs,
    customer_properties: properties,
    calendar_import_connections: connections,
    organization_settings: [{ organization_id: 'org-1', timezone: 'America/Chicago' }],
    organizations: [{ id: 'org-1', owner_user_id: 'owner-1' }],
    activity_logs: activity
  };

  function from(table: string) {
    const rows = tables[table] || [];
    const filters: Array<(row: Row) => boolean> = [];
    let mode: 'select' | 'insert' | 'update' | 'delete' = 'select';
    let payload: Row | null = null;

    const api = {
      select() {
        return api;
      },
      insert(value: Row) {
        mode = 'insert';
        payload = value;
        return api;
      },
      update(value: Row) {
        mode = 'update';
        payload = value;
        return api;
      },
      delete() {
        mode = 'delete';
        return api;
      },
      eq(column: string, value: unknown) {
        filters.push((row) => row[column] === value);
        return api;
      },
      in(column: string, values: unknown[]) {
        filters.push((row) => values.includes(row[column]));
        return api;
      },
      is(column: string, value: unknown) {
        filters.push((row) => row[column] == value);
        return api;
      },
      order() {
        return api;
      },
      limit() {
        return api;
      },
      maybeSingle() {
        return execute(true);
      },
      single() {
        return execute(true);
      },
      then(resolve: (value: { data: unknown; error: null }) => unknown, reject?: (reason: unknown) => unknown) {
        return execute(false).then(resolve, reject);
      }
    };

    async function execute(single: boolean) {
      if (mode === 'insert' && payload) {
        if (table === 'jobs' && state.insertError) {
          return { data: null, error: state.insertError };
        }
        if (table === 'jobs' && payload.external_uid) {
          const duplicate = rows.some(
            (row) =>
              row.organization_id === payload.organization_id &&
              row.external_source === payload.external_source &&
              row.external_uid === payload.external_uid
          );
          if (duplicate) {
            return {
              data: null,
              error: { code: '23505', message: 'duplicate key value violates unique constraint jobs_external_source_uid_unique' }
            };
          }
        }
        const row = { id: payload.id || `${table}-${nextId++}`, ...payload };
        rows.push(row);
        return { data: single ? row : [row], error: null };
      }

      const matched = rows.filter((row) => filters.every((filter) => filter(row)));
      if (mode === 'update' && payload) {
        for (const row of matched) Object.assign(row, payload);
        return { data: single ? matched[0] || null : matched, error: null };
      }
      if (mode === 'delete') {
        for (const row of matched) {
          const index = rows.indexOf(row);
          if (index >= 0) rows.splice(index, 1);
        }
        return { data: matched, error: null };
      }
      return { data: single ? matched[0] || null : matched, error: null };
    }

    return api;
  }

  return {
    admin: { from } as unknown as SupabaseClient,
    jobs: jobs as CalendarImportJobRow[],
    connections: connections as CalendarImportConnection[],
    activity
  };
}

const importOptions = {
  now: new Date('2026-08-13T12:00:00Z'),
  organizationTimeZone: 'America/Chicago',
  ownerUserId: 'owner-1',
  syncGoogle: false,
  writeActivity: true
};

describe('calendar import job sync', () => {
  it('imports the same UID twice as one job', async () => {
    const db = createMemoryAdmin({});
    const first = await importCalendarConnection(db.admin, connection(), { ...importOptions, events: [event()] });
    const second = await importCalendarConnection(db.admin, connection(), { ...importOptions, events: [event()] });
    assert.equal(first.created, 1);
    assert.equal(second.created, 0);
    assert.equal(second.skipped, 1);
    assert.equal(db.jobs.length, 1);
    assert.equal(db.jobs[0].external_uid, 'evt-1');
    assert.equal(db.jobs[0].external_source, CALENDAR_IMPORT_SOURCE);
    assert.equal(db.jobs[0].status, 'scheduled');
    assert.equal(db.jobs[0].assigned_to, null);
  });

  it('updates the same job when the UID changes calendar details', async () => {
    const db = createMemoryAdmin({});
    await importCalendarConnection(db.admin, connection(), { ...importOptions, events: [event()] });
    const result = await importCalendarConnection(db.admin, connection(), {
      ...importOptions,
      events: [event({ summary: 'Frances Ln, Little Elm (Opti) Turnover', dtStart: '2026-08-14T15:10:00' })]
    });
    assert.equal(result.updated, 1);
    assert.equal(db.jobs.length, 1);
    assert.equal(db.jobs[0].title, 'Frances Ln, Little Elm (Opti) Turnover');
    assert.equal(db.jobs[0].scheduled_start, '2026-08-14T15:10:00');
  });

  it('skips a likely manually entered duplicate and links only when confidence is high', async () => {
    const db = createMemoryAdmin({
      jobs: [
        {
          id: 'manual-1',
          organization_id: 'org-1',
          title: 'Frances Ln, Little Elm (Opti) Cleaning',
          notes: 'Entered by owner',
          address: '123 Frances Ln, Little Elm, TX',
          status: 'scheduled',
          start_date: '2026-08-14',
          due_date: '2026-08-14',
          scheduled_start: '2026-08-14T14:10:00',
          scheduled_end: '2026-08-14T16:10:00',
          timezone: 'America/Chicago',
          assigned_to: 'worker-1',
          assigned_email: 'cleaner@example.com',
          revenue_amount: 95,
          property_id: null,
          customer_id: null,
          external_source: null,
          external_uid: null,
          external_last_modified: null
        }
      ]
    });

    const result = await importCalendarConnection(db.admin, connection(), { ...importOptions, events: [event()] });
    assert.equal(result.created, 0);
    assert.equal(db.jobs.length, 1);
    assert.equal(db.jobs[0].id, 'manual-1');
    assert.equal(db.jobs[0].external_uid, 'evt-1');
    assert.equal(db.jobs[0].assigned_to, 'worker-1');
    assert.equal(db.jobs[0].revenue_amount, 95);
  });

  it('preserves assigned cleaner and manual revenue during resync', async () => {
    const db = createMemoryAdmin({
      jobs: [
        {
          id: 'job-1',
          organization_id: 'org-1',
          title: 'Frances Ln, Little Elm (Opti) Cleaning',
          notes: 'Bring supplies',
          address: '123 Frances Ln, Little Elm, TX',
          status: 'scheduled',
          start_date: '2026-08-14',
          due_date: '2026-08-14',
          scheduled_start: '2026-08-14T14:10:00',
          scheduled_end: '2026-08-14T16:10:00',
          timezone: 'America/Chicago',
          assigned_to: 'worker-9',
          assigned_email: 'assigned@example.com',
          revenue_amount: 180,
          property_id: null,
          customer_id: null,
          external_source: CALENDAR_IMPORT_SOURCE,
          external_uid: 'evt-1',
          external_last_modified: '2026-08-01T12:00:00Z'
        }
      ]
    });

    await importCalendarConnection(db.admin, connection({ default_revenue_amount: 120 }), {
      ...importOptions,
      events: [event({ lastModified: '2026-08-02T12:00:00Z' })]
    });

    assert.equal(db.jobs.length, 1);
    assert.equal(db.jobs[0].assigned_to, 'worker-9');
    assert.equal(db.jobs[0].assigned_email, 'assigned@example.com');
    assert.equal(db.jobs[0].revenue_amount, 180);
    assert.equal(db.jobs[0].external_last_modified, '2026-08-02T12:00:00Z');
  });

  it('does not delete an EverittOS job when the calendar event disappears', async () => {
    const db = createMemoryAdmin({});
    await importCalendarConnection(db.admin, connection(), { ...importOptions, events: [event()] });
    assert.equal(db.jobs.length, 1);
    const result = await importCalendarConnection(db.admin, connection(), { ...importOptions, events: [] });
    assert.equal(result.created, 0);
    assert.equal(db.jobs.length, 1);
    assert.equal(db.jobs[0].external_uid, 'evt-1');
  });

  it('does not delete imported jobs when the calendar is disconnected', async () => {
    const db = createMemoryAdmin({});
    await importCalendarConnection(db.admin, connection(), { ...importOptions, events: [event()] });
    await disconnectCalendarImport(db.admin, 'org-1');
    assert.equal(db.connections.length, 0);
    assert.equal(db.jobs.length, 1);
    assert.equal(db.jobs[0].title, 'Frances Ln, Little Elm (Opti) Cleaning');
  });

  it('never returns the private feed URL from status helpers', () => {
    const secret = connection();
    const status = toSafeCalendarImportStatus(secret);
    assert.equal(status.connected, true);
    assert.equal(status.label, 'Calendar Import');
    assert.equal('feed_url' in status, false);
    assert.equal('feedUrl' in status, false);
    assertNoFeedSecret(status);
    assert.doesNotMatch(JSON.stringify(status), /calendar\.example\.com/);
    assert.doesNotMatch(JSON.stringify(status), /feed_url/);
  });

  it('settings and jobs UI keep calendar import generic and hide amounts without financial access', () => {
    const settings = readFileSync('app/settings/page.tsx', 'utf8');
    const jobs = readFileSync('app/jobs/page.tsx', 'utf8');
    const panel = readFileSync('components/calendar-import-panel.tsx', 'utf8');
    const cron = readFileSync('vercel.json', 'utf8');
    const migration = readFileSync('supabase/migrations/202610020001_calendar_import.sql', 'utf8');
    assert.match(settings, /CalendarImportPanel/);
    assert.match(settings, /QuickBooksIntegrationPanel/);
    assert.match(jobs, /canAccessFinancials/);
    assert.match(jobs, /jobs-row-amount/);
    assert.match(jobs, /formatMoneyUsd/);
    assert.match(panel, /pages\.calendarImport/);
    assert.doesNotMatch(panel, /feed_url/);
    assert.doesNotMatch(panel, /hospitable/i);
    assert.match(cron, /\/api\/cron\/calendar-import-sync/);
    assert.match(migration, /calendar_import_connections_deny/);
    assert.match(migration, /jobs_external_source_uid_unique/);
    assert.match(migration, /using \(false\)/);
  });

  it('status API selects only safe connection columns', () => {
    const source = readFileSync('app/api/integrations/calendar-import/status/route.ts', 'utf8');
    assert.match(source, /toSafeCalendarImportStatus/);
    assert.match(source, /assertNoFeedSecret/);
    assert.doesNotMatch(source, /includeFeedUrl:\s*true/);
    assert.doesNotMatch(source, /feed_url/);
    assert.doesNotMatch(source, /feedUrl/);
  });

  it('matches a property when the title is a confident location name', async () => {
    const db = createMemoryAdmin({
      properties: [
        {
          id: 'prop-1',
          organization_id: 'org-1',
          customer_id: 'cust-1',
          name: 'Frances Ln, Little Elm (Opti)',
          address: '123 Frances Ln, Little Elm, TX',
          formatted_address: '123 Frances Ln, Little Elm, TX',
          timezone: 'America/Chicago',
          is_archived: false
        }
      ]
    });
    await importCalendarConnection(db.admin, connection({ default_revenue_amount: null }), {
      ...importOptions,
      events: [event()]
    });
    assert.equal(db.jobs[0].property_id, 'prop-1');
    assert.equal(db.jobs[0].customer_id, 'cust-1');
    assert.equal(db.jobs[0].revenue_amount, null);
  });

  it('still imports when no property matches', async () => {
    const db = createMemoryAdmin({ properties: [] });
    const result = await importCalendarConnection(db.admin, connection({ default_revenue_amount: null }), {
      ...importOptions,
      events: [event({ location: null })]
    });
    assert.equal(result.created, 1);
    assert.equal(result.failed, 0);
    assert.equal(db.jobs[0].property_id, null);
    assert.equal(db.jobs[0].customer_id, null);
    assert.equal(db.jobs[0].assigned_to, null);
    assert.equal((db.jobs[0] as CalendarImportJobRow & { user_id?: string }).user_id, 'owner-1');
    assert.equal(db.jobs[0].organization_id, 'org-1');
  });

  it('imports a multi-event ICS feed with no failures', async () => {
    const db = createMemoryAdmin({});
    const icsText = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//Example//Calendar//EN',
      'BEGIN:VEVENT',
      'UID:example-123',
      'SUMMARY:Frances Ln, Little Elm (Opti) Cleaning',
      'DTSTART;TZID=America/Chicago:20260814T141000',
      'DTEND;TZID=America/Chicago:20260814T171000',
      'DESCRIPTION:Cleaning task',
      'LOCATION:Frances Ln, Little Elm',
      'END:VEVENT',
      'BEGIN:VEVENT',
      'UID:utc-job-1',
      'SUMMARY:Second home cleaning',
      'DTSTART:20260814T191000Z',
      'DTEND:20260814T221000Z',
      'END:VEVENT',
      'BEGIN:VEVENT',
      'UID:all-day-job-1',
      'SUMMARY:All day turnover',
      'DTSTART;VALUE=DATE:20260815',
      'DTEND;VALUE=DATE:20260816',
      'END:VEVENT',
      'END:VCALENDAR'
    ].join('\r\n');

    const result = await importCalendarConnection(db.admin, connection({ default_revenue_amount: null }), {
      ...importOptions,
      icsText
    });
    assert.equal(result.created, 3);
    assert.equal(result.updated, 0);
    assert.ok(result.skipped >= 0);
    assert.equal(result.failed, 0);
    assert.equal(result.error, null);
    assert.equal(db.jobs.length, 3);
    assert.ok(db.jobs.every((job) => job.assigned_to == null));
  });

  it('imports local timezone, UTC, and all-day events without failures', async () => {
    const db = createMemoryAdmin({});
    const result = await importCalendarConnection(db.admin, connection({ default_revenue_amount: null }), {
      ...importOptions,
      events: [
        event({ uid: 'local-1' }),
        event({
          uid: 'utc-1',
          summary: 'UTC cleaning',
          dtStart: '2026-08-14T14:10:00',
          dtEnd: '2026-08-14T17:10:00'
        }),
        event({
          uid: 'all-day-1',
          summary: 'All day turnover',
          dtStart: '2026-08-14T00:00:00',
          dtEnd: '2026-08-14T00:00:00',
          startDate: '2026-08-14',
          endDate: '2026-08-14',
          allDay: true,
          location: null,
          description: null
        })
      ]
    });
    assert.equal(result.created, 3);
    assert.equal(result.failed, 0);
    assert.equal(result.error, null);
    assert.equal(db.jobs.length, 3);
  });

  it('counts a conservative manual duplicate as skipped, not failed', async () => {
    const db = createMemoryAdmin({
      jobs: [
        {
          id: 'manual-2',
          organization_id: 'org-1',
          title: 'Frances Ln, Little Elm (Opti) Cleaning extra note',
          notes: null,
          address: null,
          status: 'scheduled',
          start_date: '2026-08-14',
          due_date: '2026-08-14',
          scheduled_start: '2026-08-14T14:10:00',
          scheduled_end: '2026-08-14T16:10:00',
          timezone: 'America/Chicago',
          assigned_to: null,
          assigned_email: null,
          revenue_amount: null,
          property_id: null,
          customer_id: null,
          external_source: null,
          external_uid: null,
          external_last_modified: null
        }
      ]
    });
    const result = await importCalendarConnection(db.admin, connection(), {
      ...importOptions,
      events: [event()]
    });
    assert.equal(result.created, 0);
    assert.equal(result.failed, 0);
    assert.equal(result.skipped, 1);
    assert.equal(db.jobs.length, 1);
    assert.equal(db.jobs[0].external_uid, null);
  });

  it('marks a cancelled calendar event on an existing job without deleting it', async () => {
    const db = createMemoryAdmin({});
    await importCalendarConnection(db.admin, connection(), { ...importOptions, events: [event()] });
    const result = await importCalendarConnection(db.admin, connection(), {
      ...importOptions,
      events: [event({ status: 'CANCELLED', lastModified: '2026-08-03T12:00:00Z' })]
    });
    assert.equal(result.failed, 0);
    assert.equal(db.jobs.length, 1);
    assert.equal(db.jobs[0].status, 'cancelled');
    assert.equal(db.jobs[0].title, 'Frances Ln, Little Elm (Opti) Cleaning');
  });

  it('skips a cancelled event that was never imported', async () => {
    const db = createMemoryAdmin({});
    const result = await importCalendarConnection(db.admin, connection(), {
      ...importOptions,
      events: [event({ status: 'CANCELLED' })]
    });
    assert.equal(result.created, 0);
    assert.equal(result.failed, 0);
    assert.equal(result.skipped, 1);
    assert.equal(db.jobs.length, 0);
  });

  it('imports events that omit description and location', async () => {
    const db = createMemoryAdmin({});
    const result = await importCalendarConnection(db.admin, connection({ default_revenue_amount: null }), {
      ...importOptions,
      events: [event({ description: null, location: null })]
    });
    assert.equal(result.created, 1);
    assert.equal(result.failed, 0);
    assert.equal(db.jobs[0].notes, null);
  });

  it('treats a unique UID conflict as an update or skip, not a failure', async () => {
    const db = createMemoryAdmin({
      jobs: [
        {
          id: 'existing-uid',
          organization_id: 'org-1',
          title: 'Old title',
          notes: 'Bring supplies',
          address: '123 Frances Ln, Little Elm, TX',
          status: 'scheduled',
          start_date: '2026-08-14',
          due_date: '2026-08-14',
          scheduled_start: '2026-08-14T14:10:00',
          scheduled_end: '2026-08-14T16:10:00',
          timezone: 'America/Chicago',
          assigned_to: 'keep-me',
          assigned_email: 'keep@example.com',
          revenue_amount: 77,
          property_id: null,
          customer_id: null,
          external_source: CALENDAR_IMPORT_SOURCE,
          external_uid: 'evt-1',
          external_last_modified: '2026-08-01T12:00:00Z'
        }
      ]
    });
    const result = await importCalendarConnection(db.admin, connection(), {
      ...importOptions,
      events: [event({ summary: 'Updated from calendar' })]
    });
    assert.equal(result.failed, 0);
    assert.equal(result.created, 0);
    assert.equal(result.updated, 1);
    assert.equal(db.jobs.length, 1);
    assert.equal(db.jobs[0].title, 'Updated from calendar');
    assert.equal(db.jobs[0].assigned_to, 'keep-me');
    assert.equal(db.jobs[0].revenue_amount, 77);
  });

  it('treats a concurrent unique conflict as skipped, not failed', async () => {
    const db = createMemoryAdmin({
      insertError: { code: '23505', message: 'duplicate key value violates unique constraint jobs_external_source_uid_unique' }
    });
    const result = await importCalendarConnection(db.admin, connection(), {
      ...importOptions,
      events: [event()]
    });
    assert.equal(result.failed, 0);
    assert.equal(result.created, 0);
    assert.equal(result.skipped, 1);
    assert.equal(result.error, null);
  });

  it('does not expose the feed URL when a job insert fails', async () => {
    const db = createMemoryAdmin({
      insertError: { code: '23502', message: 'null value in column "title" of relation "jobs" violates not-null constraint' }
    });
    const result = await importCalendarConnection(db.admin, connection(), {
      ...importOptions,
      events: [event()]
    });
    assert.equal(result.failed, 1);
    assert.equal(result.created, 0);
    assert.match(String(result.error), /could not be saved as a job/i);
    const serialized = JSON.stringify(result);
    assert.doesNotMatch(serialized, /calendar\.example\.com/);
    assert.doesNotMatch(serialized, /feed_url/);
    assert.doesNotMatch(serialized, /feedUrl/);
    assert.doesNotMatch(serialized, /private\/feed/);
    assert.doesNotMatch(String(result.error), /23502|PostgREST|schema/i);
  });

  it('connect UI no longer sends a default job amount', () => {
    const panel = readFileSync('components/calendar-import-panel.tsx', 'utf8');
    const connect = readFileSync('app/api/integrations/calendar-import/connect/route.ts', 'utf8');
    assert.match(panel, /JSON\.stringify\(\{\s*feedUrl\s*\}\)/);
    assert.doesNotMatch(panel, /defaultRevenueAmount/);
    assert.doesNotMatch(panel, /defaultAmount/);
    assert.doesNotMatch(panel, /Default job amount/i);
    assert.doesNotMatch(connect, /defaultRevenueAmount/);
    assert.doesNotMatch(connect, /default_revenue_amount/);
  });
});
