import { NextResponse } from 'next/server';
import { createServerSupabase } from '@/lib/supabase-server';
import { createAdminSupabase } from '@/lib/supabase-admin';

function normalizeEmail(value?: string | null): string {
  return (value || '').trim().toLowerCase();
}

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
  const userEmail = normalizeEmail(profile?.email || user.email);

  if (!token && !userEmail) {
    return NextResponse.json({ error: 'Sign in with the invited email address.' }, { status: 400 });
  }

  let invite = null as Record<string, any> | null;

  if (token) {
    const { data } = await admin.from('organization_invitations').select('*').eq('token', token).maybeSingle();
    invite = data;
  }

  if (!invite && userEmail) {
    const { data } = await admin
      .from('organization_invitations')
      .select('*')
      .eq('email', userEmail)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    invite = data;
  }

  if (!invite) {
    return NextResponse.json(
      { error: `No invitation found for ${userEmail || 'this signed-in account'}. Ask the owner to send a new invitation to this exact email.` },
      { status: 404 }
    );
  }

  const inviteEmail = normalizeEmail(invite.email);
  if (userEmail !== inviteEmail) {
    return NextResponse.json(
      { error: `This invitation was sent to ${invite.email}, but you are signed in as ${userEmail}. Sign in with the invited email.` },
      { status: 403 }
    );
  }

  if (invite.status === 'accepted') {
    await admin.from('profiles').update({ organization_id: invite.organization_id, role: invite.role }).eq('id', user.id);
    await admin.from('organization_members').upsert(
      { organization_id: invite.organization_id, user_id: user.id, role: invite.role, active: true },
      { onConflict: 'organization_id,user_id' }
    );
    return NextResponse.json({ ok: true, organizationId: invite.organization_id, message: 'Invitation was already accepted. Access restored.' });
  }

  if (invite.status !== 'pending') {
    return NextResponse.json({ error: `Invitation is ${invite.status}. Ask the owner to send a new invitation.` }, { status: 409 });
  }

  if (invite.expires_at && new Date(invite.expires_at).getTime() < Date.now()) {
    await admin.from('organization_invitations').update({ status: 'expired' }).eq('id', invite.id);
    return NextResponse.json({ error: 'Invitation expired. Ask the owner to send a new invitation.' }, { status: 410 });
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
