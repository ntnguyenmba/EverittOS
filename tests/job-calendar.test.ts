import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
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
