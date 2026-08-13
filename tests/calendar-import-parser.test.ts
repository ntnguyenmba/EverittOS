import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { parseIcsCalendar, parseIcsDateTime, unescapeIcsText } from '@/lib/calendar-import/ical-parser';

describe('iCalendar parser', () => {
  it('parses a normal VEVENT', () => {
    const ics = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//Example//Calendar//EN',
      'BEGIN:VEVENT',
      'UID:evt-1@example.com',
      'SUMMARY:Frances Ln, Little Elm (Opti) Cleaning',
      'DTSTART;TZID=America/Chicago:20260814T141000',
      'DTEND;TZID=America/Chicago:20260814T161000',
      'DESCRIPTION:Bring supplies',
      'LOCATION:123 Frances Ln, Little Elm, TX',
      'LAST-MODIFIED:20260801T120000Z',
      'STATUS:CONFIRMED',
      'END:VEVENT',
      'END:VCALENDAR'
    ].join('\r\n');

    const events = parseIcsCalendar(ics);
    assert.equal(events.length, 1);
    assert.equal(events[0].uid, 'evt-1@example.com');
    assert.equal(events[0].summary, 'Frances Ln, Little Elm (Opti) Cleaning');
    assert.equal(events[0].dtStart, '2026-08-14T14:10:00');
    assert.equal(events[0].dtEnd, '2026-08-14T16:10:00');
    assert.equal(events[0].startDate, '2026-08-14');
    assert.equal(events[0].endDate, '2026-08-14');
    assert.equal(events[0].timezone, 'America/Chicago');
    assert.equal(events[0].description, 'Bring supplies');
    assert.equal(events[0].location, '123 Frances Ln, Little Elm, TX');
    assert.equal(events[0].status, 'CONFIRMED');
    assert.equal(events[0].lastModified, '2026-08-01T12:00:00Z');
    assert.equal(events[0].allDay, false);
  });

  it('unfolds folded ICS lines', () => {
    const ics = [
      'BEGIN:VCALENDAR',
      'BEGIN:VEVENT',
      'UID:fold-1',
      'SUMMARY:Frances Ln, Little Elm (Opti)',
      '  Cleaning',
      'DESCRIPTION:Line one\\n',
      ' Line two',
      'DTSTART:20260814T141000',
      'END:VEVENT',
      'END:VCALENDAR'
    ].join('\n');

    const events = parseIcsCalendar(ics);
    assert.equal(events[0].summary, 'Frances Ln, Little Elm (Opti) Cleaning');
    assert.equal(events[0].description, 'Line one\nLine two');
  });

  it('unescapes ICS text', () => {
    assert.equal(unescapeIcsText('Hello\\, world\\; next\\\\line\\nMore'), 'Hello, world; next\\line\nMore');
  });

  it('parses timezone-aware UTC values into wall-clock time', () => {
    const parsed = parseIcsDateTime('20260814T191000Z', {}, 'America/Chicago');
    assert.equal(parsed.timezone, 'America/Chicago');
    assert.equal(parsed.wallClock, '2026-08-14T14:10:00');
    assert.equal(parsed.date, '2026-08-14');
    assert.equal(parsed.utcIso, '2026-08-14T19:10:00Z');
  });

  it('parses all-day events and treats DTEND as exclusive', () => {
    const ics = [
      'BEGIN:VCALENDAR',
      'X-WR-TIMEZONE:America/Chicago',
      'BEGIN:VEVENT',
      'UID:all-day-1',
      'SUMMARY:All day turnover',
      'DTSTART;VALUE=DATE:20260814',
      'DTEND;VALUE=DATE:20260815',
      'END:VEVENT',
      'END:VCALENDAR'
    ].join('\n');

    const events = parseIcsCalendar(ics);
    assert.equal(events[0].allDay, true);
    assert.equal(events[0].startDate, '2026-08-14');
    assert.equal(events[0].endDate, '2026-08-14');
    assert.equal(events[0].timezone, 'America/Chicago');
  });

  it('parses a local timezone event used by property-management calendars', () => {
    const ics = [
      'BEGIN:VCALENDAR',
      'BEGIN:VEVENT',
      'UID:example-123',
      'SUMMARY:Frances Ln, Little Elm (Opti) Cleaning',
      'DTSTART;TZID=America/Chicago:20260814T141000',
      'DTEND;TZID=America/Chicago:20260814T171000',
      'DESCRIPTION:Cleaning task',
      'LOCATION:Frances Ln, Little Elm',
      'END:VEVENT',
      'END:VCALENDAR'
    ].join('\n');

    const events = parseIcsCalendar(ics);
    assert.equal(events[0].uid, 'example-123');
    assert.equal(events[0].dtStart, '2026-08-14T14:10:00');
    assert.equal(events[0].dtEnd, '2026-08-14T17:10:00');
    assert.equal(events[0].timezone, 'America/Chicago');
  });

  it('parses UTC start and end times', () => {
    const ics = [
      'BEGIN:VCALENDAR',
      'BEGIN:VEVENT',
      'UID:utc-1',
      'SUMMARY:UTC cleaning',
      'DTSTART:20260814T191000Z',
      'DTEND:20260814T221000Z',
      'END:VEVENT',
      'END:VCALENDAR'
    ].join('\n');

    const events = parseIcsCalendar(ics, 'America/Chicago');
    assert.equal(events[0].dtStart, '2026-08-14T14:10:00');
    assert.equal(events[0].dtEnd, '2026-08-14T17:10:00');
    assert.equal(events[0].timezone, 'America/Chicago');
  });

  it('imports events that omit LOCATION', () => {
    const ics = [
      'BEGIN:VCALENDAR',
      'BEGIN:VEVENT',
      'UID:no-location-1',
      'SUMMARY:Unlocated cleaning',
      'DTSTART;TZID=America/Chicago:20260814T141000',
      'DTEND;TZID=America/Chicago:20260814T171000',
      'END:VEVENT',
      'END:VCALENDAR'
    ].join('\n');

    const events = parseIcsCalendar(ics);
    assert.equal(events[0].location, null);
    assert.equal(events[0].summary, 'Unlocated cleaning');
  });

  it('keeps events that omit DESCRIPTION', () => {
    const ics = [
      'BEGIN:VCALENDAR',
      'BEGIN:VEVENT',
      'UID:no-desc-1',
      'SUMMARY:No notes cleaning',
      'DTSTART;TZID=America/Chicago:20260814T141000',
      'END:VEVENT',
      'END:VCALENDAR'
    ].join('\n');

    const events = parseIcsCalendar(ics);
    assert.equal(events[0].description, null);
    assert.equal(events[0].uid, 'no-desc-1');
  });
});
