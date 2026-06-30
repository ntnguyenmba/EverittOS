import { NextResponse } from 'next/server';
import { createServerSupabase } from '@/lib/supabase-server';
import { createAdminSupabase } from '@/lib/supabase-admin';
import { getCurrentWorkspaceForUser, mapWorkspaceSaveError } from '@/lib/workspace-server';
import { sendTeamInviteEmail } from '@/lib/email';
import { canManageTeam } from '@/lib/roles';
import { parseAssignableMemberRole } from '@/lib/role-assignment';
import { fetchUsageCounts, canAddTeamMember } from '@/lib/everittos-usage';
import { normalizePlan } from '@/lib/everittos-plans';
import { appUrl } from '@/lib/app-url';

function normalizeInviteEmail(value?: string | null): string {
  return (value || '').trim().toLowerCase();
}

export async function POST(request: Request) {
  const supabase = await createServerSupabase();
  const admin = createAdminSupabase();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user || !admin) {
    return NextResponse.json({ error: 'Unauthorized or server not configured' }, { status: 401 });
  }

  const workspaceResult = await getCurrentWorkspaceForUser(supabase, user.id, {
    email: user.email || '',
    userMetadata: user.user_metadata || undefined,
    repair: true
  });
  if (!workspaceResult.ok) {
    return NextResponse.json({ error: workspaceResult.error, code: workspaceResult.code }, { status: workspaceResult.status });
  }
  const org = workspaceResult.workspace;
  if (!canManageTeam(org.role)) {
    return NextResponse.json({ error: 'Permission denied' }, { status: 403 });
  }

  const body = (await request.json()) as { email?: string; role?: string; note?: string };
  const email = normalizeInviteEmail(body.email);
  const role = parseAssignableMemberRole(body.role || 'employee');
  const note = (body.note || '').trim();
  if (!email) {
    return NextResponse.json({ error: 'Email is required' }, { status: 400 });
  }
  if (!role) {
    return NextResponse.json({ error: 'Invalid role for invitation' }, { status: 400 });
  }

  const { data: ownerProfile } = await admin.from('profiles').select('plan').eq('id', org.ownerUserId).maybeSingle();
  const plan = normalizePlan(ownerProfile?.plan);
  const counts = await fetchUsageCounts(org.ownerUserId, org.organizationId);
  if (!canAddTeamMember(plan, counts.teamMembers)) {
    return NextResponse.json({ error: 'Team member limit reached for this plan.' }, { status: 403 });
  }

  await admin
    .from('organization_invitations')
    .update({ status: 'revoked' })
    .eq('organization_id', org.organizationId)
    .eq('email', email)
    .eq('status', 'pending');

  const { data: invite, error } = await admin
    .from('organization_invitations')
    .insert({
      organization_id: org.organizationId,
      email,
      role,
      invited_by: user.id,
      status: 'pending',
      expires_at: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString()
    })
    .select('id, token, email, status, organization_id')
    .single();

  if (error || !invite?.id || !invite?.token) {
    return NextResponse.json(
      { error: `Invitation could not be saved: ${mapWorkspaceSaveError(error?.message || 'missing invitation record')}` },
      { status: 400 }
    );
  }

  const { data: savedInvite } = await admin
    .from('organization_invitations')
    .select('id, token, email, status, organization_id')
    .eq('id', invite.id)
    .maybeSingle();

  if (!savedInvite || normalizeInviteEmail(savedInvite.email) !== email || savedInvite.status !== 'pending') {
    return NextResponse.json(
      { error: 'Invitation was created but could not be verified. Please try sending it again.' },
      { status: 500 }
    );
  }

  const acceptUrl = appUrl(`/team/accept?token=${savedInvite.token}`);
  const emailResult = await sendTeamInviteEmail({
    to: email,
    organizationName: org.organizationName,
    acceptUrl,
    role
  });

  const { data: actorProfile } = await admin.from('profiles').select('full_name, email').eq('id', user.id).maybeSingle();
  const actorName = actorProfile?.full_name || actorProfile?.email || user.email || 'Team member';
  await admin.from('activity_logs').insert({
    organization_id: org.organizationId,
    user_id: user.id,
    actor_name: actorName,
    entity_type: 'invitation',
    entity_id: savedInvite.id,
    action: 'user_invited',
    message: `Invited ${email} as ${role}`,
    metadata: { email, role, invitationStatus: savedInvite.status, emailSent: emailResult.sent, emailMessage: emailResult.message, ...(note ? { note } : {}) }
  });

  return NextResponse.json({
    ok: true,
    acceptUrl,
    invitationId: savedInvite.id,
    invitationEmail: savedInvite.email,
    invitationStatus: savedInvite.status,
    emailSent: emailResult.sent,
    message: emailResult.message
  });
}
