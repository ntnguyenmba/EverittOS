import assert from 'node:assert/strict';
import test from 'node:test';

import {
  applyJobsExportPostFilters,
  countJobsForDashboardPeriod,
  jobMatchesPeriod,
  parseJobsExportFilters
} from '@/lib/exports/job-filters';
import {
  countCompletedJobsInPeriod,
  countValidJobsInPeriod,
  dedupeJobsForCounting,
  filterValidJobsInPeriod,
  isValidCountableJob,
  rangeBounds,
  type DashboardDateRange,
  type JobCountRow
} from '@/lib/dashboard-metrics';

const now = new Date(2026, 6, 15); // Wednesday July 15, 2026

function job(partial: JobCountRow): JobCountRow {
  return {
    status: 'scheduled',
    ...partial
  };
}

test('one-time jobs count once in the selected period', () => {
  const jobs = [
    job({
      id: 'one-1',
      status: 'scheduled',
      scheduled_start: '2026-07-10T09:00:00',
      start_date: '2026-07-10'
    }),
    job({
      id: 'one-2',
      status: 'completed',
      completed_at: '2026-07-12',
      scheduled_start: '2026-07-11'
    })
  ];
  assert.equal(countValidJobsInPeriod(jobs, 'month', now), 2);
  assert.equal(countCompletedJobsInPeriod(jobs, 'month', now), 1);
});

test('recurring schedule definitions are never counted as jobs', () => {
  // Schedule templates live in recurring_job_series — only generated visits appear as jobs.
  const jobs = [
    job({
      id: 'visit-1',
      status: 'scheduled',
      recurring_series_id: 'series-1',
      occurrence_date: '2026-07-08',
      scheduled_start: '2026-07-08T10:00:00'
    })
  ];
  assert.equal(countValidJobsInPeriod(jobs, 'month', now), 1);
  assert.equal(isValidCountableJob(jobs[0]), true);
});

test('generated recurring visits count once each and duplicate rows collapse', () => {
  const jobs = [
    job({
      id: 'visit-a',
      status: 'completed',
      completed_at: '2026-07-08',
      recurring_series_id: 'series-1',
      occurrence_date: '2026-07-08'
    }),
    job({
      id: 'visit-b',
      status: 'scheduled',
      recurring_series_id: 'series-1',
      occurrence_date: '2026-07-15',
      scheduled_start: '2026-07-15'
    }),
    // Duplicate generated row for the same series occurrence — must not double count.
    job({
      id: 'visit-b-dup',
      status: 'scheduled',
      recurring_series_id: 'series-1',
      occurrence_date: '2026-07-15',
      scheduled_start: '2026-07-15'
    })
  ];
  assert.equal(dedupeJobsForCounting(jobs).length, 2);
  assert.equal(countValidJobsInPeriod(jobs, 'month', now), 2);
});

test('cancelled and skipped jobs are excluded', () => {
  const jobs = [
    job({ id: 'c1', status: 'cancelled', scheduled_start: '2026-07-10' }),
    job({ id: 'c2', status: 'canceled', scheduled_start: '2026-07-11' }),
    job({
      id: 's1',
      status: 'scheduled',
      is_skipped: true,
      scheduled_start: '2026-07-12',
      recurring_series_id: 'series-1',
      occurrence_date: '2026-07-12'
    }),
    job({ id: 'ok', status: 'scheduled', scheduled_start: '2026-07-13' })
  ];
  assert.equal(countValidJobsInPeriod(jobs, 'month', now), 1);
  assert.equal(isValidCountableJob(jobs[2]), false);
});

test('drafts and deleted jobs are excluded', () => {
  const jobs = [
    job({ id: 'd1', status: 'draft', scheduled_start: '2026-07-10' }),
    job({ id: 'd2', status: 'scheduled', deleted_at: '2026-07-01', scheduled_start: '2026-07-10' }),
    job({ id: 'ok', status: 'new', scheduled_start: '2026-07-10' })
  ];
  assert.equal(countValidJobsInPeriod(jobs, 'month', now), 1);
});

test('completed jobs use completed_at when available', () => {
  const jobs = [
    job({
      id: 'c1',
      status: 'completed',
      completed_at: '2026-06-20',
      scheduled_start: '2026-07-10'
    })
  ];
  assert.equal(countValidJobsInPeriod(jobs, 'month', now), 0);
  assert.equal(countValidJobsInPeriod(jobs, 'year', now), 1);
  assert.equal(countCompletedJobsInPeriod(jobs, 'year', now), 1);
});

test('completed jobs without completed_at use legacy operational fallback', () => {
  const jobs = [
    job({
      id: 'c1',
      status: 'completed',
      completed_at: null,
      start_date: '2026-07-09',
      scheduled_start: '2026-07-08'
    })
  ];
  assert.equal(countValidJobsInPeriod(jobs, 'month', now), 1);
  assert.equal(countCompletedJobsInPeriod(jobs, 'month', now), 1);
});

test('jobs on filter boundaries are never counted in two periods', () => {
  const jobs = [
    job({
      id: 'boundary',
      status: 'scheduled',
      scheduled_start: '2026-08-01T00:00:00' // exclusive end of July month range
    })
  ];
  const july = rangeBounds('month', now);
  assert.equal(july.start, '2026-07-01');
  assert.equal(july.end, '2026-08-01');
  assert.equal(countValidJobsInPeriod(jobs, 'month', now), 0);
  assert.equal(countValidJobsInPeriod(jobs, 'year', now), 1);
});

test('duplicate rows linked to the same job id count once', () => {
  const jobs = [
    job({ id: 'same', status: 'scheduled', scheduled_start: '2026-07-10' }),
    job({ id: 'same', status: 'scheduled', scheduled_start: '2026-07-10' }),
    job({ id: 'same', status: 'in_progress', scheduled_start: '2026-07-10' })
  ];
  assert.equal(countValidJobsInPeriod(jobs, 'month', now), 1);
});

test('Today Week Month Year and All Time totals use one shared helper', () => {
  const jobs = [
    job({ id: 't1', status: 'scheduled', scheduled_start: '2026-07-15T09:00:00' }), // today
    job({ id: 'w1', status: 'scheduled', scheduled_start: '2026-07-14' }), // this week (Tue)
    job({ id: 'm1', status: 'completed', completed_at: '2026-07-02' }), // this month
    job({ id: 'y1', status: 'scheduled', scheduled_start: '2026-03-01' }), // this year
    job({ id: 'old', status: 'completed', completed_at: '2025-12-01' }), // prior year
    job({ id: 'cancel', status: 'cancelled', scheduled_start: '2026-07-15' })
  ];

  const ranges: DashboardDateRange[] = ['today', 'week', 'month', 'year', 'all_time'];
  const counts = Object.fromEntries(
    ranges.map((range) => [range, countValidJobsInPeriod(jobs, range, now)])
  ) as Record<DashboardDateRange, number>;

  assert.equal(counts.today, 1);
  assert.equal(counts.week, 2); // Mon–Sun week containing July 15
  assert.equal(counts.month, 3);
  assert.equal(counts.year, 4);
  assert.equal(counts.all_time, 5); // excludes cancelled only
  assert.ok(counts.week >= counts.today);
  assert.ok(counts.month >= counts.week);
  assert.ok(counts.year >= counts.month);
});

test('dashboard job count reconciles with Jobs page period filter', () => {
  const jobs = [
    job({
      id: 'a',
      status: 'scheduled',
      scheduled_start: '2026-07-10',
      start_date: '2026-07-10'
    }),
    job({
      id: 'b',
      status: 'completed',
      completed_at: '2026-07-12',
      scheduled_start: '2026-07-11'
    }),
    job({
      id: 'c',
      status: 'cancelled',
      scheduled_start: '2026-07-13'
    }),
    job({
      id: 'd',
      status: 'scheduled',
      is_skipped: true,
      scheduled_start: '2026-07-14',
      recurring_series_id: 's1',
      occurrence_date: '2026-07-14'
    })
  ];

  const dashboardCount = countValidJobsInPeriod(jobs, 'month', now);
  const jobsPageCount = countJobsForDashboardPeriod(jobs, 'month', now);
  const filtered = applyJobsExportPostFilters(
    jobs as Array<JobCountRow & { assigned_to?: null; assigned_email?: null }>,
    parseJobsExportFilters(new URLSearchParams('period=month')),
    '2026-07-15'
  );

  assert.equal(dashboardCount, 2);
  assert.equal(jobsPageCount, dashboardCount);
  assert.equal(filtered.length, dashboardCount);
});

test('top performer completed totals never exceed dashboard completed count', () => {
  const jobs = [
    job({ id: '1', status: 'completed', completed_at: '2026-07-01' }),
    job({ id: '2', status: 'completed', completed_at: '2026-07-08' }),
    job({ id: '3', status: 'scheduled', scheduled_start: '2026-07-09' }),
    job({ id: '4', status: 'cancelled', scheduled_start: '2026-07-10' }),
    // Same job id duplicated via labor-like repeats
    job({ id: '2', status: 'completed', completed_at: '2026-07-08' })
  ];
  const dashboardCompleted = countCompletedJobsInPeriod(jobs, 'month', now);
  const uniqueCompleted = filterValidJobsInPeriod(jobs, 'month', now).filter((row) =>
    isValidCountableJob(row) &&
    ['completed', 'complete', 'finished', 'done', 'closed'].includes(String(row.status || '').toLowerCase())
  );
  assert.equal(dashboardCompleted, 2);
  assert.equal(uniqueCompleted.length, dashboardCompleted);
  // One completed job counts once even if multiple contractor/labor rows reference it.
  assert.ok(dashboardCompleted <= countValidJobsInPeriod(jobs, 'month', now));
});

test('jobMatchesPeriod uses operational dates for completed work', () => {
  const completed = {
    id: 'c1',
    status: 'completed',
    completed_at: '2026-07-15',
    scheduled_start: '2026-06-01'
  };
  assert.equal(jobMatchesPeriod(completed, 'today', '2026-07-15'), true);
  assert.equal(jobMatchesPeriod(completed, 'month', '2026-07-15'), true);
  assert.equal(jobMatchesPeriod(completed, 'today', '2026-07-14'), false);
});
