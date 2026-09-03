import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';
import {
  getCompletedJobReportingDate,
  getJobOperationalDate,
  isCompletedJobMissingCompletedAt,
  latestVisitDate
} from '@/lib/job-operational-date';
import { inRange } from '@/lib/dashboard-metrics';

describe('Completed job date fallbacks without dashboard warnings', () => {
  it('does not render missing-date warning UI on the dashboard', () => {
    const source = readFileSync('components/dashboard-revenue-snapshot.tsx', 'utf8');
    assert.doesNotMatch(source, /missingCompletedAt/);
    assert.doesNotMatch(source, /missingCompletedAtWarning/);
    assert.doesNotMatch(source, /Fix job/);
    assert.doesNotMatch(source, /completed jobs are missing completion dates/i);
  });

  it('uses visit date then start_date then scheduled_start for completed jobs', () => {
    assert.equal(
      getCompletedJobReportingDate({
        status: 'completed',
        completed_at: null,
        latest_completed_visit_date: '2026-07-18',
        start_date: '2026-07-10',
        scheduled_start: '2026-07-09',
        created_at: '2026-01-01'
      }),
      '2026-07-18'
    );

    assert.equal(
      getCompletedJobReportingDate({
        status: 'completed',
        completed_at: null,
        start_date: '2026-07-10',
        scheduled_start: '2026-07-09',
        created_at: '2026-01-01'
      }),
      '2026-07-10'
    );

    assert.equal(
      getCompletedJobReportingDate({
        status: 'completed',
        completed_at: null,
        scheduled_start: '2026-07-09T09:00:00Z',
        created_at: '2026-01-01'
      }),
      '2026-07-09'
    );
  });

  it('never uses created_at for completed-job period assignment', () => {
    assert.equal(
      getCompletedJobReportingDate({
        status: 'completed',
        completed_at: null,
        created_at: '2026-07-01'
      }),
      null
    );
    assert.equal(
      getJobOperationalDate({
        status: 'completed',
        completed_at: null,
        created_at: '2026-07-01'
      }),
      null
    );
  });

  it('excludes undated completed jobs from the wrong reporting period', () => {
    const undated = {
      status: 'completed',
      completed_at: null,
      created_at: '2026-07-15'
    };
    const reportingDate = getCompletedJobReportingDate(undated);
    assert.equal(reportingDate, null);
    assert.equal(inRange(reportingDate, '2026-07-01', '2026-08-01'), false);

    const withStart = {
      status: 'completed',
      completed_at: null,
      start_date: '2026-06-20',
      created_at: '2026-07-15'
    };
    assert.equal(getCompletedJobReportingDate(withStart), '2026-06-20');
    assert.equal(inRange(getCompletedJobReportingDate(withStart), '2026-07-01', '2026-08-01'), false);
  });

  it('keeps existing completed_at and prefers it over fallbacks', () => {
    assert.equal(
      getCompletedJobReportingDate({
        status: 'completed',
        completed_at: '2026-07-12T15:00:00Z',
        latest_completed_visit_date: '2026-07-18',
        start_date: '2026-07-10',
        created_at: '2026-01-01'
      }),
      '2026-07-12'
    );
    assert.equal(
      isCompletedJobMissingCompletedAt({
        status: 'completed',
        completed_at: '2026-07-12'
      }),
      false
    );
  });

  it('picks the latest visit date from visit rows', () => {
    assert.equal(
      latestVisitDate([
        { visit_date: '2026-07-01' },
        { visit_date: '2026-07-20' },
        { visit_date: '2026-07-09' }
      ]),
      '2026-07-20'
    );
  });

  it('keeps maintenance tooling off the dashboard and on Jobs/Analytics only', () => {
    const jobsPage = readFileSync('components/jobs-list.tsx', 'utf8');
    const analyticsPage = readFileSync('app/analytics/page.tsx', 'utf8');
    assert.match(jobsPage, /missing_completion_date/);
    assert.match(jobsPage, /isAdminRole/);
    assert.match(analyticsPage, /missing_completion_date/);
    assert.match(analyticsPage, /isAdminRole/);
  });
});
