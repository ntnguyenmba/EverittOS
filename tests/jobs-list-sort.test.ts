import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { assignedWorkerSortName, sortJobs } from '@/lib/jobs-list-sort';

const workers = {
  'worker-a': 'Alex Rivera',
  'worker-b': 'Blake Nguyen'
};

function job(id: string, overrides: Record<string, string | null> = {}) {
  return {
    id,
    assigned_to: null,
    assigned_email: null,
    scheduled_start: '2026-09-02T09:00:00',
    created_at: '2026-08-01T00:00:00Z',
    ...overrides
  };
}

describe('jobs list assigned-worker sort', () => {
  it('keeps date as the default sort', () => {
    const rows = sortJobs([
      job('later', { scheduled_start: '2026-09-10T09:00:00' }),
      job('sooner', { scheduled_start: '2026-09-02T09:00:00' })
    ]);
    assert.deepEqual(rows.map((row) => row.id), ['sooner', 'later']);
  });

  it('puts unassigned jobs first, then workers A-Z, keeping date order inside each worker', () => {
    const rows = sortJobs(
      [
        job('blake-later', { assigned_to: 'worker-b', scheduled_start: '2026-09-10T09:00:00' }),
        job('unassigned-later', { scheduled_start: '2026-09-08T09:00:00' }),
        job('alex-later', { assigned_to: 'worker-a', scheduled_start: '2026-09-09T09:00:00' }),
        job('blake-sooner', { assigned_to: 'worker-b', scheduled_start: '2026-09-03T09:00:00' }),
        job('unassigned-sooner', { scheduled_start: '2026-09-02T09:00:00' }),
        job('alex-sooner', { assigned_to: 'worker-a', scheduled_start: '2026-09-04T09:00:00' }),
        job('email-only', { assigned_email: 'casey@example.com', scheduled_start: '2026-09-05T09:00:00' })
      ],
      'assigned',
      workers
    );

    assert.deepEqual(
      rows.map((row) => row.id),
      ['unassigned-sooner', 'unassigned-later', 'alex-sooner', 'alex-later', 'blake-sooner', 'blake-later', 'email-only']
    );
  });

  it('uses the loaded worker name map for assigned_to ids', () => {
    assert.equal(assignedWorkerSortName(job('a', { assigned_to: 'worker-a' }), workers), 'Alex Rivera');
    assert.equal(assignedWorkerSortName(job('open'), workers), null);
  });
});
