import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { slugifyBookingSlug } from '@/lib/booking/slug';
import { hasBookingConflict } from '@/lib/booking/conflicts';
import { isBookingSchemaError, bookingSchemaUnavailableMessage, validateBookingTimeRange } from '@/lib/booking/schema';
import { bookingAppointmentName, bookingStaffLabel, defaultBookingEndIso } from '@/lib/booking/display';
import { parseManualBookingInput } from '@/lib/booking/parse-manual-booking';
import { generateBookingIcs } from '@/lib/booking/ics';

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

describe('booking schema', () => {
  it('detects missing bookings table errors', () => {
    assert.equal(
      isBookingSchemaError('relation "public.bookings" does not exist'),
      true
    );
  });

  it('detects missing booking columns', () => {
    assert.equal(
      isBookingSchemaError('column bookings.manual_service_name does not exist'),
      true
    );
  });

  it('returns setup message', () => {
    assert.match(bookingSchemaUnavailableMessage(), /migration/i);
  });
});

describe('booking time validation', () => {
  it('rejects end before start', () => {
    assert.equal(
      validateBookingTimeRange('2026-06-15T14:00:00.000Z', '2026-06-15T13:00:00.000Z'),
      'End time must be after the start time.'
    );
  });

  it('accepts valid ranges', () => {
    assert.equal(
      validateBookingTimeRange('2026-06-15T14:00:00.000Z', '2026-06-15T15:00:00.000Z'),
      null
    );
  });
});

describe('manual booking parse', () => {
  it('requires appointment, client, and start time', () => {
    const result = parseManualBookingInput({ client_name: 'Alex', starts_at: '2026-06-15T14:00:00.000Z' });
    assert.equal(result.ok, false);
  });

  it('defaults end time to 60 minutes', () => {
    const result = parseManualBookingInput({
      manual_service_name: 'Consultation',
      client_name: 'Alex',
      starts_at: '2026-06-15T14:00:00.000Z'
    });
    assert.equal(result.ok, true);
    if (result.ok) {
      assert.equal(result.endsAt, defaultBookingEndIso('2026-06-15T14:00:00.000Z', 60));
    }
  });
});

describe('booking display', () => {
  it('prefers saved service name over manual text', () => {
    assert.equal(
      bookingAppointmentName({
        client_name: 'Alex',
        starts_at: '2026-06-15T14:00:00.000Z',
        ends_at: '2026-06-15T15:00:00.000Z',
        status: 'confirmed',
        services: { name: 'Haircut' },
        manual_service_name: 'Walk-in'
      }),
      'Haircut'
    );
  });

  it('shows unassigned staff when empty', () => {
    assert.equal(
      bookingStaffLabel({
        client_name: 'Alex',
        starts_at: '2026-06-15T14:00:00.000Z',
        ends_at: '2026-06-15T15:00:00.000Z',
        status: 'confirmed'
      }),
      'Unassigned'
    );
  });
});

describe('booking ics', () => {
  it('generates calendar content', () => {
    const ics = generateBookingIcs({
      uid: 'booking-1',
      title: 'Haircut',
      startsAt: '2026-06-15T14:00:00.000Z',
      endsAt: '2026-06-15T15:00:00.000Z'
    });
    assert.match(ics, /BEGIN:VCALENDAR/);
    assert.match(ics, /BEGIN:VEVENT/);
  });
});
