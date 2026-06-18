import { NextResponse } from 'next/server';
import { ACCOUNT_DELETION_CONFIRMATION } from '@/lib/deletion-policy';
import {
  permanentlyDeletePersonalAccount,
  subscriptionBlocksAccountDeletion
} from '@/lib/account-deletion-server';
import { clearSessionMarkers } from '@/lib/auth-cookies';
import { normalizeRole } from '@/lib/roles';
import { createAdminSupabase } from '@/lib/supabase-admin';
import { createRouteHandlerSupabase } from '@/lib/supabase-route-client';

export const runtime = 'nodejs';

/** Permanently delete the authenticated user's account and auth record. */
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

  if (confirmation !== ACCOUNT_DELETION_CONFIRMATION) {
    return NextResponse.json(
      { error: `Type ${ACCOUNT_DELETION_CONFIRMATION} to confirm account deletion.` },
      { status: 400 }
    );
  }

  const admin = createAdminSupabase();
  if (!admin) {
    return NextResponse.json(
      { error: 'Account deletion is temporarily unavailable. Contact support.' },
      { status: 503 }
    );
  }

  const { data: profile } = await admin
    .from('profiles')
    .select('role, organization_id, plan, subscription_status')
    .eq('id', user.id)
    .maybeSingle();

  const role = normalizeRole(profile?.role || 'employee');
  const organizationId = profile?.organization_id || null;

  if (subscriptionBlocksAccountDeletion(profile?.plan, profile?.subscription_status)) {
    return NextResponse.json(
      {
        error: 'Active subscriptions must be cancelled before account deletion.',
        code: 'active_subscription'
      },
      { status: 409 }
    );
  }

  const result = await permanentlyDeletePersonalAccount({
    admin,
    userId: user.id,
    email: user.email,
    role,
    organizationId,
    plan: profile?.plan,
    subscriptionStatus: profile?.subscription_status
  });

  if (!result.ok) {
    const status = result.code === 'active_subscription' ? 409 : 500;
    return NextResponse.json({ error: result.error, code: result.code }, { status });
  }

  await supabase.auth.signOut();
  const response = attachCookies(
    NextResponse.json({
      ok: true,
      message: 'Your account has been permanently deleted.'
    })
  );
  clearSessionMarkers(response);
  return response;
}
