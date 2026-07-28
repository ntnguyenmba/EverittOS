import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  contractorCanAccessJob,
  contractorJobDetailPath,
  isLegacyContractorShareNotification,
  toContractorSafeJobView
} from '@/lib/contractor-job-access';

describe('contractor job access', () => {
  it('allows assigned contractor to open upcoming and completed jobs', () => {
    assert.equal(
      contractorCanAccessJob({
        job: { id: 'job-1', status: 'new', assigned_to: 'w1' },
        workerIds: ['w1'],
        userId: 'u1'
      }),
      true
    );
    assert.equal(
      contractorCanAccessJob({
        job: { id: 'job-1', status: 'completed', assigned_to: 'w1' },
        workerIds: ['w1'],
        userId: 'u1'
      }),
      true
    );
  });

  it('allows visit-assigned and explicitly shared contractors', () => {
    assert.equal(
      contractorCanAccessJob({
        job: { id: 'job-2', status: 'new', assigned_to: null },
        workerIds: ['w2'],
        userId: 'u2',
        visits: [{ job_id: 'job-2', worker_id: 'w2' }]
      }),
      true
    );
    assert.equal(
      contractorCanAccessJob({
        job: { id: 'job-3', status: 'new', assigned_to: null },
        workerIds: ['w3'],
        userId: 'u3',
        shares: [{ record_id: 'job-3', shared_with_user_id: 'u3', access_level: 'view' }]
      }),
      true
    );
  });

  it('blocks unassigned contractors', () => {
    assert.equal(
      contractorCanAccessJob({
        job: { id: 'job-4', status: 'new', assigned_to: 'other' },
        workerIds: ['w4'],
        userId: 'u4'
      }),
      false
    );
  });

  it('marks completed jobs read-only and uses contractor-safe routes', () => {
    const view = toContractorSafeJobView({
      id: 'job-5',
      title: 'Clean house',
      status: 'completed',
      scheduled_start: '2026-07-20T09:00:00',
      address: '1 Main St'
    });
    assert.equal(view.readOnly, true);
    assert.equal(view.mode, 'completed');
    assert.equal(contractorJobDetailPath('job-5'), '/portal/contractor/jobs/job-5');
  });

  it('hides legacy technical sharing notifications', () => {
    assert.equal(
      isLegacyContractorShareNotification({
        title: 'Job shared with you',
        body: 'You now have edit access to a job record.'
      }),
      true
    );
    assert.equal(
      isLegacyContractorShareNotification({
        title: 'New job assigned',
        body: 'Kitchen cleaning tomorrow'
      }),
      false
    );
  });
});
