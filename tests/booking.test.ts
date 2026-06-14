import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { slugifyBookingSlug } from '@/lib/booking/slug';
import { hasBookingConflict } from '@/lib/booking/conflicts';

describe('booking slug', () => {
  it('slugifies organization names', () => {
    assert.equal(slugifyBookingSlug('Luxe Hair Studio'), 'luxe-hair-studio');
  });
});

describe('booking conflicts', () => {
  it('detects overlapping ranges', () => {
    const existing = [{ starts_at: '2026-06-15T14:00:00.000Z', ends_at: '2026-06-15T15:00:00.000Z' }];
    const candidate = { starts_at: '2026-06-15T14:30:00.000Z', ends_at: '2026-06-15T15:30:00.000Z' };
    assert.equal(hasBookingConflict(existing, candidate), true);
  });
});
