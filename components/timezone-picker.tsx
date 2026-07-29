'use client';

import { useMemo } from 'react';

const FALLBACK_TIMEZONES = [
  'UTC',
  'Africa/Cairo',
  'Africa/Johannesburg',
  'Africa/Lagos',
  'America/Anchorage',
  'America/Argentina/Buenos_Aires',
  'America/Bogota',
  'America/Chicago',
  'America/Denver',
  'America/Halifax',
  'America/Lima',
  'America/Los_Angeles',
  'America/Mexico_City',
  'America/New_York',
  'America/Phoenix',
  'America/Sao_Paulo',
  'America/Toronto',
  'America/Vancouver',
  'Asia/Bangkok',
  'Asia/Dubai',
  'Asia/Ho_Chi_Minh',
  'Asia/Hong_Kong',
  'Asia/Jakarta',
  'Asia/Jerusalem',
  'Asia/Kolkata',
  'Asia/Manila',
  'Asia/Seoul',
  'Asia/Shanghai',
  'Asia/Singapore',
  'Asia/Tokyo',
  'Australia/Adelaide',
  'Australia/Brisbane',
  'Australia/Melbourne',
  'Australia/Perth',
  'Australia/Sydney',
  'Europe/Amsterdam',
  'Europe/Berlin',
  'Europe/London',
  'Europe/Madrid',
  'Europe/Paris',
  'Europe/Rome',
  'Pacific/Auckland',
  'Pacific/Honolulu'
];

type IntlWithSupportedValues = typeof Intl & {
  supportedValuesOf?: (key: 'timeZone') => string[];
};

function availableTimezones(): string[] {
  try {
    const values = (Intl as IntlWithSupportedValues).supportedValuesOf?.('timeZone') || [];
    return Array.from(new Set(['UTC', ...values])).sort((a, b) => a.localeCompare(b));
  } catch {
    return FALLBACK_TIMEZONES;
  }
}

function timezoneLabel(timezone: string): string {
  return timezone.replaceAll('_', ' ');
}

export function TimezonePicker({
  value,
  onChange
}: {
  value: string;
  onChange: (timezone: string) => void;
}) {
  const timezones = useMemo(availableTimezones, []);

  return (
    <>
      <input
        id="org-timezone"
        className="input"
        list="global-timezones"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder="Search city or region, for example America/Chicago"
        autoComplete="off"
        spellCheck={false}
      />
      <datalist id="global-timezones">
        {timezones.map((timezone) => (
          <option key={timezone} value={timezone} label={timezoneLabel(timezone)} />
        ))}
      </datalist>
      <p className="muted" style={{ marginTop: -6 }}>
        Used for job times, daylight-saving changes, and calendar synchronization.
      </p>
    </>
  );
}
