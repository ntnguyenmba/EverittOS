import { BOOKING_STATUS_LABELS, formatBookingWhen } from '@/lib/booking/index';

export type BookingDisplayRow = {
  service_id?: string | null;
  manual_service_name?: string | null;
  services?: { name: string } | null;
  worker_id?: string | null;
  staff_name?: string | null;
  workers?: { name: string } | null;
  client_name: string;
  starts_at: string;
  ends_at: string;
  status: string;
  notes?: string | null;
  google_calendar_event_id?: string | null;
};

export function bookingAppointmentName(booking: BookingDisplayRow): string {
  if (booking.services?.name?.trim()) return booking.services.name.trim();
  if (booking.manual_service_name?.trim()) return booking.manual_service_name.trim();
  return 'Manual booking';
}

export function bookingStaffLabel(booking: BookingDisplayRow): string {
  if (booking.workers?.name?.trim()) return booking.workers.name.trim();
  if (booking.staff_name?.trim()) return booking.staff_name.trim();
  return 'Unassigned';
}

export function bookingCalendarSyncLabel(booking: Pick<BookingDisplayRow, 'google_calendar_event_id'>): string {
  return booking.google_calendar_event_id ? 'Calendar synced' : 'Not synced';
}

export function formatBookingDetailsText(booking: BookingDisplayRow): string {
  const lines = [
    `Customer: ${booking.client_name}`,
    `Appointment: ${bookingAppointmentName(booking)}`,
    `When: ${formatBookingWhen(booking.starts_at, booking.ends_at)}`,
    `Staff: ${bookingStaffLabel(booking)}`,
    `Status: ${BOOKING_STATUS_LABELS[booking.status] || booking.status}`
  ];
  if (booking.notes?.trim()) {
    lines.push(`Notes: ${booking.notes.trim()}`);
  }
  return lines.join('\n');
}

export function defaultBookingEndIso(startsAt: string, minutes = 60): string {
  const start = new Date(startsAt);
  if (Number.isNaN(start.getTime())) return startsAt;
  const end = new Date(start.getTime() + minutes * 60_000);
  return end.toISOString();
}
