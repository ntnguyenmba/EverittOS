import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  combineDateAndTime,
  formatLocalDate,
  formatScheduleDuration,
  hasExplicitTimeZone,
  hoursBetween,
  localDateFromIso,
  localTimeFromIso,
  wallClockDateTime,
  wallClockFromTimestamp
} from '@/lib/schedule-times';
import { scheduleRoundTripFromUiVisits } from '@/lib/job-visits';

describe('schedule-times', () => {
  it('combines local date and time', () => {
    const iso = combineDateAndTime('2026-06-15', '09:30');
    assert.ok(iso);
    assert.equal(localTimeFromIso(iso), '09:30');
    assert.equal(localDateFromIso(iso), '2026-06-15');
  });

  it('computes hours between timestamps', () => {
    const start = combineDateAndTime('2026-06-15', '09:00');
    const end = combineDateAndTime('2026-06-15', '17:00');
    assert.equal(hoursBetween(start, end), 8);
    assert.equal(formatScheduleDuration(start, end), '8 hrs');
  });

  it('preserves naive wall-clock date and time without timezone shift', () => {
    const wall = wallClockFromTimestamp('2026-07-28T20:00:00');
    assert.deepEqual(wall, { date: '2026-07-28', time: '20:00' });
    assert.equal(localDateFromIso('2026-07-28T20:00:00'), '2026-07-28');
    assert.equal(localTimeFromIso('2026-07-28T20:00:00'), '20:00');
    assert.equal(hasExplicitTimeZone('2026-07-28T20:00:00'), false);
  });

  it('preserves late-evening and early-morning wall clocks', () => {
    assert.deepEqual(wallClockFromTimestamp('2026-01-15T23:45:00'), { date: '2026-01-15', time: '23:45' });
    assert.deepEqual(wallClockFromTimestamp('2026-01-15T01:15:00'), { date: '2026-01-15', time: '01:15' });
    assert.equal(wallClockDateTime('2026-01-15', '23:45'), '2026-01-15T23:45:00');
  });

  it('converts zoned ISO into local wall clock', () => {
    const local = new Date('2026-06-15T13:30:00.000Z');
    const wall = wallClockFromTimestamp('2026-06-15T13:30:00.000Z');
    assert.ok(wall);
    assert.equal(wall.date, formatLocalDate(local));
    assert.equal(wall.time, `${String(local.getHours()).padStart(2, '0')}:${String(local.getMinutes()).padStart(2, '0')}`);
  });
});

describe('job schedule round-trip', () => {
  it('keeps exact date and time from create UI through stored visits and edit form', () => {
    const selected = [{ visit_date: '2026-07-28', start_time: '14:30', end_time: '16:00', notes: null }];
    const trip = scheduleRoundTripFromUiVisits(selected);

    assert.equal(trip.payload.start_date, '2026-07-28');
    assert.equal(trip.payload.due_date, '2026-07-28');
    assert.equal(trip.payload.scheduled_start, '2026-07-28T14:30:00');
    assert.equal(trip.payload.scheduled_end, '2026-07-28T16:00:00');
    assert.equal(trip.storedVisits[0].visit_date, '2026-07-28');
    assert.equal(trip.storedVisits[0].start_time, '14:30');
    assert.equal(trip.storedVisits[0].end_time, '16:00');
    assert.deepEqual(trip.editForm[0], {
      visit_date: '2026-07-28',
      start_time: '14:30',
      end_time: '16:00'
    });
  });

  it('preserves multi-visit schedules across create → reload', () => {
    const selected = [
      { visit_date: '2026-08-01', start_time: '09:00', end_time: '11:00' },
      { visit_date: '2026-08-03', start_time: '13:15', end_time: '15:45' }
    ];
    const trip = scheduleRoundTripFromUiVisits(selected);

    assert.equal(trip.payload.scheduled_start, '2026-08-01T09:00:00');
    assert.equal(trip.payload.scheduled_end, '2026-08-03T15:45:00');
    assert.equal(trip.editForm[0].visit_date, '2026-08-01');
    assert.equal(trip.editForm[0].start_time, '09:00');
    assert.equal(trip.editForm[1].visit_date, '2026-08-03');
    assert.equal(trip.editForm[1].end_time, '15:45');
  });

  it('falls back from stored scheduled_start wall-clock without shifting day or hour', () => {
    const storedStart = '2026-07-28T20:00:00';
    const storedEnd = '2026-07-28T22:30:00';
    const start = wallClockFromTimestamp(storedStart, '08:00');
    const end = wallClockFromTimestamp(storedEnd, '16:00');
    assert.deepEqual(start, { date: '2026-07-28', time: '20:00' });
    assert.deepEqual(end, { date: '2026-07-28', time: '22:30' });
  });
});
