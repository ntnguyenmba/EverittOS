import { NextResponse } from 'next/server';
import { touchSessionActivity } from '@/lib/auth-cookies';
import { createRouteHandlerSupabase } from '@/lib/supabase-route-client';

export const runtime = 'nodejs';

export async function POST() {
  const { supabase, attachCookies } = await createRouteHandlerSupabase();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ ok: false, code: 'no_session' }, { status: 401 });
  }

  const response = NextResponse.json({ ok: true });
  touchSessionActivity(response);
  return attachCookies(response);
}
