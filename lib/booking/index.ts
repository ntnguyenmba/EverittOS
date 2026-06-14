export * from '@/lib/booking/types';
export * from '@/lib/booking/schema';
export * from '@/lib/booking/display';
export * from '@/lib/booking/ics';
export * from '@/lib/booking/public-url';
export * from '@/lib/booking/slug';
export * from '@/lib/booking/conflicts';
export * from '@/lib/booking/availability';
export * from '@/lib/booking/google-calendar-booking';

export function formatServicePrice(priceCents: number): string {
  return `$${(priceCents / 100).toFixed(2)}`;
}

export function formatBookingWhen(startsAt: string, endsAt: string): string {
  const start = new Date(startsAt);
  const end = new Date(endsAt);
  if (Number.isNaN(start.getTime())) return startsAt;
  const date = start.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
  const startTime = start.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
  const endTime = end.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
  return `${date} · ${startTime} – ${endTime}`;
}

export const BOOKING_STATUS_LABELS: Record<string, string> = {
  confirmed: 'Confirmed',
  pending: 'Pending',
  cancelled: 'Cancelled',
  completed: 'Completed',
  'no-show': 'No-show'
};
