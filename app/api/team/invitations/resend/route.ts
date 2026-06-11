import { NextResponse } from 'next/server';
import { createServerSupabase } from '@/lib/supabase-server';
import { createAdminSupabase } from '@/lib/supabase-admin';
import { fetchOrganizationContextForUser } from '@/lib/organization-server';
import { sendTeamInviteEmail } from '@/lib/email';
import { canManageTeam } from '@/lib/roles';
import { appUrl } from '@/lib/app-url';

export async function POST(request: Request) {
  const supabase = await createServerSupabase();
  const admin = createAdminSupabase();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user || !admin) {
    return NextResponse.json({ error: 'Unauthorized or server not configured' }, { status: 401 });
  }

  const org = await fetchOrganizationContextForUser(supabase, user.id);
  if (!org || !canManageTeam(org.role)) {
    return NextResponse.json({ error: 'Permission denied' }, { status: 403 });
  }

  const body = (await request.json()) as { invitationId?: string };
  if (!body.invitationId) {
    return NextResponse.json({ error: 'invitationId is required' }, { status: 400 });
  }

  const { data: invite, error } = await admin
    .from('organization_invitations')
    .select('id, email, role, token, status')
    .eq('id', body.invitationId)
    .eq('organization_id', org.organizationId)
    .eq('status', 'pending')
    .maybeSingle();

  if (error || !invite) {
    return NextResponse.json({ error: 'Invitation not found or already used' }, { status: 404 });
  }

  const acceptUrl = appUrl(`/team/accept?token=${invite.token}`);
  const emailResult = await sendTeamInviteEmail({
    to: invite.email,
    organizationName: org.organizationName,
    acceptUrl,
    role: invite.role
  });

  await admin
    .from('organization_invitations')
    .update({ updated_at: new Date().toISOString() })
    .eq('id', invite.id);

  return NextResponse.json({
    ok: true,
    acceptUrl,
    emailSent: emailResult.sent,
    message: emailResult.sent ? 'Invitation resent by email.' : 'Email not configured. Copy the accept link.'
  });
}
