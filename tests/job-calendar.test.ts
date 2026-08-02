import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { generateBookingIcs } from '@/lib/booking/ics';
import { googleCalendarEventUrl, outlookCalendarEventUrl } from '@/lib/calendar-links';
import { jobCalendarEvent } from '@/lib/job-calendar';
import { maskCalendarToken } from '@/lib/calendar-feed';

describe('job calendar export', () => {
  it('builds calendar-safe job events without financial fields', () => {
    const event = jobCalendarEvent({
      id: 'job-1',
      title: 'Lawn service',
      customer_name: 'Ada',
      address: '1 Main St',
      notes: 'Gate code 1234',
      scheduled_start: '2026-07-28T15:00:00.000Z',
      scheduled_end: '2026-07-28T17:00:00.000Z',
      assignedNames: ['Sam'],
      timezone: 'America/Chicago'
    });

    assert.ok(event);
    assert.equal(event?.title, 'Lawn service');
    assert.match(event?.description || '', /Customer: Ada/);
    assert.match(event?.description || '', /Assigned: Sam/);
    assert.match(event?.description || '', /\/jobs\/job-1/);
    assert.doesNotMatch(event?.description || '', /invoice|profit|payment/i);
    assert.ok(googleCalendarEventUrl(event!).includes('calendar.google.com'));
    assert.ok(outlookCalendarEventUrl(event!).includes('outlook.live.com'));
  });

  it('converts Chicago summer wall-clock times to the correct UTC instant for Google and Outlook', () => {
    const event = {
      id: 'job-summer',
      title: 'Summer job',
      startsAt: '2026-07-31T10:00:00',
      endsAt: '2026-07-31T12:00:00',
      timeZone: 'America/Chicago'
    };
    const google = new URL(googleCalendarEventUrl(event));
    const outlook = new URL(outlookCalendarEventUrl(event));

    assert.equal(google.searchParams.get('dates'), '20260731T150000Z/20260731T170000Z');
    assert.equal(google.searchParams.get('ctz'), 'America/Chicago');
    assert.equal(outlook.searchParams.get('startdt'), '2026-07-31T15:00:00.000Z');
    assert.equal(outlook.searchParams.get('enddt'), '2026-07-31T17:00:00.000Z');
  });

  it('converts Chicago winter wall-clock times with the DST offset change', () => {
    const event = {
      id: 'job-winter',
      title: 'Winter job',
      startsAt: '2026-12-15T10:00:00',
      endsAt: '2026-12-15T12:00:00',
      timeZone: 'America/Chicago'
    };
    const google = new URL(googleCalendarEventUrl(event));
    const outlook = new URL(outlookCalendarEventUrl(event));

    assert.equal(google.searchParams.get('dates'), '20261215T160000Z/20261215T180000Z');
    assert.equal(outlook.searchParams.get('startdt'), '2026-12-15T16:00:00.000Z');
    assert.equal(outlook.searchParams.get('enddt'), '2026-12-15T18:00:00.000Z');
  });

  it('preserves explicit timestamp offsets instead of converting them as wall-clock values', () => {
    const event = {
      id: 'job-explicit-offset',
      title: 'Explicit offset job',
      startsAt: '2026-07-31T10:00:00-05:00',
      endsAt: '2026-07-31T12:00:00-05:00',
      timeZone: 'America/Chicago'
    };
    const google = new URL(googleCalendarEventUrl(event));
    const outlook = new URL(outlookCalendarEventUrl(event));

    assert.equal(google.searchParams.get('dates'), '20260731T150000Z/20260731T170000Z');
    assert.equal(outlook.searchParams.get('startdt'), '2026-07-31T15:00:00.000Z');
    assert.equal(outlook.searchParams.get('enddt'), '2026-07-31T17:00:00.000Z');
  });

  it('uses a two-hour wall-clock duration before timezone conversion when no end is supplied', () => {
    const event = {
      id: 'job-default-link-end',
      title: 'Default link end',
      startsAt: '2026-07-31T10:00:00',
      timeZone: 'America/Chicago'
    };
    const google = new URL(googleCalendarEventUrl(event));

    assert.equal(google.searchParams.get('dates'), '20260731T150000Z/20260731T170000Z');
  });

  it('treats stored Z timestamps as job wall-clock values for ICS output', () => {
    const event = jobCalendarEvent({
      id: 'job-utc',
      title: 'UTC job',
      scheduled_start: '2026-07-31T15:00:00.000Z',
      scheduled_end: '2026-07-31T17:30:00.000Z',
      timezone: 'America/Chicago'
    });

    assert.ok(event);
    assert.equal(event.startsAt, '2026-07-31T15:00:00');
    assert.equal(event.endsAt, '2026-07-31T17:30:00');

    const ics = generateBookingIcs({
      uid: event.id,
      title: event.title,
      startsAt: event.startsAt,
      endsAt: event.endsAt!,
      timeZone: 'America/Chicago'
    });

    assert.match(ics, /DTSTART;TZID=America\/Chicago:20260731T150000/);
    assert.match(ics, /DTEND;TZID=America\/Chicago:20260731T173000/);
    assert.doesNotMatch(ics, /DTSTART:20260731T150000Z/);
  });

  it('keeps clock components from offset timestamps as wall-clock values', () => {
    const event = jobCalendarEvent({
      id: 'job-offset',
      title: 'Offset job',
      scheduled_start: '2026-07-31T10:00:00-05:00',
      scheduled_end: '2026-07-31T12:00:00-05:00',
      timezone: 'America/Chicago'
    });

    assert.ok(event);
    const ics = generateBookingIcs({
      uid: event.id,
      title: event.title,
      startsAt: event.startsAt,
      endsAt: event.endsAt!,
      timeZone: 'America/Chicago'
    });

    assert.match(ics, /DTSTART;TZID=America\/Chicago:20260731T100000/);
    assert.match(ics, /DTEND;TZID=America\/Chicago:20260731T120000/);
  });

  it('uses the workspace timezone only for timezone-less wall-clock values', () => {
    const event = jobCalendarEvent({
      id: 'job-local',
      title: 'Local job',
      scheduled_start: '2026-07-31T10:00:00',
      scheduled_end: '2026-07-31T12:00:00'
    });

    assert.ok(event);
    const ics = generateBookingIcs({
      uid: event.id,
      title: event.title,
      startsAt: event.startsAt,
      endsAt: event.endsAt!,
      timeZone: 'America/Chicago'
    });

    assert.match(ics, /DTSTART;TZID=America\/Chicago:20260731T100000/);
    assert.match(ics, /DTEND;TZID=America\/Chicago:20260731T120000/);
  });

  it('keeps the default two-hour duration for explicit timezone timestamps', () => {
    const event = jobCalendarEvent({
      id: 'job-default-end',
      title: 'Default end job',
      scheduled_start: '2026-07-31T15:00:00.000Z'
    });

    assert.ok(event);
    assert.equal(event.startsAt, '2026-07-31T15:00:00');
    assert.equal(event.endsAt, '2026-07-31T17:00:00');
  });

  it('returns null when the job has no schedule date', () => {
    assert.equal(
      jobCalendarEvent({
        id: 'job-2',
        title: 'Unscheduled',
        customer_name: 'Ada'
      }),
      null
    );
  });

  it('masks calendar tokens for logs', () => {
    assert.equal(maskCalendarToken('abcdefghijklmnop'), 'abcdef…mnop');
  });
});
