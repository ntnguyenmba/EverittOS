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
      assignedNames: ['Sam']
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

  it('preserves UTC instants in Apple and Outlook ICS output', () => {
    const event = jobCalendarEvent({
      id: 'job-utc',
      title: 'UTC job',
      scheduled_start: '2026-07-31T15:00:00.000Z',
      scheduled_end: '2026-07-31T17:30:00.000Z'
    });

    assert.ok(event);
    assert.equal(event.startsAt, '2026-07-31T15:00:00.000Z');
    assert.equal(event.endsAt, '2026-07-31T17:30:00.000Z');

    const ics = generateBookingIcs({
      uid: event.id,
      title: event.title,
      startsAt: event.startsAt,
      endsAt: event.endsAt!,
      timeZone: 'America/Chicago'
    });

    assert.match(ics, /DTSTART:20260731T150000Z/);
    assert.match(ics, /DTEND:20260731T173000Z/);
    assert.doesNotMatch(ics, /DTSTART;TZID=America\/Chicago:20260731T150000/);
  });

  it('converts explicit offsets to the same UTC instant', () => {
    const event = jobCalendarEvent({
      id: 'job-offset',
      title: 'Offset job',
      scheduled_start: '2026-07-31T10:00:00-05:00',
      scheduled_end: '2026-07-31T12:00:00-05:00'
    });

    assert.ok(event);
    const ics = generateBookingIcs({
      uid: event.id,
      title: event.title,
      startsAt: event.startsAt,
      endsAt: event.endsAt!,
      timeZone: 'America/Chicago'
    });

    assert.match(ics, /DTSTART:20260731T150000Z/);
    assert.match(ics, /DTEND:20260731T170000Z/);
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
    assert.equal(event.startsAt, '2026-07-31T15:00:00.000Z');
    assert.equal(event.endsAt, '2026-07-31T17:00:00.000Z');
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

  it('masks calendar feed tokens', () => {
    assert.equal(maskCalendarToken('abcdefghijklmnop'), 'abcdef…mnop');
  });
});
