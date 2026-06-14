import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  combineDateAndTime,
  formatScheduleDuration,
  hoursBetween,
  localTimeFromIso
} from '@/lib/schedule-times';

describe('schedule-times', () => {
  it('combines local date and time', () => {
    const iso = combineDateAndTime('2026-06-15', '09:30');
    assert.ok(iso);
    assert.equal(localTimeFromIso(iso), '09:30');
  });

  it('computes hours between timestamps', () => {
    const start = combineDateAndTime('2026-06-15', '09:00');
    const end = combineDateAndTime('2026-06-15', '17:00');
    assert.equal(hoursBetween(start, end), 8);
    assert.equal(formatScheduleDuration(start, end), '8 hrs');
  });
});
