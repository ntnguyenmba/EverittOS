import { appUrl } from '@/lib/app-url';

export function publicBookingPath(slug: string): string {
  return `/book/${slug}`;
}

export function publicBookingUrl(slug: string): string {
  return appUrl(publicBookingPath(slug));
}

export function appBookingsUrl(): string {
  return appUrl('/bookings');
}
