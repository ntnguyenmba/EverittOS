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
  const { data: profile } = await supabase.from('profiles').select('email').eq('id', user.id).maybeSingle();
  const userEmail = (profile?.email || user.email || '').toLowerCase();

  let inviteQuery = admin
    .from('organization_invitations')
    .select('*')
    .eq('status', 'pending');

  if (token) {
    inviteQuery = inviteQuery.eq('token', token);
  } else if (userEmail) {
    inviteQuery = inviteQuery.eq('email', userEmail).order('created_at', { ascending: false });
  } else {
    return NextResponse.json({ error: 'Sign in with the invited email address.' }, { status: 400 });
  }

  const { data: invite } = await inviteQuery.limit(1).maybeSingle();

  if (!invite) {
    return NextResponse.json({ error: 'Invitation not found or already used' }, { status: 404 });
  }

  if (new Date(invite.expires_at).getTime() < Date.now()) {
    await admin.from('organization_invitations').update({ status: 'expired' }).eq('id', invite.id);
    return NextResponse.json({ error: 'Invitation expired' }, { status: 410 });
  }

  if (userEmail !== invite.email.toLowerCase()) {
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

  if (invite.role === 'client' && invite.job_id) {
    const { data: org } = await admin.from('organizations').select('owner_user_id').eq('id', invite.organization_id).maybeSingle();
    await admin.from('job_client_access').upsert(
      {
        job_id: invite.job_id,
        client_user_id: user.id,
        owner_user_id: org?.owner_user_id,
        organization_id: invite.organization_id,
        granted_at: new Date().toISOString()
      },
      { onConflict: 'job_id,client_user_id' }
    );
  }

  return NextResponse.json({ ok: true, organizationId: invite.organization_id });
}
