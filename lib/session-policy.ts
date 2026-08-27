/** Client storage key paired with the httpOnly tab session cookie. */
export const SESSION_TAB_STORAGE_KEY = 'everittos_tab_session';

export const TAB_SESSION_COOKIE = 'everittos_tab';
export const LAST_ACTIVITY_COOKIE = 'everittos_last_activity';

/** Warn users this many milliseconds before idle logout (default 5 minutes). */
export function sessionIdleWarningBeforeMs(): number {
  const raw = process.env.NEXT_PUBLIC_SESSION_IDLE_WARNING_MINUTES || process.env.SESSION_IDLE_WARNING_MINUTES;
  const minutes = raw ? parseInt(raw, 10) : 5;
  if (!Number.isFinite(minutes) || minutes < 1) return 5 * 60 * 1000;
  return minutes * 60 * 1000;
}

/** All clients, including installed iOS/Android apps, use the same inactivity timeout (default 30 minutes). */
export function sessionIdleTimeoutMs(): number {
  const raw = process.env.NEXT_PUBLIC_SESSION_IDLE_TIMEOUT_MINUTES || process.env.SESSION_IDLE_TIMEOUT_MINUTES;
  const minutes = raw ? parseInt(raw, 10) : 30;
  if (!Number.isFinite(minutes) || minutes < 1) return 30 * 60 * 1000;
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

export function touchActivityTimestamp(now = Date.now()): string {
  return new Date(now).toISOString();
}

export const SESSION_EXEMPT_PREFIXES = ['/login', '/signup', '/forgot-password', '/reset-password', '/confirm-email', '/auth/callback', '/api/auth/reset-session', '/privacy', '/terms', '/refund-policy', '/pricing', '/cookies', '/disclaimer', '/security', '/docs/api', '/api/auth/login', '/api/auth/reset-password', '/api/auth/config'] as const;

export function isSessionExemptPath(pathname: string): boolean {
  if (pathname === '/') return true;
  return SESSION_EXEMPT_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}
