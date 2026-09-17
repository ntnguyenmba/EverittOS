import { NextResponse } from 'next/server';
import { createServerSupabase } from '@/lib/supabase-server';
import { createAdminSupabase } from '@/lib/supabase-admin';
import { fetchOrganizationContextForUser } from '@/lib/organization-server';
import { sendTeamInviteEmail } from '@/lib/email';
import { canManageTeam } from '@/lib/roles';
import { appUrl } from '@/lib/app-url';
import { localeFromRequest } from '@/lib/i18n/server-request-locale';
import { getTeamInviteApiCopy } from '@/lib/i18n/team-invite-api-copy';

export async function POST(request: Request) {
  const c = getTeamInviteApiCopy(localeFromRequest(request));
  const supabase = await createServerSupabase();
  const admin = createAdminSupabase();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: c.unauthorized }, { status: 401 });
  }
  if (!admin) {
    return NextResponse.json({ error: c.serverUnavailable }, { status: 503 });
  }

  const org = await fetchOrganizationContextForUser(supabase, user.id);
  if (!org || !canManageTeam(org.role)) {
    return NextResponse.json({ error: c.permissionDenied }, { status: 403 });
  }

  const body = (await request.json().catch(() => ({}))) as { invitationId?: string };
  if (!body.invitationId) {
    return NextResponse.json({ error: c.invitationIdRequired }, { status: 400 });
  }

  const { data: invite, error } = await admin
    .from('organization_invitations')
    .select('id, email, role, token, status, expires_at')
    .eq('id', body.invitationId)
    .eq('organization_id', org.organizationId)
    .eq('status', 'pending')
    .maybeSingle();

  if (error || !invite) {
    return NextResponse.json({ error: c.invitationNotFound }, { status: 404 });
  }

  const acceptUrl = appUrl(`/team/accept?token=${invite.token}`);
  const emailResult = await sendTeamInviteEmail({
    to: invite.email,
    organizationName: org.organizationName,
    acceptUrl,
    role: invite.role
  });

  const resentAt = new Date().toISOString();
  const { error: updateError } = await admin
    .from('organization_invitations')
    .update({ updated_at: resentAt })
    .eq('id', invite.id);
  if (updateError) {
    return NextResponse.json({ error: c.saveError }, { status: 500 });
  }

  const deliveryStatus = emailResult.sent ? 'email_sent' : 'manual_action_required';
  const message = emailResult.sent ? c.resent(invite.email) : c.stillActive(invite.email);

  return NextResponse.json({
    ok: true,
    acceptUrl,
    invitationId: invite.id,
    invitationEmail: invite.email,
    invitationStatus: invite.status,
    expiresAt: invite.expires_at,
    resentAt,
    emailSent: emailResult.sent,
    deliveryStatus,
    requiresManualSend: !emailResult.sent,
    message,
    emailProviderMessage: emailResult.message,
    nextAction: emailResult.sent ? c.waitForAcceptance : c.copyLink
  });
}
