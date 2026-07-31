import { find } from 'geo-tz';
import { isValidTimeZone, normalizeTimeZone } from '@/lib/time-zones';

/**
 * Resolve an IANA timezone from geographic coordinates using local geo-tz data.
 * Does not call a paid API and does not infer from state/postal/browser alone.
 */
export function timezoneFromCoordinates(
  latitude: number | null | undefined,
  longitude: number | null | undefined,
  fallback?: string | null
): string | null {
  if (
    typeof latitude !== 'number' ||
    typeof longitude !== 'number' ||
    !Number.isFinite(latitude) ||
    !Number.isFinite(longitude) ||
    latitude < -90 ||
    latitude > 90 ||
    longitude < -180 ||
    longitude > 180
  ) {
    return fallback && isValidTimeZone(fallback) ? fallback.trim() : null;
  }

  try {
    const zones = find(latitude, longitude);
    const zone = zones.find((candidate) => isValidTimeZone(candidate));
    if (zone) return zone;
  } catch {
    // Fall through to optional fallback.
  }

  return fallback && isValidTimeZone(fallback) ? fallback.trim() : null;
}

export function timezoneFromCoordinatesOrDefault(
  latitude: number | null | undefined,
  longitude: number | null | undefined,
  fallback = 'America/Chicago'
): string {
  return normalizeTimeZone(timezoneFromCoordinates(latitude, longitude, fallback), fallback);
}
