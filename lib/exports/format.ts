/** Plain formatting helpers for CSV / printable export cells. */

function validTimeZone(timezone?: string | null): string | undefined {
  const tz = String(timezone || '').trim();
  if (!tz) return undefined;
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: tz }).format(new Date());
    return tz;
  } catch {
    return undefined;
  }
}

/** Plain number string with 2 decimals, or empty when null/invalid. */
export function formatExportMoney(n: number | null | undefined): string {
  if (n == null) return '';
  const value = Number(n);
  if (!Number.isFinite(value)) return '';
  return value.toFixed(2);
}

/** YYYY-MM-DD from ISO or YMD; optional IANA timezone for true ISO timestamps. */
export function formatExportDate(isoOrYmd: string | null | undefined, timezone?: string | null): string {
  const raw = String(isoOrYmd || '').trim();
  if (!raw) return '';
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;

  const wall = raw.match(/^(\d{4}-\d{2}-\d{2})/);
  const tz = validTimeZone(timezone);
  if (!tz) {
    return wall ? wall[1] : '';
  }

  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) {
    return wall ? wall[1] : '';
  }

  try {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: tz,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    }).format(date);
  } catch {
    return wall ? wall[1] : '';
  }
}

/** HH:mm from ISO timestamp. */
export function formatExportTime(iso: string | null | undefined, timezone?: string | null): string {
  const raw = String(iso || '').trim();
  if (!raw) return '';

  const wall = raw.match(/^\d{4}-\d{2}-\d{2}[T\s](\d{2}):(\d{2})/);
  const tz = validTimeZone(timezone);
  if (!tz) {
    return wall ? `${wall[1]}:${wall[2]}` : '';
  }

  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) {
    return wall ? `${wall[1]}:${wall[2]}` : '';
  }

  try {
    const parts = new Intl.DateTimeFormat('en-GB', {
      timeZone: tz,
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    }).formatToParts(date);
    const hour = parts.find((p) => p.type === 'hour')?.value || '';
    const minute = parts.find((p) => p.type === 'minute')?.value || '';
    if (!hour || !minute) return wall ? `${wall[1]}:${wall[2]}` : '';
    return `${hour}:${minute}`;
  } catch {
    return wall ? `${wall[1]}:${wall[2]}` : '';
  }
}

/** YYYY-MM-DD HH:mm */
export function formatExportDateTime(iso: string | null | undefined, timezone?: string | null): string {
  const date = formatExportDate(iso, timezone);
  const time = formatExportTime(iso, timezone);
  if (date && time) return `${date} ${time}`;
  return date || time || '';
}

/** Local-part before @ when a display name is missing. */
export function cleanEmailFallback(email: string | null | undefined): string {
  const value = String(email || '').trim();
  if (!value) return '';
  const at = value.indexOf('@');
  if (at <= 0) return value;
  return value.slice(0, at);
}

export function displayPersonName(name: string | null | undefined, email: string | null | undefined): string {
  const trimmed = String(name || '').trim();
  if (trimmed) return trimmed;
  return cleanEmailFallback(email) || String(email || '').trim() || '';
}
