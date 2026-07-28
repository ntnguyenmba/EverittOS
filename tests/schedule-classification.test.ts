import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  isActiveScheduleJob,
  partitionScheduleJobs,
  scheduleJobDateKey
} from '@/lib/schedule-classification';

describe('schedule classification', () => {
  const today = '2026-07-28';
  const tomorrow = '2026-07-29';
  const weekEnd = '2026-08-03';

  it('treats completed and cancelled jobs as inactive', () => {
    assert.equal(isActiveScheduleJob({ status: 'completed' }), false);
    assert.equal(isActiveScheduleJob({ status: 'cancelled' }), false);
    assert.equal(isActiveScheduleJob({ status: 'new' }), true);
  });

  it('puts active unscheduled jobs under Unscheduled', () => {
    const result = partitionScheduleJobs(
      [{ id: 'a', status: 'new', start_date: null, due_date: null, scheduled_start: null }],
      today,
      tomorrow,
      weekEnd
    );
    assert.equal(result.unscheduled.length, 1);
    assert.equal(result.unscheduled[0].id, 'a');
  });

  it('puts scheduled jobs on the correct day', () => {
    const result = partitionScheduleJobs(
      [
        { id: 't', status: 'new', start_date: today },
        { id: 'tm', status: 'in_progress', start_date: tomorrow },
        { id: 'w', status: 'new', start_date: '2026-07-31' }
      ],
      today,
      tomorrow,
      weekEnd
    );
    assert.deepEqual(result.today.map((j) => j.id), ['t']);
    assert.deepEqual(result.tomorrow.map((j) => j.id), ['tm']);
    assert.deepEqual(result.week.map((j) => j.id).sort(), ['t', 'tm', 'w']);
  });

  it('excludes completed scheduled and unscheduled jobs from all queues', () => {
    const result = partitionScheduleJobs(
      [
        { id: 'done-sched', status: 'completed', start_date: today },
        { id: 'done-none', status: 'completed', start_date: null },
        { id: 'open', status: 'new', start_date: null }
      ],
      today,
      tomorrow,
      weekEnd
    );
    assert.equal(result.today.length, 0);
    assert.equal(result.unscheduled.length, 1);
    assert.equal(result.unscheduled[0].id, 'open');
    assert.equal(result.active.length, 1);
  });

  it('excludes cancelled jobs from Unscheduled and day queues', () => {
    const result = partitionScheduleJobs(
      [
        { id: 'x', status: 'cancelled', start_date: null },
        { id: 'y', status: 'canceled', scheduled_start: `${today}T09:00:00` }
      ],
      today,
      tomorrow,
      weekEnd
    );
    assert.equal(result.active.length, 0);
    assert.equal(result.unscheduled.length, 0);
    assert.equal(result.today.length, 0);
  });

  it('reads wall-clock date from scheduled_start', () => {
    assert.equal(scheduleJobDateKey({ scheduled_start: '2026-07-28T20:00:00' }), '2026-07-28');
  });
});
