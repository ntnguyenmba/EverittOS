/** Client storage key paired with the httpOnly tab session cookie. */
export const SESSION_TAB_STORAGE_KEY = 'everittos_tab_session';

export const TAB_SESSION_COOKIE = 'everittos_tab';
export const LAST_ACTIVITY_COOKIE = 'everittos_last_activity';
export const SESSION_ISSUED_COOKIE = 'everittos_session_issued';

/** Server-side idle expiry. This is separate from the native device lock. */
export function sessionIdleTimeoutMs(): number {
  const raw = process.env.NEXT_PUBLIC_SESSION_IDLE_TIMEOUT_MINUTES || process.env.SESSION_IDLE_TIMEOUT_MINUTES;
  const minutes = raw ? parseInt(raw, 10) : 15;
  if (!Number.isFinite(minutes) || minutes < 1) return 15 * 60 * 1000;
  return minutes * 60 * 1000;
}

/** Hard login lifetime, regardless of activity. */
export function sessionAbsoluteTimeoutMs(): number {
  const raw = process.env.NEXT_PUBLIC_SESSION_ABSOLUTE_HOURS || process.env.SESSION_ABSOLUTE_HOURS;
  const hours = raw ? parseInt(raw, 10) : 12;
  if (!Number.isFinite(hours) || hours < 1) return 12 * 60 * 60 * 1000;
  return hours * 60 * 60 * 1000;
}

/** Native field pages lock after 10 minutes; office and money surfaces after 5. */
export function deviceIdleLockMs(pathname: string): number {
  const field = pathname.startsWith('/portal/contractor') || pathname.startsWith('/my-work') || pathname.startsWith('/jobs');
  return (field ? 10 : 5) * 60 * 1000;
}

export const SYSTEM_HANDOFF_GRACE_MS = 90 * 1000;

/** Warn shortly before web session expiry. */
export function sessionIdleWarningBeforeMs(): number {
  const raw = process.env.NEXT_PUBLIC_SESSION_IDLE_WARNING_MINUTES || process.env.SESSION_IDLE_WARNING_MINUTES;
  const minutes = raw ? parseInt(raw, 10) : 2;
  if (!Number.isFinite(minutes) || minutes < 1) return 2 * 60 * 1000;
  return minutes * 60 * 1000;
}

export function sessionIdleTimeoutMinutes(): number {
  return Math.round(sessionIdleTimeoutMs() / 60_000);
}

export function sessionIdleWarningBeforeMinutes(): number {
  return Math.round(sessionIdleWarningBeforeMs() / 60_000);
}

export function createTabSessionId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export function isSessionIdle(lastActivityIso: string | null | undefined, now = Date.now()): boolean {
  if (!lastActivityIso) return true;
  const ts = Date.parse(lastActivityIso);
  if (Number.isNaN(ts)) return true;
  return now - ts > sessionIdleTimeoutMs();
}

export function isSessionAbsoluteExpired(issuedIso: string | null | undefined, now = Date.now()): boolean {
  if (!issuedIso) return true;
  const ts = Date.parse(issuedIso);
  if (Number.isNaN(ts)) return true;
  return now - ts > sessionAbsoluteTimeoutMs();
}

export function touchActivityTimestamp(now = Date.now()): string {
  return new Date(now).toISOString();
}

export const SESSION_EXEMPT_PREFIXES = ['/login', '/signup', '/forgot-password', '/reset-password', '/confirm-email', '/auth/callback', '/api/auth/reset-session', '/privacy', '/terms', '/refund-policy', '/pricing', '/cookies', '/disclaimer', '/security', '/docs/api', '/api/auth/login', '/api/auth/reset-password', '/api/auth/config'] as const;

export function isSessionExemptPath(pathname: string): boolean {
  if (pathname === '/') return true;
  return SESSION_EXEMPT_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}
