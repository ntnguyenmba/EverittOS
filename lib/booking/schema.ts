const SCHEMA_MISSING_PATTERNS = [
  'does not exist',
  'could not find',
  'schema cache',
  'relation "public.bookings"',
  'relation "bookings"'
];

const BOOKING_TABLE_HINTS = ['bookings', 'services', 'staff_services', 'staff_availability'];

export function isBookingSchemaError(message: string): boolean {
  const lower = message.toLowerCase();
  if (!SCHEMA_MISSING_PATTERNS.some((pattern) => lower.includes(pattern))) {
    return false;
  }
  return BOOKING_TABLE_HINTS.some((table) => lower.includes(table));
}

export function bookingSchemaUnavailableMessage(): string {
  return 'Booking is not set up in Supabase yet. Apply migration 202608170001_bookings_workspace_repair.sql, then refresh this page.';
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
