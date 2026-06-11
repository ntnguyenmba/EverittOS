const CONTROL_CHARS = /[\0-\x1f\x7f]/g;
const SCRIPT_TAG = /<\s*\/?\s*script\b[^>]*>/gi;
const EVENT_HANDLER = /\bon\w+\s*=/gi;

/** Remove control characters and trim whitespace. */
export function sanitizePlainText(value: string, maxLength = 5000): string {
  return value.replace(CONTROL_CHARS, '').replace(SCRIPT_TAG, '').replace(EVENT_HANDLER, '').trim().slice(0, maxLength);
}

/** Sanitize a single-line field (names, titles). */
export function sanitizeShortText(value: string, maxLength = 200): string {
  return sanitizePlainText(value, maxLength).replace(/[\r\n]+/g, ' ');
}

/** Validate email format (does not verify deliverability). */
export function isValidEmail(value: string): boolean {
  const email = value.trim().toLowerCase();
  if (!email || email.length > 254) return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export function normalizeEmail(value: string): string {
  return sanitizeShortText(value, 254).toLowerCase();
}

/** Validate UUID v4-ish format for route parameters. */
export function isValidUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

/** Escape HTML entities when rendering untrusted strings into HTML (server-side reports). */
export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** Reject strings that look like SQL injection probes in free-text search (defense in depth; Supabase parameterizes queries). */
export function containsSuspiciousSqlPattern(value: string): boolean {
  const lower = value.toLowerCase();
  return (
    /--/.test(value) ||
    /;\s*drop\s/.test(lower) ||
    /;\s*delete\s/.test(lower) ||
    /union\s+select/.test(lower) ||
    /'\s*or\s+'1'\s*=\s*'1/.test(lower)
  );
}

export function validatePasswordLength(password: string, min = 6, max = 128): boolean {
  return password.length >= min && password.length <= max;
}
