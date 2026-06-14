import type { SupabaseClient } from '@supabase/supabase-js';
import { isMissingSchemaError } from '@/lib/supabase-schema-errors';

const SCHEMA_MISSING_PATTERNS = [
  'does not exist',
  'could not find',
  'schema cache',
  'relation "public.bookings"',
  'relation "bookings"'
];

const BOOKING_TABLE_HINTS = ['bookings', 'services', 'staff_services', 'staff_availability'];

const BOOKING_COLUMN_HINTS = [
  'manual_service_name',
  'staff_name',
  'workspace_id',
  'confirmation_sent_at'
];

export type BookingSchemaProbeResult =
  | { ready: true }
  | { ready: false; code: 'schema_missing'; missing: string; error: string };

export function isBookingSchemaError(message: string): boolean {
  const lower = message.toLowerCase();
  if (!SCHEMA_MISSING_PATTERNS.some((pattern) => lower.includes(pattern))) {
    if (!lower.includes('column') || !lower.includes('does not exist')) {
      return false;
    }
    return BOOKING_COLUMN_HINTS.some((column) => lower.includes(column));
  }
  return BOOKING_TABLE_HINTS.some((table) => lower.includes(table));
}

export function bookingSchemaUnavailableMessage(): string {
  return 'Booking is not set up in Supabase yet. Apply migration 202608170001_bookings_workspace_repair.sql (or 202608190001_bookings_idempotent_repair.sql), then refresh this page.';
}

export function mapBookingApiError(message: string, fallback = 'Unable to load bookings.'): {
  error: string;
  code?: 'schema_missing';
} {
  if (isBookingSchemaError(message)) {
    return { error: bookingSchemaUnavailableMessage(), code: 'schema_missing' };
  }
  return { error: message || fallback };
}

function isSchemaProbeError(error: { message?: string; code?: string | null } | null): boolean {
  if (!error) return false;
  if (isMissingSchemaError(error)) return true;
  return isBookingSchemaError(error.message || '');
}

/** Probe required booking tables/columns without mutating data. */
export async function probeBookingSchemaReady(
  supabase: SupabaseClient
): Promise<BookingSchemaProbeResult> {
  const { error: bookingsError } = await supabase
    .from('bookings')
    .select('id, workspace_id, manual_service_name, staff_name')
    .limit(1);

  if (isSchemaProbeError(bookingsError)) {
    return {
      ready: false,
      code: 'schema_missing',
      missing: 'bookings',
      error: bookingSchemaUnavailableMessage()
    };
  }

  const probes = [
    { table: 'services', select: 'id, workspace_id' },
    { table: 'staff_services', select: 'id, workspace_id' },
    { table: 'staff_availability', select: 'id, workspace_id' }
  ] as const;

  for (const probe of probes) {
    const { error } = await supabase.from(probe.table).select(probe.select).limit(1);
    if (isSchemaProbeError(error)) {
      return {
        ready: false,
        code: 'schema_missing',
        missing: probe.table,
        error: bookingSchemaUnavailableMessage()
      };
    }
  }

  return { ready: true };
}

export function validateBookingTimeRange(startsAt: string, endsAt: string): string | null {
  const start = new Date(startsAt);
  const end = new Date(endsAt);
  if (Number.isNaN(start.getTime())) return 'Start time is invalid.';
  if (Number.isNaN(end.getTime())) return 'End time is invalid.';
  if (end <= start) return 'End time must be after the start time.';
  return null;
}
