import {
  LAST_ACTIVITY_COOKIE,
  TAB_SESSION_COOKIE,
  createTabSessionId,
  touchActivityTimestamp
} from '@/lib/session-policy';
import type { NextResponse } from 'next/server';

type CookieInput = { name: string; value: string; options?: Record<string, unknown> };

/**
 * Keep Supabase's auth-cookie lifetime intact.
 * Removing Max-Age/Expires made authentication depend on WebView session-cookie
 * behavior, which can drop a valid login during navigation on iPad/iOS shells.
 */
export function sanitizeAuthCookieOptions(options?: Record<string, unknown>): Record<string, unknown> {
  const secure = process.env.NODE_ENV === 'production';
  return {
    ...options,
    path: '/',
    sameSite: 'lax',
    secure,
    httpOnly: options?.httpOnly !== false
  };
}

export function wrapSupabaseCookieSetAll(
  setAll: (cookies: CookieInput[]) => void
): (cookies: CookieInput[]) => void {
  return (cookiesToSet) => {
    setAll(
      cookiesToSet.map((entry) => ({
        ...entry,
        options: sanitizeAuthCookieOptions(entry.options)
      }))
    );
  };
}

export function createSupabaseCookieAdapter(handlers: {
  getAll: () => { name: string; value: string }[];
  setAll: (cookies: CookieInput[]) => void;
}) {
  return {
    getAll: handlers.getAll,
    setAll: wrapSupabaseCookieSetAll(handlers.setAll)
  };
}

/** Activity markers remain session-scoped; only auth tokens need their provider lifetime. */
export function sessionMarkerCookieOptions(): Record<string, unknown> {
  const secure = process.env.NODE_ENV === 'production';
  return {
    path: '/',
    sameSite: 'lax',
    secure,
    httpOnly: true
  };
}

export function applySessionMarkers(response: NextResponse, tabId?: string): string {
  const tab = tabId || createTabSessionId();
  const now = touchActivityTimestamp();
  response.cookies.set(TAB_SESSION_COOKIE, tab, sessionMarkerCookieOptions());
  response.cookies.set(LAST_ACTIVITY_COOKIE, now, sessionMarkerCookieOptions());
  return tab;
}

export function touchSessionActivity(response: NextResponse): void {
  response.cookies.set(LAST_ACTIVITY_COOKIE, touchActivityTimestamp(), sessionMarkerCookieOptions());
}

export function clearSessionMarkers(response: NextResponse): void {
  const cleared = sessionMarkerCookieOptions();
  response.cookies.set(TAB_SESSION_COOKIE, '', { ...cleared, maxAge: 0 });
  response.cookies.set(LAST_ACTIVITY_COOKIE, '', { ...cleared, maxAge: 0 });
}
