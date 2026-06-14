/** Fields required by the Bookings page list (joins optional for manual bookings). */
export const BOOKING_LIST_SELECT =
  'id, organization_id, workspace_id, service_id, manual_service_name, worker_id, staff_name, customer_id, client_name, client_email, client_phone, starts_at, ends_at, status, source, notes, google_calendar_event_id, confirmation_sent_at, staff_notified_at, calendar_sync_error, created_at, updated_at, services(name, duration_minutes, price_cents), workers(name)';

export function startOfTodayUtcIso(now = new Date()): string {
  const d = new Date(now);
  d.setUTCHours(0, 0, 0, 0);
  return d.toISOString();
}

/**
 * Upcoming list cutoff: include bookings that end today or later (UTC day boundary).
 * Avoids hiding same-day manual bookings due to starts_at >= now filtering.
 */
export function upcomingBookingCutoffIso(now = new Date()): string {
  return startOfTodayUtcIso(now);
}

export function isBookingVisibleInUpcomingList(
  booking: { starts_at: string; ends_at: string; status: string },
  now = new Date()
): boolean {
  if (booking.status === 'cancelled') return false;
  const cutoffMs = new Date(upcomingBookingCutoffIso(now)).getTime();
  return new Date(booking.ends_at).getTime() >= cutoffMs;
}

export function bookingMatchesWorkspace(
  booking: { organization_id?: string | null; workspace_id?: string | null },
  workspaceId: string
): boolean {
  return booking.organization_id === workspaceId || booking.workspace_id === workspaceId;
}

export function assertBookingInsertResult(
  row: { id?: string | null } | null | undefined
): row is { id: string } {
  return Boolean(row?.id);
}
