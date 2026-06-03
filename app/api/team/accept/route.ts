import { NextResponse } from 'next/server';
import { createServerSupabase } from '@/lib/supabase-server';
import { createAdminSupabase } from '@/lib/supabase-admin';

export async function POST(request: Request) {
  const supabase = await createServerSupabase();
  const admin = createAdminSupabase();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user || !admin) {
    return NextResponse.json({ error: 'Sign in to accept the invitation' }, { status: 401 });
  }

  const body = (await request.json()) as { token?: string };
  const token = (body.token || '').trim();
  if (!token) {
    return NextResponse.json({ error: 'token is required' }, { status: 400 });
  }

  const { data: invite } = await admin
    .from('organization_invitations')
    .select('*')
    .eq('token', token)
    .eq('status', 'pending')
    .maybeSingle();

  if (!invite) {
    return NextResponse.json({ error: 'Invitation not found or already used' }, { status: 404 });
  }

  if (new Date(invite.expires_at).getTime() < Date.now()) {
    await admin.from('organization_invitations').update({ status: 'expired' }).eq('id', invite.id);
    return NextResponse.json({ error: 'Invitation expired' }, { status: 410 });
  }

  const { data: profile } = await supabase.from('profiles').select('email').eq('id', user.id).maybeSingle();
  if ((profile?.email || user.email || '').toLowerCase() !== invite.email.toLowerCase()) {
    return NextResponse.json({ error: 'This invitation was sent to a different email address' }, { status: 403 });
  }

  const { error: memberError } = await admin.from('organization_members').upsert(
    {
      organization_id: invite.organization_id,
      user_id: user.id,
      role: invite.role,
      active: true
    },
    { onConflict: 'organization_id,user_id' }
  );

  if (memberError) {
    return NextResponse.json({ error: memberError.message }, { status: 400 });
  }

  await admin
    .from('organization_invitations')
    .update({ status: 'accepted', accepted_at: new Date().toISOString() })
    .eq('id', invite.id);

  await admin
    .from('profiles')
    .update({ organization_id: invite.organization_id, role: invite.role })
    .eq('id', user.id);

  return NextResponse.json({ ok: true, organizationId: invite.organization_id });
}
