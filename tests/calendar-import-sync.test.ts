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
});
