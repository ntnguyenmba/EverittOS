import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import {
  calculateScheduledRevenue,
  generateOccurrenceDates,
  generateOccurrences,
  isCancelledOrSkippedStatus,
  isCompletedLikeStatus,
  RECURRING_GENERATION_WINDOW_DAYS,
  summarizeRecurrence
} from '../lib/recurring-jobs';
import { isValidEmail, isValidPhone, validateOptionalContact } from '../lib/contact-validation';

const root = process.cwd();

function read(path: string) {
  return readFileSync(join(root, path), 'utf8');
}

test('saves and validates optional client email/phone', () => {
  assert.equal(isValidEmail(''), true);
  assert.equal(isValidEmail('client@example.com'), true);
  assert.equal(isValidEmail('bad'), false);
  assert.equal(isValidPhone(''), true);
  assert.equal(isValidPhone('555-0100'), true);
  assert.equal(isValidPhone('12'), false);
  assert.equal(validateOptionalContact({ email: 'a@b.com', phone: '' }).ok, true);
  assert.equal(validateOptionalContact({ email: 'bad', phone: '' }).ok, false);
});

test('customer search includes email and property fields', () => {
  const source = read('app/api/customers/search/route.ts');
  assert.match(source, /email\.ilike/);
  assert.match(source, /phone\.ilike/);
  assert.match(source, /name\.ilike/);
  assert.match(source, /formatted_address\.ilike/);
});

test('customer profile API validates email and preferred contact', () => {
  const source = read('app/api/customers/[id]/route.ts');
  assert.match(source, /validateOptionalContact/);
  assert.match(source, /preferredContactMethod/);
  assert.match(source, /billingAddress/);
});

test('job creator autofills client email/phone and requires multi-property selection', () => {
  const source = read('components/job-creator.tsx');
  assert.match(source, /client-summary-card/);
  assert.match(source, /customerEmail/);
  assert.match(source, /setCustomerEmail/);
  assert.match(source, /multiple properties/);
  assert.match(source, /Select a property/);
  assert.match(source, /assigned_to: assignedTo/);
  assert.match(source, /\/api\/recurring-jobs/);
});

test('creating one-time job posts to /api/jobs with contractor assignment', () => {
  const jobsRoute = read('app/api/jobs/route.ts');
  assert.match(jobsRoute, /assigned_to: assignedWorkerId/);
  assert.match(jobsRoute, /job_assignments/);
  assert.match(jobsRoute, /onConflict: 'job_id,worker_id'/);
  assert.match(jobsRoute, /customer_email/);
});

test('weekly biweekly four-week and monthly recurrence generate dates', () => {
  const weekly = generateOccurrenceDates({
    frequency: 'weekly',
    startDate: '2026-08-06',
    weekday: 4,
    preferredStartTime: '10:00'
  });
  assert.ok(weekly.length >= 10);
  assert.equal(weekly[0], '2026-08-06');

  const biweekly = generateOccurrenceDates({
    frequency: 'biweekly',
    startDate: '2026-08-06',
    weekday: 4
  });
  assert.equal(biweekly[1], '2026-08-20');

  const four = generateOccurrenceDates({
    frequency: 'every_four_weeks',
    startDate: '2026-08-06',
    weekday: 4
  });
  assert.equal(four[1], '2026-09-03');

  const monthly = generateOccurrenceDates({
    frequency: 'monthly',
    startDate: '2026-08-06'
  });
  assert.equal(monthly[1], '2026-09-06');
});

test('custom recurrence and property timezone wall-clock schedule', () => {
  const custom = generateOccurrences({
    frequency: 'custom',
    interval: 3,
    intervalUnit: 'weeks',
    weekday: 2,
    startDate: '2026-08-04',
    preferredStartTime: '14:30',
    durationMinutes: 120,
    timezone: 'America/Chicago'
  });
  assert.equal(custom[0].occurrenceDate, '2026-08-04');
  assert.equal(custom[0].scheduledStart, '2026-08-04T14:30:00');
  assert.equal(custom[1].occurrenceDate, '2026-08-25');
});

test('generation window stays within configured days and never unlimited', () => {
  const dates = generateOccurrenceDates({
    frequency: 'weekly',
    startDate: '2026-08-06',
    weekday: 4
  });
  const last = dates[dates.length - 1];
  const start = new Date(`${dates[0]}T00:00:00Z`).getTime();
  const end = new Date(`${last}T00:00:00Z`).getTime();
  const days = (end - start) / (1000 * 60 * 60 * 24);
  assert.ok(days <= RECURRING_GENERATION_WINDOW_DAYS);
  assert.equal(RECURRING_GENERATION_WINDOW_DAYS, 90);

  const openEnded = generateOccurrenceDates({
    frequency: 'weekly',
    startDate: '2026-01-01',
    weekday: 4
  });
  assert.ok(openEnded.length < 20);
});

test('duplicate occurrence prevention uses unique series+date index in migration', () => {
  const sql = read('supabase/migrations/202609270001_recurring_job_series_and_client_profile.sql');
  assert.match(sql, /jobs_recurring_series_occurrence_uidx/);
  assert.match(sql, /recurring_job_series/);
  assert.match(sql, /preferred_contact_method/);
  assert.match(sql, /billing_address/);
  assert.match(sql, /recurring_job_series_select/);
  assert.match(sql, /can_manage_organization/);
  assert.match(sql, /is_assigned_to_job/);
});

test('scheduled revenue uses only future generated occurrences', () => {
  const total = calculateScheduledRevenue(
    [
      { price: 100, status: 'scheduled', occurrence_date: '2026-08-10' },
      { price: 100, status: 'completed', occurrence_date: '2026-08-01' },
      { price: 100, status: 'cancelled', is_skipped: true, occurrence_date: '2026-08-12' },
      { price: 50, status: 'scheduled', occurrence_date: '2026-08-20' }
    ],
    '2026-08-05'
  );
  assert.equal(total, 150);
});

test('metrics helpers exclude cancelled skipped and series itself is not completed', () => {
  assert.equal(isCompletedLikeStatus('completed'), true);
  assert.equal(isCompletedLikeStatus('scheduled'), false);
  assert.equal(isCancelledOrSkippedStatus('cancelled', false), true);
  assert.equal(isCancelledOrSkippedStatus('scheduled', true), true);
  assert.equal(isCancelledOrSkippedStatus('scheduled', false), false);
});

test('dashboard metrics include scheduled revenue and occurrence counts', () => {
  const source = read('lib/dashboard-metrics.ts');
  assert.match(source, /scheduledRevenue/);
  assert.match(source, /recurringOccurrenceCount/);
  assert.match(source, /oneTimeJobCount/);
  assert.match(source, /calculateScheduledRevenue/);
});

test('recurrence summary is human readable', () => {
  const summary = summarizeRecurrence({
    frequency: 'biweekly',
    weekday: 4,
    startDate: '2026-08-06',
    preferredStartTime: '10:00'
  });
  assert.match(summary, /Every two weeks/);
  assert.match(summary, /Thursday/);
  assert.match(summary, /10:00 AM/);
  assert.match(summary, /90 days/);
});

test('job create persists contractor assignment into job_assignments', () => {
  const source = read('app/api/jobs/route.ts');
  assert.match(source, /job_assignments/);
  assert.match(source, /assignedWorkerId/);
  assert.match(source, /onConflict: 'job_id,worker_id'/);
  assert.match(source, /Keep jobs\.assigned_to and job_assignments in sync/);
});

test('job detail repairs missing assignment rows and hides reassign prompt when assigned', () => {
  const detail = read('app/jobs/[id]/page.tsx');
  assert.match(detail, /Single source of truth/);
  assert.match(detail, /assigned_to/);
  assert.match(detail, /job_assignments/);
  const assignments = read('components/job-assignments.tsx');
  assert.match(assignments, /assignments\.length === 0/);
  assert.match(assignments, /Assign to job/);
  assert.match(assignments, /Add another team member/);
  assert.match(assignments, /jobs'\)\.update\(\{ assigned_to:/);
});

test('series actions support skip pause resume end and edit scopes', () => {
  const seriesRoute = read('app/api/recurring-jobs/[id]/route.ts');
  assert.match(seriesRoute, /action === 'pause'/);
  assert.match(seriesRoute, /action === 'resume'/);
  assert.match(seriesRoute, /action === 'end'/);
  assert.match(seriesRoute, /edit_future/);
  assert.match(seriesRoute, /isCompletedLikeStatus/);
  const occurrenceRoute = read('app/api/jobs/[id]/series-actions/route.ts');
  assert.match(occurrenceRoute, /edit_this_only/);
  assert.match(occurrenceRoute, /skip/);
  assert.match(occurrenceRoute, /seriesUntouched/);
});

test('request-time generation tops up series without paid scheduler', () => {
  const helper = read('lib/generate-recurring-series.ts');
  assert.match(helper, /generateActiveSeriesForOrganization/);
  assert.match(helper, /duplicate\|unique/);
  const jobsRoute = read('app/api/jobs/route.ts');
  assert.match(jobsRoute, /generateActiveSeriesForOrganization/);
  const listRoute = read('app/api/recurring-jobs/route.ts');
  assert.match(listRoute, /generateActiveSeriesForOrganization/);
});

test('recurring create path also writes job_assignments for preferred contractor', () => {
  const source = read('app/api/recurring-jobs/route.ts');
  assert.match(source, /job_assignments/);
  assert.match(source, /preferredContractorId/);
  assert.match(source, /occurrence_date/);
});
