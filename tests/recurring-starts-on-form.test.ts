import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import {
  generateOccurrenceDates,
  generateOccurrences,
  summarizeRecurrence,
  summarizeRecurrenceForLocale
} from '../lib/recurring-jobs';

const read = (path: string) => readFileSync(join(process.cwd(), path), 'utf8');

test('main date stays visible and wires recurrence start date', () => {
  const source = read('components/job-creator.tsx');
  assert.match(source, /id="recurrence-starts-on"/);
  assert.match(source, /recurrenceCopy\.startsOn/);
  assert.match(source, /recurrenceStartDate/);
  assert.match(source, /setSeriesStartDate/);
  const moreOptions = source.slice(source.indexOf('<summary>More options</summary>'));
  assert.match(moreOptions, /recurrenceCopy\.scheduleType/);
  assert.match(moreOptions, /\{isRecurring \? \(/);
});

test('form field order is Date, Start time, then Repeats in More options', () => {
  const source = read('components/job-creator.tsx');
  const startsOn = source.indexOf('recurrenceCopy.startsOn');
  const startTime = source.indexOf('recurrenceCopy.startTime', startsOn);
  const moreOptions = source.indexOf('<summary>More options</summary>', startTime);
  const repeats = source.indexOf('recurrenceCopy.scheduleType', moreOptions);
  assert.ok(startsOn >= 0 && startTime > startsOn && moreOptions > startTime && repeats > moreOptions);
});

test('recurring job cannot be saved without a start date', () => {
  const source = read('components/job-creator.tsx');
  assert.match(source, /if \(isRecurring && !recurrenceStartDate\.trim\(\)\) nextErrors\.startDate/);
  assert.match(source, /startDate: recurrenceStartDate/);
  assert.match(source, /auth-message-error/);
});

test('biweekly Friday starting August 7, 2026 generates August 7 and August 21', () => {
  const dates = generateOccurrenceDates(
    {
      frequency: 'biweekly',
      startDate: '2026-08-07',
      weekday: 5,
      weekdays: [5]
    },
    { fromDate: '2026-08-07', windowDays: 60 }
  );
  assert.equal(dates[0], '2026-08-07');
  assert.equal(dates[1], '2026-08-21');
  assert.equal(dates[2], '2026-09-04');
  assert.equal(dates[3], '2026-09-18');
});

test('Thursday start with Friday selected generates Friday first', () => {
  const dates = generateOccurrenceDates(
    {
      frequency: 'biweekly',
      startDate: '2026-08-06', // Thursday
      weekday: 5,
      weekdays: [5]
    },
    { fromDate: '2026-08-06', windowDays: 30 }
  );
  assert.equal(dates[0], '2026-08-07');
  assert.ok(dates.every((date) => date >= '2026-08-06'));
});

test('summary includes formatted start date and never renders starting .', () => {
  const missing = summarizeRecurrence({
    frequency: 'biweekly',
    weekday: 5,
    startDate: ''
  });
  assert.equal(missing, 'Select a start date to preview this recurring schedule.');
  assert.doesNotMatch(missing, /starting \./);

  const complete = summarizeRecurrence({
    frequency: 'biweekly',
    weekday: 5,
    startDate: '2026-08-07',
    preferredStartTime: '09:00',
    timezone: 'America/Chicago'
  });
  assert.match(complete, /Every two weeks on Friday/);
  assert.match(complete, /starting August 7, 2026/);
  assert.doesNotMatch(complete, /starting \./);
});

test('end date before start date is rejected in the form', () => {
  const source = read('components/job-creator.tsx');
  assert.match(source, /endDateBeforeStart/);
  assert.match(source, /recurrenceEndDate < recurrenceStartDate/);
});

test('timezone and local start time are preserved on generated visits', () => {
  const rows = generateOccurrences(
    {
      frequency: 'biweekly',
      startDate: '2026-08-07',
      weekday: 5,
      preferredStartTime: '09:30',
      timezone: 'America/Chicago'
    },
    { fromDate: '2026-08-07', windowDays: 30, skipOverdueToday: false }
  );
  assert.equal(rows[0].occurrenceDate, '2026-08-07');
  assert.equal(rows[0].scheduledStart, '2026-08-07T09:30:00');
  assert.ok(rows.every((row) => row.scheduledStart.endsWith('T09:30:00')));
});

test('localized summaries are complete in Spanish and Vietnamese', () => {
  const es = summarizeRecurrenceForLocale(
    {
      frequency: 'biweekly',
      weekday: 5,
      startDate: '2026-08-07'
    },
    'es'
  );
  assert.match(es, /Cada dos semanas/);
  assert.match(es, /a partir del/);
  assert.doesNotMatch(es, /starting \./);

  const vi = summarizeRecurrenceForLocale(
    {
      frequency: 'biweekly',
      weekday: 5,
      startDate: '2026-08-07'
    },
    'vi'
  );
  assert.match(vi, /hai tuần một lần|Lặp lại/);
  assert.match(vi, /bắt đầu từ ngày/);
  assert.doesNotMatch(vi, /starting \./);
});
