import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  buildAssignmentWorkerIdsByJob,
  getAssignedWorkerId,
  getEffectiveJobSchedule,
  getWorkerAssignmentSummary,
  isJobAssignedToWorker,
  normalizeJobStatus,
  workerIdentityAliases
} from '@/lib/worker-assignment';

const TODAY = '2026-07-14';

describe('worker assignment helpers', () => {
  it('reads canonical assigned_to and normalizes statuses', () => {
    assert.equal(getAssignedWorkerId({ assigned_to: 'worker-a' }), 'worker-a');
    assert.equal(getAssignedWorkerId({ assigned_to: '  ' }), null);
    assert.equal(normalizeJobStatus('DONE'), 'completed');
    assert.equal(normalizeJobStatus('canceled'), 'cancelled');
    assert.equal(normalizeJobStatus('in_progress'), 'active');
  });

  it('prefers scheduled_start, then start_date, then due_date', () => {
    assert.equal(
      getEffectiveJobSchedule({
        scheduled_start: '2026-07-20T09:00:00Z',
        start_date: '2026-07-18',
        due_date: '2026-07-10'
      }),
      '2026-07-20 · 9:00 AM'
    );
    assert.equal(
      getEffectiveJobSchedule({
        scheduled_start: null,
        start_date: '2026-07-18',
        due_date: '2026-07-10'
      }),
      '2026-07-18'
    );
    assert.equal(
      getEffectiveJobSchedule({
        scheduled_start: null,
        start_date: null,
        due_date: '2026-07-10'
      }),
      '2026-07-10'
    );
    assert.equal(getEffectiveJobSchedule({ scheduled_start: null, start_date: null, due_date: null }), null);
  });

  it('matches worker id and legacy auth user id assignments', () => {
    const identity = { userId: 'user-a', workerIds: ['worker-a'] };
    assert.equal(isJobAssignedToWorker({ id: '1', assigned_to: 'worker-a' }, identity), true);
    assert.equal(isJobAssignedToWorker({ id: '2', assigned_to: 'user-a' }, identity), true);
    assert.equal(isJobAssignedToWorker({ id: '3', assigned_to: 'worker-b' }, identity), false);

    const byJob = buildAssignmentWorkerIdsByJob([{ job_id: '4', worker_id: 'worker-a' }]);
    assert.equal(isJobAssignedToWorker({ id: '4', assigned_to: null }, identity, byJob), true);
  });

  it('summarizes Worker A without leaking Worker B or org C jobs', () => {
    const workerA = { userId: 'user-a', workerIds: ['worker-a'] };
    const workerB = { userId: 'user-b', workerIds: ['worker-b'] };
    const workerC = { userId: 'user-c', workerIds: ['worker-c'] };

    const jobs = [
      {
        id: 'a-today',
        title: 'A today',
        assigned_to: 'worker-a',
        status: 'scheduled',
        scheduled_start: `${TODAY}T10:00:00Z`,
        organization_id: 'org-1'
      },
      {
        id: 'a-overdue',
        title: 'A overdue',
        assigned_to: 'worker-a',
        status: 'in_progress',
        due_date: '2026-07-01',
        organization_id: 'org-1'
      },
      {
        id: 'a-future',
        title: 'A future',
        assigned_to: 'worker-a',
        status: 'new',
        start_date: '2026-07-20',
        organization_id: 'org-1'
      },
      {
        id: 'a-done',
        title: 'A done',
        assigned_to: 'worker-a',
        status: 'completed',
        due_date: '2026-07-10',
        organization_id: 'org-1'
      },
      {
        id: 'a-unscheduled',
        title: 'A unscheduled',
        assigned_to: 'worker-a',
        status: 'new',
        scheduled_start: null,
        start_date: null,
        due_date: null,
        organization_id: 'org-1'
      },
      {
        id: 'a-cancelled',
        title: 'A cancelled',
        assigned_to: 'worker-a',
        status: 'cancelled',
        due_date: TODAY,
        organization_id: 'org-1'
      },
      {
        id: 'a-legacy',
        title: 'A legacy auth assignment',
        assigned_to: 'user-a',
        status: 'new',
        due_date: '2026-07-21',
        organization_id: 'org-1'
      },
      {
        id: 'b-today',
        title: 'B today',
        assigned_to: 'worker-b',
        status: 'new',
        due_date: TODAY,
        organization_id: 'org-1'
      },
      {
        id: 'c-today',
        title: 'C today',
        assigned_to: 'worker-c',
        status: 'new',
        due_date: TODAY,
        organization_id: 'org-2'
      },
      {
        id: 'unassigned',
        title: 'Unassigned',
        assigned_to: null,
        status: 'new',
        due_date: TODAY,
        organization_id: 'org-1'
      }
    ];

    const summaryA = getWorkerAssignmentSummary(jobs, workerA, TODAY);
    assert.equal(summaryA.dueToday, 1);
    assert.equal(summaryA.overdue, 1);
    assert.equal(summaryA.completed, 1);
    assert.equal(summaryA.unscheduled, 1);
    assert.equal(summaryA.hasUnscheduledAssignments, true);
    assert.equal(summaryA.nextAssignment?.id, 'a-today');
    assert.equal(summaryA.nextAssignmentLabel, 'scheduled');

    const summaryB = getWorkerAssignmentSummary(jobs, workerB, TODAY);
    assert.equal(summaryB.dueToday, 1);
    assert.equal(summaryB.overdue, 0);
    assert.equal(summaryB.completed, 0);
    assert.equal(summaryB.nextAssignment?.id, 'b-today');

    const summaryC = getWorkerAssignmentSummary(jobs, workerC, TODAY);
    assert.equal(summaryC.dueToday, 1);
    assert.notEqual(summaryA.nextAssignment?.id, summaryB.nextAssignment?.id);
    assert.notEqual(summaryA.nextAssignment?.id, summaryC.nextAssignment?.id);

    // Org isolation is enforced by callers via organization_id queries; helpers only match identity.
    assert.equal(isJobAssignedToWorker(jobs.find((j) => j.id === 'c-today')!, workerA), false);
    assert.equal(isJobAssignedToWorker(jobs.find((j) => j.id === 'b-today')!, workerA), false);
  });

  it('shows unscheduled label when only undated assignments exist', () => {
    const summary = getWorkerAssignmentSummary(
      [
        {
          id: 'open',
          title: 'Open undated',
          assigned_to: 'worker-a',
          status: 'new',
          due_date: null,
          start_date: null,
          scheduled_start: null
        }
      ],
      { userId: 'user-a', workerIds: ['worker-a'] },
      TODAY
    );
    assert.equal(summary.nextAssignment, null);
    assert.equal(summary.hasUnscheduledAssignments, true);
    assert.equal(summary.nextAssignmentLabel, 'unscheduled');
  });

  it('ignores cancelled and reassigned jobs for the previous worker', () => {
    const jobs = [
      {
        id: 'reassigned',
        title: 'Moved to B',
        assigned_to: 'worker-b',
        status: 'new',
        due_date: TODAY
      },
      {
        id: 'cancelled',
        title: 'Cancelled for A',
        assigned_to: 'worker-a',
        status: 'canceled',
        due_date: TODAY
      }
    ];
    const summaryA = getWorkerAssignmentSummary(jobs, { workerIds: ['worker-a'] }, TODAY);
    const summaryB = getWorkerAssignmentSummary(jobs, { workerIds: ['worker-b'] }, TODAY);
    assert.equal(summaryA.dueToday, 0);
    assert.equal(summaryA.active, 0);
    assert.equal(summaryB.dueToday, 1);
  });

  it('builds identity aliases for filter values', () => {
    const aliases = workerIdentityAliases({ userId: 'user-a', workerIds: ['worker-a', 'worker-a2'] });
    assert.equal(aliases.has('user-a'), true);
    assert.equal(aliases.has('worker-a'), true);
    assert.equal(aliases.has('worker-a2'), true);
  });
});
