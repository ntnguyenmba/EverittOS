import { clearSessionMarkers, touchSessionActivity } from '@/lib/auth-cookies';
import { isSessionIdle, LAST_ACTIVITY_COOKIE } from '@/lib/session-policy';
import { NextResponse, type NextRequest } from 'next/server';
import type { SupabaseClient } from '@supabase/supabase-js';

export function readLastActivity(request: NextRequest): string | undefined {
  return request.cookies.get(LAST_ACTIVITY_COOKIE)?.value;
}

function redirectWithCookies(url: URL, source: NextResponse): NextResponse {
  const redirect = NextResponse.redirect(url);
  source.cookies.getAll().forEach(({ name, value }) => {
    redirect.cookies.set(name, value);
  });
  return redirect;
}

export async function enforceIdleSession(
  request: NextRequest,
  supabase: SupabaseClient,
  response: NextResponse
): Promise<NextResponse | null> {
  const lastActivity = readLastActivity(request);
  if (!lastActivity || !isSessionIdle(lastActivity)) {
    touchSessionActivity(response);
    return null;
  }

  await supabase.auth.signOut();
  clearSessionMarkers(response);

  const login = new URL('/login', request.url);
  login.searchParams.set('reason', 'idle');
  login.searchParams.set(
    'detail',
    'You were signed out after a period of inactivity. Sign in again to continue.'
  );

  return redirectWithCookies(login, response);
}
