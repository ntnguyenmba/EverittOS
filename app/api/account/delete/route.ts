import { NextResponse } from 'next/server';
import { createAdminSupabase } from '@/lib/supabase-admin';
import { clearSessionMarkers } from '@/lib/auth-cookies';
import { createRouteHandlerSupabase } from '@/lib/supabase-route-client';

const CONFIRMATION_PHRASE = 'DELETE MY ACCOUNT';
const RECOVERY_DAYS = 14;

export const runtime = 'nodejs';

/** Soft-delete account with recovery window; signs user out immediately. */
export async function POST(request: Request) {
  const { supabase, attachCookies } = await createRouteHandlerSupabase();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const confirmation = String(body.confirmation || '').trim();

  if (confirmation !== CONFIRMATION_PHRASE) {
    return NextResponse.json(
      { error: `Type "${CONFIRMATION_PHRASE}" exactly to delete your account.` },
      { status: 400 }
    );
  }

  const now = new Date();
  const scheduled = new Date(now.getTime() + RECOVERY_DAYS * 24 * 60 * 60 * 1000);

  const { error } = await supabase
    .from('profiles')
    .update({
      deleted_at: now.toISOString(),
      deletion_scheduled_at: scheduled.toISOString(),
      account_status: 'disabled'
    })
    .eq('id', user.id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const admin = createAdminSupabase();
  if (admin) {
    const { data: profile } = await admin
      .from('profiles')
      .select('organization_id, email')
      .eq('id', user.id)
      .maybeSingle();

    if (profile?.organization_id) {
      await admin.from('activity_logs').insert({
        organization_id: profile.organization_id,
        actor_id: user.id,
        actor_name: profile.email || user.email || 'User',
        entity_type: 'account',
        entity_id: user.id,
        action: 'account_soft_deleted',
        message: `Account scheduled for deletion after ${RECOVERY_DAYS}-day recovery window.`
      });
    }
  }

  await supabase.auth.signOut();
  const response = attachCookies(
    NextResponse.json({
      ok: true,
      recoveryDays: RECOVERY_DAYS,
      deletionScheduledAt: scheduled.toISOString()
    })
  );
  clearSessionMarkers(response);
  return response;
}
