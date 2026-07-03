import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  activityEntityHref,
  isActiveJobStatus,
  isCompletedJobStatus,
  jobEffectiveDate,
  normalizeTeamCommandCenterData,
  resolveWorkloadStatus
} from '@/lib/team-command-center';

describe('team command center helpers', () => {
  it('resolves workload status thresholds', () => {
    assert.equal(resolveWorkloadStatus(0, 0, 0), 'available');
    assert.equal(resolveWorkloadStatus(3, 0, 0), 'available');
    assert.equal(resolveWorkloadStatus(4, 0, 0), 'busy');
    assert.equal(resolveWorkloadStatus(2, 0, 1), 'busy');
    assert.equal(resolveWorkloadStatus(8, 0, 0), 'overloaded');
    assert.equal(resolveWorkloadStatus(1, 1, 0), 'overloaded');
  });

  it('classifies active and completed job statuses', () => {
    assert.equal(isActiveJobStatus('new'), true);
    assert.equal(isActiveJobStatus('completed'), false);
    assert.equal(isActiveJobStatus('cancelled'), false);
    assert.equal(isCompletedJobStatus('done'), true);
    assert.equal(isCompletedJobStatus('in_progress'), false);
  });

  it('prefers due_date over scheduled_start for effective date', () => {
    assert.equal(
      jobEffectiveDate({ due_date: '2026-05-10', scheduled_start: '2026-05-01' }),
      '2026-05-10'
    );
    assert.equal(jobEffectiveDate({ due_date: null, scheduled_start: '2026-05-01T09:00:00Z' }), '2026-05-01');
    assert.equal(jobEffectiveDate({ due_date: null, scheduled_start: null }), null);
  });

  it('builds entity links for supported activity types', () => {
    assert.equal(activityEntityHref('job', 'job-1'), '/jobs/job-1');
    assert.equal(activityEntityHref('customer', 'cust-1'), '/customers/cust-1');
    assert.equal(activityEntityHref('invoice', 'inv-1'), null);
    assert.equal(activityEntityHref(null, 'job-1'), null);
  });

  it('normalizes partial API payloads with safe defaults', () => {
    const normalized = normalizeTeamCommandCenterData({
      members: undefined,
      recentActivity: null,
      totals: { activeJobs: 3 }
    });

    assert.deepEqual(normalized.members, []);
    assert.deepEqual(normalized.recentActivity, []);
    assert.equal(normalized.totals.activeJobs, 3);
    assert.equal(normalized.totals.teamMembers, 0);
    assert.match(normalized.jobsThisMonthFrom, /^\d{4}-\d{2}-\d{2}$/);
  });
});
