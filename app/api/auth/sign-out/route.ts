import { NextResponse } from 'next/server';
import { clearSessionMarkers } from '@/lib/auth-cookies';
import { createRouteHandlerSupabase } from '@/lib/supabase-route-client';

export const runtime = 'nodejs';

export async function POST() {
  const { supabase, attachCookies } = await createRouteHandlerSupabase();
  await supabase.auth.signOut();

  const response = NextResponse.json({ ok: true });
  clearSessionMarkers(response);
  return attachCookies(response);
}
