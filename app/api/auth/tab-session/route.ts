import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { applySessionMarkers } from '@/lib/auth-cookies';
import { createTabSessionId, SESSION_ISSUED_COOKIE, TAB_SESSION_COOKIE } from '@/lib/session-policy';
import { createRouteHandlerSupabase } from '@/lib/supabase-route-client';

export const runtime = 'nodejs';

/** Returns the tab session id for sessionStorage sync (supports multiple tabs per browser session). */
export async function GET() {
  const { supabase, attachCookies } = await createRouteHandlerSupabase();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ ok: false, code: 'no_session' }, { status: 401 });
  }

  const cookieStore = await cookies();
  const existing = cookieStore.get(TAB_SESSION_COOKIE)?.value;
  const tabSessionId = existing || createTabSessionId();

  const response = NextResponse.json({ ok: true, tabSessionId });
  applySessionMarkers(response, tabSessionId, cookieStore.get(SESSION_ISSUED_COOKIE)?.value);
  return attachCookies(response);
}
