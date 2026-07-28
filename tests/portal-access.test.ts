import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { contractorJobCalendarEvent, googleCalendarEventUrl, outlookCalendarEventUrl } from '@/lib/calendar-links';
import { contractorNavItems, CONTRACTOR_SETTINGS_PATH } from '@/lib/contractor-dashboard';
import { clientNavItems, CLIENT_SETTINGS_PATH } from '@/lib/client-portal';
import { minimumPlanForPath } from '@/lib/plan-access';
import {
  clientPortalJobsPath,
  inviteAcceptLandingPath,
  isClientAllowedPath,
  isContractorAllowedPath,
  isTeamInviteAcceptPath
} from '@/lib/portal-access';

describe('portal navigation menus', () => {
  it('contractor menu stays limited to portal sections', () => {
    const labels = contractorNavItems().map((item) => item.label);
    assert.deepEqual(labels, ['Dashboard', 'Jobs', 'Schedule', 'Earnings', 'Settings']);
    assert.equal(CONTRACTOR_SETTINGS_PATH, '/portal/contractor/settings');
    assert.equal(
      contractorNavItems().some((item) => /invoice|customer|billing|analytics/i.test(item.label)),
      false
    );
  });

  it('customer menu stays limited to portal sections', () => {
    const labels = clientNavItems().map((item) => item.label);
    assert.deepEqual(labels, ['Dashboard', 'Appointments', 'Settings']);
    assert.equal(CLIENT_SETTINGS_PATH, '/portal/client/settings');
    assert.equal(clientNavItems().find((item) => item.id === 'jobs')?.href, '/portal/client/jobs');
    assert.equal(
      clientNavItems().some((item) => /team|analytics|expense|quickbooks|invoice/i.test(item.label)),
      false
    );
  });
});

describe('client invite access bypasses subscription walls', () => {
  it('does not require a paid plan for invite acceptance', () => {
    assert.equal(minimumPlanForPath('/team/accept'), null);
    assert.equal(minimumPlanForPath('/team/accept/'), null);
    assert.equal(minimumPlanForPath('/team'), 'business');
  });

  it('allowlists invite accept and client job routes for portal roles', () => {
    assert.equal(isTeamInviteAcceptPath('/team/accept'), true);
    assert.equal(isTeamInviteAcceptPath('/team/accept?token=abc'), true);
    assert.equal(isClientAllowedPath('/team/accept'), true);
    assert.equal(isContractorAllowedPath('/team/accept'), true);
    assert.equal(isClientAllowedPath('/portal/client/jobs/job-1'), true);
    assert.equal(isClientAllowedPath('/settings/billing'), false);
    assert.equal(isClientAllowedPath('/pricing'), false);
  });

  it('lands clients on shared jobs, never billing or owner dashboard', () => {
    assert.equal(clientPortalJobsPath('job-1'), '/portal/client/jobs/job-1');
    assert.equal(clientPortalJobsPath(), '/portal/client/jobs');
    assert.equal(inviteAcceptLandingPath('client', { jobId: 'job-1' }), '/portal/client/jobs/job-1');
    assert.equal(inviteAcceptLandingPath('client', { sharedJobIds: ['a', 'b'] }), '/portal/client/jobs');
    assert.equal(inviteAcceptLandingPath('client', { sharedJobIds: ['only'] }), '/portal/client/jobs/only');
    assert.equal(inviteAcceptLandingPath('contractor'), '/portal/contractor');
    assert.equal(inviteAcceptLandingPath('owner'), '/dashboard');
    assert.equal(inviteAcceptLandingPath('client').includes('billing'), false);
    assert.equal(inviteAcceptLandingPath('client').includes('pricing'), false);
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
