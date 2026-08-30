'use client';

import { useMemo } from 'react';

const FALLBACK_TIMEZONES = [
  'UTC','Africa/Cairo','Africa/Johannesburg','Africa/Lagos','America/Anchorage','America/Argentina/Buenos_Aires','America/Bogota','America/Chicago','America/Denver','America/Halifax','America/Lima','America/Los_Angeles','America/Mexico_City','America/New_York','America/Phoenix','America/Sao_Paulo','America/St_Johns','America/Toronto','America/Vancouver','Asia/Bangkok','Asia/Dubai','Asia/Ho_Chi_Minh','Asia/Hong_Kong','Asia/Jakarta','Asia/Jerusalem','Asia/Kolkata','Asia/Manila','Asia/Seoul','Asia/Shanghai','Asia/Singapore','Asia/Tokyo','Australia/Adelaide','Australia/Brisbane','Australia/Melbourne','Australia/Perth','Australia/Sydney','Europe/Amsterdam','Europe/Berlin','Europe/Helsinki','Europe/Istanbul','Europe/London','Europe/Madrid','Europe/Paris','Europe/Rome','Pacific/Auckland','Pacific/Honolulu'
];

type IntlWithSupportedValues = typeof Intl & { supportedValuesOf?: (key: 'timeZone') => string[] };

export function browserTimeZone(fallback = 'America/Chicago'): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || fallback;
  } catch {
    return fallback;
  }
}

export function availableTimezones(): string[] {
  try {
    const values = (Intl as IntlWithSupportedValues).supportedValuesOf?.('timeZone') || [];
    return Array.from(new Set(['America/Chicago', 'UTC', ...values, ...FALLBACK_TIMEZONES])).sort((a, b) => a.localeCompare(b));
  } catch {
    return Array.from(new Set(['America/Chicago', ...FALLBACK_TIMEZONES]));
  }
}

function timezoneLabel(timezone: string): string {
  return timezone.replaceAll('_', ' ');
}

export function TimezonePicker({
  value,
  onChange,
  id = 'org-timezone',
  disabled = false
}: {
  value: string;
  onChange: (timezone: string) => void;
  id?: string;
  disabled?: boolean;
  placeholder?: string;
}) {
  const timezones = useMemo(availableTimezones, []);
  const resolvedValue = value && timezones.includes(value) ? value : value || 'America/Chicago';

  return (
    <select
      id={id}
      className="input timezone-picker-select"
      value={resolvedValue}
      disabled={disabled}
      onChange={(event) => onChange(event.target.value)}
      aria-label="Time zone"
    >
      {!timezones.includes(resolvedValue) ? <option value={resolvedValue}>{timezoneLabel(resolvedValue)}</option> : null}
      {timezones.map((timezone) => (
        <option key={timezone} value={timezone}>{timezoneLabel(timezone)}</option>
      ))}
    </select>
  );
}
