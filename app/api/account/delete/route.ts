import { NextResponse } from 'next/server';
import { ACCOUNT_DELETION_CONFIRMATION } from '@/lib/deletion-policy';
import {
  canDeletePersonalAccount,
  scheduleAccountDeletion,
  verifyAccountPassword
} from '@/lib/account-deletion-server';
import { clearSessionMarkers } from '@/lib/auth-cookies';
import { normalizeRole } from '@/lib/roles';
import { createAdminSupabase } from '@/lib/supabase-admin';
import { createRouteHandlerSupabase } from '@/lib/supabase-route-client';

export const runtime = 'nodejs';

/** Soft-delete account with recovery window; signs user out immediately. */
export async function POST(request: Request) {
  const { supabase, attachCookies } = await createRouteHandlerSupabase();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const confirmation = String(body.confirmation || '').trim();
  const password = String(body.password || '');

  if (confirmation !== ACCOUNT_DELETION_CONFIRMATION) {
    return NextResponse.json(
      { error: `Type ${ACCOUNT_DELETION_CONFIRMATION} to confirm account deletion.` },
      { status: 400 }
    );
  }

  if (!password) {
    return NextResponse.json({ error: 'Enter your password to confirm account deletion.' }, { status: 400 });
  }

  const passwordOk = await verifyAccountPassword(supabase, user.email, password);
  if (!passwordOk) {
    return NextResponse.json({ error: 'Password confirmation failed.' }, { status: 401 });
  }

  const admin = createAdminSupabase();
  const { data: profile } = await (admin || supabase)
    .from('profiles')
    .select('role, organization_id')
    .eq('id', user.id)
    .maybeSingle();

  if (admin) {
    const allowed = await canDeletePersonalAccount(
      admin,
      user.id,
      profile?.role || 'employee',
      profile?.organization_id || null
    );
    if (!allowed.ok) {
      return NextResponse.json({ error: allowed.error }, { status: 409 });
    }
  }

  const result = await scheduleAccountDeletion({
    supabase,
    admin,
    userId: user.id,
    email: user.email,
    organizationId: profile?.organization_id || null
  });

  if ('error' in result) {
    return NextResponse.json({ error: result.error }, { status: 500 });
  }

  await supabase.auth.signOut();
  const response = attachCookies(
    NextResponse.json({
      ok: true,
      recoveryDays: 30,
      deletionScheduledAt: result.deletionScheduledAt,
      role: normalizeRole(profile?.role)
    })
  );
  clearSessionMarkers(response);
  return response;
}
