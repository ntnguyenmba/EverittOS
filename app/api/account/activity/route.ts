import { NextResponse } from 'next/server';
import { createAdminSupabase } from '@/lib/supabase-admin';
import { createRouteHandlerSupabase } from '@/lib/supabase-route-client';
import { publicErrorMessage } from '@/lib/safe-api-error';

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

  if (!rpcError && touchedAt) {
    return json({
      ok: true,
      lastSeenAt: typeof touchedAt === 'string' ? touchedAt : touchedAt ?? null
    });
  }

  // Use the service-role client only after the request has been authenticated.
  // This covers production environments where the RPC is missing, returns null,
  // or profile update RLS blocks the normal session client.
  const admin = createAdminSupabase();
  if (!admin) {
    return NextResponse.json(
      {
        error: rpcError?.message || 'Activity tracking is not configured on the server.',
        ok: false
      },
      { status: 503 }
    );
  }

  const nowIso = new Date().toISOString();
  const { data: updatedProfile, error: adminError } = await admin
    .from('profiles')
    .update({ last_seen_at: nowIso })
    .eq('id', user.id)
    .select('id, last_seen_at')
    .maybeSingle();

  if (adminError) {
    // Missing-column environments should not break the app shell.
    if (/last_seen_at/i.test(adminError.message) || /column/i.test(adminError.message)) {
      return json({ ok: true, lastSeenAt: null, deferred: true });
    }
    return NextResponse.json({ error: publicErrorMessage(adminError), ok: false }, { status: 500 });
  }

  if (!updatedProfile) {
    return NextResponse.json({ error: 'Authenticated profile not found', ok: false }, { status: 404 });
  }

  return json({ ok: true, lastSeenAt: updatedProfile.last_seen_at || nowIso });
}
