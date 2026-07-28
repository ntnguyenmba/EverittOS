import { NextResponse } from 'next/server';
import { createRouteHandlerSupabase } from '@/lib/supabase-route-client';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Authenticated heartbeat: stamps profiles.last_seen_at with the server clock. */
export async function POST() {
  const { supabase, json } = await createRouteHandlerSupabase();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized', ok: false }, { status: 401 });
  }

  const { data: touchedAt, error: rpcError } = await supabase.rpc('touch_profile_last_seen');

  if (!rpcError) {
    return json({
      ok: true,
      lastSeenAt: typeof touchedAt === 'string' ? touchedAt : touchedAt ?? null
    });
  }

  // Fallback when the RPC migration is not applied yet.
  const nowIso = new Date().toISOString();
  const { error } = await supabase.from('profiles').update({ last_seen_at: nowIso }).eq('id', user.id);

  if (error) {
    // Missing-column environments should not break the app shell.
    if (/last_seen_at/i.test(error.message) || /column/i.test(error.message)) {
      return json({ ok: true, lastSeenAt: null, deferred: true });
    }
    return NextResponse.json({ error: error.message, ok: false }, { status: 500 });
  }

  return json({ ok: true, lastSeenAt: nowIso });
}
