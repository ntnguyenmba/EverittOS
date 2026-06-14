import { NextResponse } from 'next/server';
import { createServerSupabase } from '@/lib/supabase-server';
import { createAdminSupabase } from '@/lib/supabase-admin';
import { SUPPORT_EMAIL } from '@/lib/support';

const CONFIRMATION_PHRASE = 'DELETE MY ACCOUNT';

export async function POST(request: Request) {
  const supabase = await createServerSupabase();
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
      { error: `Type "${CONFIRMATION_PHRASE}" exactly to request permanent deletion.` },
      { status: 400 }
    );
  }

  const admin = createAdminSupabase();
  if (!admin) {
    return NextResponse.json({ error: 'Account service is not configured.' }, { status: 503 });
  }

  const { data: profile } = await admin
    .from('profiles')
    .select('organization_id, role, email')
    .eq('id', user.id)
    .maybeSingle();

  await admin
    .from('profiles')
    .update({
      data_deletion_requested_at: new Date().toISOString(),
      account_status: 'deletion_requested'
    })
    .eq('id', user.id);

  if (profile?.organization_id) {
    await admin.from('activity_logs').insert({
      organization_id: profile.organization_id,
      user_id: user.id,
      actor_name: profile.email || user.email || 'User',
      entity_type: 'account',
      entity_id: user.id,
      action: 'deletion_requested',
      message: 'User requested permanent account and data deletion from account settings.'
    });
  }

  return NextResponse.json({
    ok: true,
    message: `Deletion request recorded. Our team will follow up at ${user.email}. For urgent requests, email ${SUPPORT_EMAIL}.`,
    supportEmail: SUPPORT_EMAIL
  });
}
