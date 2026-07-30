export const DEFAULT_TIME_ZONE = 'America/Chicago';

export const TIME_ZONE_OPTIONS = [
  { value: 'Pacific/Honolulu', label: 'Hawaii (Honolulu)' },
  { value: 'America/Anchorage', label: 'Alaska (Anchorage)' },
  { value: 'America/Los_Angeles', label: 'Pacific Time (US & Canada)' },
  { value: 'America/Denver', label: 'Mountain Time (US & Canada)' },
  { value: 'America/Phoenix', label: 'Arizona (Phoenix)' },
  { value: 'America/Chicago', label: 'Central Time (US & Canada)' },
  { value: 'America/New_York', label: 'Eastern Time (US & Canada)' },
  { value: 'America/Halifax', label: 'Atlantic Time (Canada)' },
  { value: 'America/St_Johns', label: 'Newfoundland' },
  { value: 'America/Mexico_City', label: 'Mexico City' },
  { value: 'America/Bogota', label: 'Bogota, Lima, Quito' },
  { value: 'America/Sao_Paulo', label: 'Sao Paulo' },
  { value: 'America/Argentina/Buenos_Aires', label: 'Buenos Aires' },
  { value: 'Europe/London', label: 'London' },
  { value: 'Europe/Paris', label: 'Paris, Berlin, Rome, Madrid' },
  { value: 'Europe/Helsinki', label: 'Helsinki, Kyiv, Athens' },
  { value: 'Europe/Istanbul', label: 'Istanbul' },
  { value: 'Africa/Cairo', label: 'Cairo' },
  { value: 'Africa/Johannesburg', label: 'Johannesburg' },
  { value: 'Asia/Dubai', label: 'Dubai' },
  { value: 'Asia/Kolkata', label: 'India (Kolkata)' },
  { value: 'Asia/Bangkok', label: 'Bangkok' },
  { value: 'Asia/Ho_Chi_Minh', label: 'Vietnam (Ho Chi Minh City)' },
  { value: 'Asia/Singapore', label: 'Singapore' },
  { value: 'Asia/Hong_Kong', label: 'Hong Kong' },
  { value: 'Asia/Shanghai', label: 'China (Shanghai)' },
  { value: 'Asia/Tokyo', label: 'Tokyo' },
  { value: 'Asia/Seoul', label: 'Seoul' },
  { value: 'Australia/Perth', label: 'Perth' },
  { value: 'Australia/Adelaide', label: 'Adelaide' },
  { value: 'Australia/Sydney', label: 'Sydney, Melbourne' },
  { value: 'Pacific/Auckland', label: 'Auckland' },
  { value: 'UTC', label: 'UTC' }
] as const;

export function isValidTimeZone(value: unknown): value is string {
  if (typeof value !== 'string' || !value.trim()) return false;
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: value.trim() }).format();
    return true;
  } catch {
    return false;
  }
}

export function normalizeTimeZone(value: unknown, fallback = DEFAULT_TIME_ZONE): string {
  return isValidTimeZone(value) ? value.trim() : fallback;
}

export function timeZoneLabel(value: string): string {
  return TIME_ZONE_OPTIONS.find((option) => option.value === value)?.label || value.replaceAll('_', ' ');
}
