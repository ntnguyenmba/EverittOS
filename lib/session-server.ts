import { clearSessionMarkers, touchSessionActivity } from '@/lib/auth-cookies';
import { isSessionAbsoluteExpired, isSessionIdle, LAST_ACTIVITY_COOKIE, SESSION_ISSUED_COOKIE } from '@/lib/session-policy';
import { NextResponse, type NextRequest } from 'next/server';
import type { SupabaseClient } from '@supabase/supabase-js';

export function readLastActivity(request: NextRequest): string | undefined {
  return request.cookies.get(LAST_ACTIVITY_COOKIE)?.value;
}

function redirectWithCookies(url: URL, source: NextResponse): NextResponse {
  const redirect = NextResponse.redirect(url);
  source.cookies.getAll().forEach(({ name, value }) => redirect.cookies.set(name, value));
  return redirect;
}

async function expireSession(request: NextRequest, supabase: SupabaseClient, response: NextResponse, reason: 'idle' | 'session', detail: string) {
  await supabase.auth.signOut();
  clearSessionMarkers(response);
  if (request.nextUrl.pathname.startsWith('/api/')) {
    const json = NextResponse.json({ error: detail, code: 'session_expired' }, { status: 401 });
    response.cookies.getAll().forEach(({ name, value }) => json.cookies.set(name, value));
    clearSessionMarkers(json);
    return json;
  }
  const login = new URL('/login', request.url);
  login.searchParams.set('reason', reason);
  login.searchParams.set('detail', detail);
  return redirectWithCookies(login, response);
}

export async function enforceIdleSession(request: NextRequest, supabase: SupabaseClient, response: NextResponse): Promise<NextResponse | null> {
  const issuedAt = request.cookies.get(SESSION_ISSUED_COOKIE)?.value;
  if (issuedAt && isSessionAbsoluteExpired(issuedAt)) {
    return expireSession(request, supabase, response, 'session', 'Your 12-hour session ended. Sign in again to continue.');
  }
  const lastActivity = readLastActivity(request);
  if (lastActivity && isSessionIdle(lastActivity)) {
    return expireSession(request, supabase, response, 'idle', 'Your server session expired after 15 minutes of inactivity. Sign in again to continue.');
  }
  touchSessionActivity(response);
  return null;
}
