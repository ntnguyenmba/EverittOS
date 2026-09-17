import { NextResponse } from 'next/server';
import { createServerSupabase } from '@/lib/supabase-server';
import { createAdminSupabase } from '@/lib/supabase-admin';
import { getCurrentWorkspaceForUser } from '@/lib/workspace-server';
import { sendTeamInviteEmail } from '@/lib/email';
import { canAssignAdminRole, canManageTeam } from '@/lib/roles';
import { parseAssignableMemberRole } from '@/lib/role-assignment';
import { fetchUsageCounts, canAddTeamMember } from '@/lib/everittos-usage';
import { normalizePlan } from '@/lib/everittos-plans';
import { appUrl } from '@/lib/app-url';
import { localeFromRequest } from '@/lib/i18n/server-request-locale';
import { getTeamInviteApiCopy } from '@/lib/i18n/team-invite-api-copy';

function normalizeInviteEmail(value?: string | null): string {
  return (value || '').trim().toLowerCase();
}

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

  const workspaceResult = await getCurrentWorkspaceForUser(supabase, user.id, {
    email: user.email || '',
    userMetadata: user.user_metadata || undefined,
    repair: true
  });
  if (!workspaceResult.ok) {
    return NextResponse.json({ error: c.serverUnavailable, code: workspaceResult.code }, { status: workspaceResult.status });
  }
  const org = workspaceResult.workspace;
  if (!canManageTeam(org.role)) {
    return NextResponse.json({ error: c.permissionDenied }, { status: 403 });
  }

  const body = (await request.json().catch(() => ({}))) as { email?: string; role?: string; note?: string };
  const email = normalizeInviteEmail(body.email);
  const role = parseAssignableMemberRole(body.role || 'employee');
  const note = (body.note || '').trim();
  if (!email) {
    return NextResponse.json({ error: c.emailRequired }, { status: 400 });
  }
  if (!role) {
    return NextResponse.json({ error: c.invalidRole }, { status: 400 });
  }
  if (role === 'admin' && !canAssignAdminRole(org.role)) {
    return NextResponse.json({ error: c.ownerOnlyAdmin }, { status: 403 });
  }

  const { data: ownerProfile } = await admin.from('profiles').select('plan').eq('id', org.ownerUserId).maybeSingle();
  const plan = normalizePlan(ownerProfile?.plan);
  const counts = await fetchUsageCounts(org.ownerUserId, org.organizationId);
  if (!canAddTeamMember(plan, counts.teamMembers)) {
    return NextResponse.json({ error: c.teamLimit }, { status: 403 });
  }

  const { error: revokeError } = await admin
    .from('organization_invitations')
    .update({ status: 'revoked' })
    .eq('organization_id', org.organizationId)
    .eq('email', email)
    .eq('status', 'pending');
  if (revokeError) {
    return NextResponse.json({ error: c.saveError }, { status: 500 });
  }

  const expiresAt = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString();
  const { data: invite, error } = await admin
    .from('organization_invitations')
    .insert({
      organization_id: org.organizationId,
      email,
      role,
      invited_by: user.id,
      status: 'pending',
      expires_at: expiresAt
    })
    .select('id, token, email, status, organization_id, created_at, expires_at')
    .single();

  if (error || !invite?.id || !invite?.token) {
    return NextResponse.json({ error: c.saveError }, { status: 400 });
  }

  const { data: savedInvite, error: verifyError } = await admin
    .from('organization_invitations')
    .select('id, token, email, status, organization_id, created_at, expires_at')
    .eq('id', invite.id)
    .maybeSingle();

  if (verifyError || !savedInvite || normalizeInviteEmail(savedInvite.email) !== email || savedInvite.status !== 'pending') {
    return NextResponse.json({ error: c.verifyError }, { status: 500 });
  }

  const acceptUrl = appUrl(`/team/accept?token=${savedInvite.token}`);
  const emailResult = await sendTeamInviteEmail({
    to: email,
    organizationName: org.organizationName,
    acceptUrl,
    role
  });

  const deliveryStatus = emailResult.sent ? 'email_sent' : 'manual_action_required';
  const userMessage = emailResult.sent ? c.sent(email) : c.manualSend(email);

  const { data: actorProfile } = await admin.from('profiles').select('full_name, email').eq('id', user.id).maybeSingle();
  const actorName = actorProfile?.full_name || actorProfile?.email || user.email || c.teamMember;
  await admin.from('activity_logs').insert({
    organization_id: org.organizationId,
    user_id: user.id,
    actor_name: actorName,
    entity_type: 'invitation',
    entity_id: savedInvite.id,
    action: 'user_invited',
    message: userMessage,
    metadata: {
      email,
      role,
      invitationStatus: savedInvite.status,
      emailSent: emailResult.sent,
      deliveryStatus,
      emailMessage: emailResult.message,
      acceptUrl,
      createdAt: savedInvite.created_at,
      expiresAt: savedInvite.expires_at,
      ...(note ? { note } : {})
    }
  });

  return NextResponse.json({
    ok: true,
    acceptUrl,
    invitationId: savedInvite.id,
    invitationEmail: savedInvite.email,
    invitationStatus: savedInvite.status,
    createdAt: savedInvite.created_at,
    expiresAt: savedInvite.expires_at,
    emailSent: emailResult.sent,
    deliveryStatus,
    requiresManualSend: !emailResult.sent,
    message: userMessage,
    emailProviderMessage: emailResult.message,
    nextAction: emailResult.sent ? c.waitForAcceptance : c.copyLink
  });
}
