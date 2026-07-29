import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { SupabaseClient } from '@supabase/supabase-js';
import { buildAuthorizedCalendarFeedIcs } from '@/lib/calendar-feed';

type JobRow = {
  id: string;
  title: string;
  customer_name?: string | null;
  address?: string | null;
  notes?: string | null;
  scheduled_start?: string | null;
  scheduled_end?: string | null;
  status?: string | null;
  updated_at?: string | null;
};

function mockAdmin(jobs: JobRow[]): SupabaseClient {
  const query = {
    select() { return this; },
    eq() { return this; },
    not() { return this; },
    order() { return this; },
    limit() { return Promise.resolve({ data: jobs, error: null }); },
    in() { return this; },
    or() { return this; }
  };

  return {
    from(table: string) {
      assert.equal(table, 'jobs');
      return query;
    }
  } as unknown as SupabaseClient;
}

describe('authorized calendar feed', () => {
  it('generates a complete Apple and Outlook compatible ICS feed without shifting UTC jobs', async () => {
    const ics = await buildAuthorizedCalendarFeedIcs({
      admin: mockAdmin([
        {
          id: 'job-utc',
          title: 'Little Elm turnover',
          customer_name: 'Urban Bliss Ventures',
          address: '2708 Sunlight Ln, Little Elm, TX',
          notes: 'Finish before guest check-in',
          scheduled_start: '2026-07-31T15:00:00.000Z',
          scheduled_end: '2026-07-31T19:30:00.000Z',
          status: 'scheduled',
          updated_at: '2026-07-29T14:00:00.000Z'
        }
      ]),
      organizationId: 'org-1',
      userId: 'owner-1',
      role: 'owner',
      timeZone: 'America/Chicago'
    });

    assert.match(ics, /^BEGIN:VCALENDAR\r\n/);
    assert.match(ics, /PRODID:-\/\/EverittOS\/\/Authorized Job Schedule\/\/EN/);
    assert.match(ics, /X-WR-TIMEZONE:America\/Chicago/);
    assert.match(ics, /REFRESH-INTERVAL;VALUE=DURATION:PT15M/);
    assert.match(ics, /BEGIN:VEVENT/);
    assert.match(ics, /UID:job-utc-tz2@everittos\.com/);
    assert.match(ics, /DTSTART:20260731T150000Z/);
    assert.match(ics, /DTEND:20260731T193000Z/);
    assert.doesNotMatch(ics, /DTSTART;TZID=America\/Chicago:20260731T150000/);
    assert.match(ics, /SUMMARY:Little Elm turnover/);
    assert.match(ics, /LOCATION:2708 Sunlight Ln\, Little Elm\, TX/);
    assert.match(ics, /Customer: Urban Bliss Ventures/);
    assert.match(ics, /Finish before guest check-in/);
    assert.match(ics, /END:VEVENT\r\nEND:VCALENDAR\r\n$/);
  });

  it('uses the workspace timezone for true local wall-clock job values', async () => {
    const ics = await buildAuthorizedCalendarFeedIcs({
      admin: mockAdmin([
        {
          id: 'job-local',
          title: 'Local wall clock job',
          scheduled_start: '2026-11-02T10:00:00',
          scheduled_end: '2026-11-02T12:00:00',
          status: 'scheduled'
        }
      ]),
      organizationId: 'org-1',
      userId: 'owner-1',
      role: 'owner',
      timeZone: 'America/Chicago'
    });

    assert.match(ics, /DTSTART;TZID=America\/Chicago:20261102T100000/);
    assert.match(ics, /DTEND;TZID=America\/Chicago:20261102T120000/);
    assert.doesNotMatch(ics, /DTSTART:20261102T100000Z/);
  });

  it('keeps multiple events inside one valid calendar envelope', async () => {
    const ics = await buildAuthorizedCalendarFeedIcs({
      admin: mockAdmin([
        {
          id: 'job-1',
          title: 'First job',
          scheduled_start: '2026-08-01T14:00:00.000Z',
          scheduled_end: '2026-08-01T16:00:00.000Z',
          status: 'scheduled'
        },
        {
          id: 'job-2',
          title: 'Second job',
          scheduled_start: '2026-08-02T15:00:00.000Z',
          scheduled_end: '2026-08-02T17:00:00.000Z',
          status: 'scheduled'
        }
      ]),
      organizationId: 'org-1',
      userId: 'owner-1',
      role: 'owner',
      timeZone: 'America/Chicago'
    });

    assert.equal((ics.match(/BEGIN:VCALENDAR/g) || []).length, 1);
    assert.equal((ics.match(/END:VCALENDAR/g) || []).length, 1);
    assert.equal((ics.match(/BEGIN:VEVENT/g) || []).length, 2);
    assert.equal((ics.match(/END:VEVENT/g) || []).length, 2);
    assert.match(ics, /DTSTART:20260801T140000Z/);
    assert.match(ics, /DTSTART:20260802T150000Z/);
  });
});
