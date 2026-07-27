import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { contractorJobCalendarEvent, googleCalendarEventUrl, outlookCalendarEventUrl } from '@/lib/calendar-links';
import { contractorNavItems, CONTRACTOR_SETTINGS_PATH } from '@/lib/contractor-dashboard';
import { clientNavItems, CLIENT_SETTINGS_PATH } from '@/lib/client-portal';

describe('portal navigation menus', () => {
  it('contractor menu stays limited to portal sections', () => {
    const labels = contractorNavItems().map((item) => item.label);
    assert.deepEqual(labels, ['Overview', 'My jobs', 'Schedule', 'Earnings', 'Notifications', 'Account']);
    assert.equal(CONTRACTOR_SETTINGS_PATH, '/portal/contractor/settings');
    assert.equal(
      contractorNavItems().some((item) => /invoice|customer|billing|analytics/i.test(item.label)),
      false
    );
  });

  it('customer menu stays limited to portal sections', () => {
    const labels = clientNavItems().map((item) => item.label);
    assert.deepEqual(labels, ['Overview', 'Appointments', 'Schedule', 'Reports', 'Invoices', 'Account']);
    assert.equal(CLIENT_SETTINGS_PATH, '/portal/client/settings');
    assert.equal(
      clientNavItems().some((item) => /team|analytics|expense|quickbooks/i.test(item.label)),
      false
    );
  });
});

describe('calendar add-to-calendar helpers', () => {
  it('builds contractor-safe one-time calendar links without financial fields', () => {
    const event = contractorJobCalendarEvent({
      id: 'job-1',
      title: 'Fence repair',
      customerName: 'Ada',
      address: '1 Main St',
      date: '2026-07-28'
    });
    assert.ok(event);
    assert.equal(event?.description?.includes('Ada'), true);
    assert.equal(event?.description?.toLowerCase().includes('invoice'), false);
    assert.ok(googleCalendarEventUrl(event!).includes('calendar.google.com'));
    assert.ok(outlookCalendarEventUrl(event!).includes('outlook.live.com'));
  });
});
