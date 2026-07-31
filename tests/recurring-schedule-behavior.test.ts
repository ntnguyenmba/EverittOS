import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  generateOccurrenceDates,
  generateOccurrences,
  normalizeScheduleToMrr,
  resolveGenerationFromDate,
  skipOverdueTodayOccurrences,
  summarizeRecurrence
} from '../lib/recurring-jobs';

test('daily schedule starts on the selected date', () => {
  const dates = generateOccurrenceDates({
    frequency: 'daily',
    startDate: '2026-08-06',
    preferredStartTime: '09:00'
  }, { fromDate: '2026-08-06', windowDays: 10 });
  assert.equal(dates[0], '2026-08-06');
  assert.equal(dates[1], '2026-08-07');
  assert.ok(dates.every((date) => date >= '2026-08-06'));
});

test('weekly schedule chooses first valid weekday on or after start date', () => {
  const dates = generateOccurrenceDates({
    frequency: 'weekly',
    startDate: '2026-08-05', // Wednesday
    weekday: 4 // Thursday
  }, { fromDate: '2026-08-05', windowDays: 21 });
  assert.equal(dates[0], '2026-08-06');
});

test('multi-weekday weekly includes each selected weekday', () => {
  const dates = generateOccurrenceDates({
    frequency: 'weekly',
    startDate: '2026-08-03', // Monday
    weekdays: [2, 5] // Tue, Fri
  }, { fromDate: '2026-08-03', windowDays: 14 });
  assert.deepEqual(dates.slice(0, 4), ['2026-08-04', '2026-08-07', '2026-08-11', '2026-08-14']);
});

test('every 2 weeks and every 3 weeks use correct intervals', () => {
  const biweekly = generateOccurrenceDates({
    frequency: 'biweekly',
    startDate: '2026-08-06',
    weekday: 4
  }, { fromDate: '2026-08-06', windowDays: 45 });
  assert.equal(biweekly[1], '2026-08-20');

  const three = generateOccurrenceDates({
    frequency: 'every_three_weeks',
    startDate: '2026-08-06',
    weekday: 4
  }, { fromDate: '2026-08-06', windowDays: 50 });
  assert.equal(three[1], '2026-08-27');
});

test('monthly recurrence uses last valid day for short months', () => {
  const dates = generateOccurrenceDates({
    frequency: 'monthly',
    startDate: '2026-01-31'
  }, { fromDate: '2026-01-31', windowDays: 100 });
  assert.equal(dates[0], '2026-01-31');
  assert.equal(dates[1], '2026-02-28');
  assert.equal(dates[2], '2026-03-31');
});

test('end date is inclusive and never exceeded', () => {
  const dates = generateOccurrenceDates({
    frequency: 'weekly',
    startDate: '2026-08-06',
    weekday: 4,
    endDate: '2026-08-20'
  }, { fromDate: '2026-08-06', windowDays: 90 });
  assert.equal(dates[dates.length - 1], '2026-08-20');
  assert.ok(dates.every((date) => date <= '2026-08-20'));
});

test('end after count stops at the limit including existingCount', () => {
  const first = generateOccurrenceDates({
    frequency: 'weekly',
    startDate: '2026-08-06',
    weekday: 4,
    occurrenceLimit: 3
  }, { fromDate: '2026-08-06', windowDays: 90, existingCount: 0 });
  assert.equal(first.length, 3);

  const toppedUp = generateOccurrenceDates({
    frequency: 'weekly',
    startDate: '2026-08-06',
    weekday: 4,
    occurrenceLimit: 3
  }, { fromDate: '2026-08-06', windowDays: 90, existingCount: 3 });
  assert.equal(toppedUp.length, 0);
});

test('never generates before the recurrence start date', () => {
  const dates = generateOccurrenceDates({
    frequency: 'weekly',
    startDate: '2026-09-01',
    weekday: 2
  }, { fromDate: '2026-08-01', windowDays: 60 });
  assert.ok(dates.every((date) => date >= '2026-09-01'));
});

test('overdue today occurrence is skipped when start time already passed', () => {
  const rows = generateOccurrences(
    {
      frequency: 'daily',
      startDate: '2026-08-06',
      preferredStartTime: '09:00',
      timezone: 'America/Chicago'
    },
    {
      fromDate: '2026-08-06',
      windowDays: 3,
      now: new Date('2026-08-06T16:00:00.000Z'),
      skipOverdueToday: true
    }
  );
  assert.notEqual(rows[0]?.occurrenceDate, '2026-08-06');
  assert.equal(rows[0]?.occurrenceDate, '2026-08-07');
});

test('skipOverdueTodayOccurrences keeps later days', () => {
  const kept = skipOverdueTodayOccurrences(
    [
      { occurrenceDate: '2026-08-06', scheduledStart: '2026-08-06T08:00:00', scheduledEnd: null },
      { occurrenceDate: '2026-08-07', scheduledStart: '2026-08-07T08:00:00', scheduledEnd: null }
    ],
    {
      timezone: 'UTC',
      preferredStartTime: '08:00',
      now: new Date('2026-08-06T12:00:00.000Z')
    }
  );
  assert.deepEqual(
    kept.map((row) => row.occurrenceDate),
    ['2026-08-07']
  );
});

test('resolveGenerationFromDate never returns before start or before today', () => {
  assert.equal(resolveGenerationFromDate('2026-12-01', 'UTC', new Date('2026-08-06T12:00:00Z')), '2026-12-01');
  assert.equal(resolveGenerationFromDate('2026-01-01', 'UTC', new Date('2026-08-06T12:00:00Z')), '2026-08-06');
});

test('custom every X days works', () => {
  const dates = generateOccurrenceDates({
    frequency: 'custom',
    interval: 5,
    intervalUnit: 'days',
    startDate: '2026-08-01'
  }, { fromDate: '2026-08-01', windowDays: 20 });
  assert.deepEqual(dates.slice(0, 3), ['2026-08-01', '2026-08-06', '2026-08-11']);
});

test('summary includes end mode wording', () => {
  const afterCount = summarizeRecurrence({
    frequency: 'weekly',
    weekday: 2,
    weekdays: [2, 5],
    startDate: '2026-08-04',
    occurrenceLimit: 12
  });
  assert.match(afterCount, /Tuesday and Friday/);
  assert.match(afterCount, /ending after 12 visits/);

  const onDate = summarizeRecurrence({
    frequency: 'monthly',
    startDate: '2026-08-15',
    endDate: '2026-12-15'
  });
  assert.match(onDate, /ending December 15, 2026/);
});

test('MRR normalization for weekly biweekly four-weekly monthly and daily', () => {
  assert.equal(Number(normalizeScheduleToMrr(100, { frequency: 'weekly', startDate: '2026-08-06' }).toFixed(2)), Number(((100 * 52) / 12).toFixed(2)));
  assert.equal(Number(normalizeScheduleToMrr(100, { frequency: 'biweekly', startDate: '2026-08-06' }).toFixed(2)), Number(((100 * 26) / 12).toFixed(2)));
  assert.equal(Number(normalizeScheduleToMrr(100, { frequency: 'every_four_weeks', startDate: '2026-08-06' }).toFixed(2)), Number(((100 * 13) / 12).toFixed(2)));
  assert.equal(normalizeScheduleToMrr(100, { frequency: 'monthly', startDate: '2026-08-06' }), 100);
  assert.equal(Number(normalizeScheduleToMrr(10, { frequency: 'daily', startDate: '2026-08-06' }).toFixed(2)), Number(((10 * 365) / 12).toFixed(2)));
});

test('wall-clock local time is preserved on generated occurrences', () => {
  const rows = generateOccurrences(
    {
      frequency: 'weekly',
      startDate: '2026-03-08',
      weekday: 0,
      preferredStartTime: '09:30',
      timezone: 'America/Chicago'
    },
    { fromDate: '2026-03-08', windowDays: 21, skipOverdueToday: false }
  );
  assert.ok(rows.every((row) => row.scheduledStart.endsWith('T09:30:00')));
});
