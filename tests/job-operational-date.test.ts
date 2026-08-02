import assert from 'node:assert/strict';
import test from 'node:test';
import { getJobOperationalDate } from '../lib/job-operational-date';

test('active jobs use scheduled_start before a stale start_date', () => {
  const date = getJobOperationalDate({
    status: 'scheduled',
    start_date: '2026-08-01',
    scheduled_start: '2026-08-02T10:00:00-05:00'
  });

  assert.equal(date, '2026-08-02');
});

test('active jobs still fall back to start_date when scheduled_start is missing', () => {
  const date = getJobOperationalDate({
    status: 'scheduled',
    start_date: '2026-08-02'
  });

  assert.equal(date, '2026-08-02');
});

test('completed jobs continue to use completed_at for reporting', () => {
  const date = getJobOperationalDate({
    status: 'completed',
    completed_at: '2026-08-03T15:00:00-05:00',
    scheduled_start: '2026-08-02T10:00:00-05:00'
  });

  assert.equal(date, '2026-08-03');
});
