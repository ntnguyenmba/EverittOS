import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { slugifyBookingSlug } from '@/lib/booking/slug';
import { hasBookingConflict } from '@/lib/booking/conflicts';
import { isBookingSchemaError, bookingSchemaUnavailableMessage, validateBookingTimeRange } from '@/lib/booking/schema';
import { bookingAppointmentName, bookingStaffLabel, defaultBookingEndIso } from '@/lib/booking/display';
import { parseManualBookingInput } from '@/lib/booking/parse-manual-booking';
import { generateBookingIcs } from '@/lib/booking/ics';
import {
  assertBookingInsertResult,
  bookingMatchesWorkspace,
  isBookingVisibleInUpcomingList,
  upcomingBookingCutoffIso
} from '@/lib/booking/list-query';

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
  it('requires client, start, and end time', () => {
    const result = parseManualBookingInput({ client_name: 'Alex', starts_at: '2026-06-15T14:00:00.000Z' });
    assert.equal(result.ok, false);
  });

  it('accepts booking without appointment name', () => {
    const result = parseManualBookingInput({
      client_name: 'Alex',
      starts_at: '2026-06-15T14:00:00.000Z',
      ends_at: '2026-06-15T15:00:00.000Z'
    });
    assert.equal(result.ok, true);
    if (result.ok) {
      assert.equal(result.manualServiceName, null);
      assert.equal(result.serviceId, null);
    }
  });

  it('preserves manual_service_name and optional staff_name', () => {
    const result = parseManualBookingInput({
      manual_service_name: 'Consultation',
      staff_name: 'Jordan',
      client_name: 'Alex',
      starts_at: '2026-06-15T14:00:00.000Z',
      ends_at: defaultBookingEndIso('2026-06-15T14:00:00.000Z', 60)
    });
    assert.equal(result.ok, true);
    if (result.ok) {
      assert.equal(result.manualServiceName, 'Consultation');
      assert.equal(result.staffName, 'Jordan');
    }
  });
});

describe('booking list visibility', () => {
  const now = new Date('2026-06-10T18:00:00.000Z');

  it('includes manual bookings with nullable service_id when end is today or later', () => {
    const booking = {
      starts_at: '2026-06-10T10:00:00.000Z',
      ends_at: '2026-06-10T11:00:00.000Z',
      status: 'confirmed',
      service_id: null,
      manual_service_name: 'Walk-in consult'
    };
    assert.equal(isBookingVisibleInUpcomingList(booking, now), true);
  });

  it('includes today bookings even when start time has passed', () => {
    assert.equal(
      isBookingVisibleInUpcomingList(
        {
          starts_at: '2026-06-10T08:00:00.000Z',
          ends_at: '2026-06-10T09:00:00.000Z',
          status: 'confirmed'
        },
        now
      ),
      true
    );
  });

  it('excludes cancelled bookings', () => {
    assert.equal(
      isBookingVisibleInUpcomingList(
        {
          starts_at: '2026-06-11T10:00:00.000Z',
          ends_at: '2026-06-11T11:00:00.000Z',
          status: 'cancelled'
        },
        now
      ),
      false
    );
  });

  it('excludes bookings that ended before today', () => {
    assert.equal(
      isBookingVisibleInUpcomingList(
        {
          starts_at: '2026-06-09T10:00:00.000Z',
          ends_at: '2026-06-09T11:00:00.000Z',
          status: 'confirmed'
        },
        now
      ),
      false
    );
  });

  it('matches save and list workspace ids', () => {
    const workspaceId = 'org-123';
    assert.equal(
      bookingMatchesWorkspace({ organization_id: workspaceId, workspace_id: workspaceId }, workspaceId),
      true
    );
    assert.equal(
      bookingMatchesWorkspace({ organization_id: workspaceId, workspace_id: null }, workspaceId),
      true
    );
  });

  it('uses end-of-day cutoff for upcoming filter', () => {
    assert.equal(upcomingBookingCutoffIso(now), '2026-06-10T00:00:00.000Z');
  });
});

describe('booking insert result', () => {
  it('requires an id before treating save as successful', () => {
    assert.equal(assertBookingInsertResult({ id: 'abc' }), true);
    assert.equal(assertBookingInsertResult({ id: '' }), false);
    assert.equal(assertBookingInsertResult(null), false);
  });
});

describe('booking display', () => {
  it('uses manual_service_name when no saved service', () => {
    assert.equal(
      bookingAppointmentName({
        client_name: 'Alex',
        starts_at: '2026-06-15T14:00:00.000Z',
        ends_at: '2026-06-15T15:00:00.000Z',
        status: 'confirmed',
        manual_service_name: 'Walk-in'
      }),
      'Walk-in'
    );
  });

  it('shows custom staff_name when no worker relation', () => {
    assert.equal(
      bookingStaffLabel({
        client_name: 'Alex',
        starts_at: '2026-06-15T14:00:00.000Z',
        ends_at: '2026-06-15T15:00:00.000Z',
        status: 'confirmed',
        staff_name: 'Jordan'
      }),
      'Jordan'
    );
  });

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
