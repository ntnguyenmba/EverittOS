import { NextResponse } from 'next/server';
import { createServerSupabase } from '@/lib/supabase-server';
import { createAdminSupabase } from '@/lib/supabase-admin';
import { fetchOrganizationContextForUser } from '@/lib/organization-server';
import { sendTeamInviteEmail } from '@/lib/email';
import { canManageTeam, normalizeRole } from '@/lib/roles';
import { fetchUsageCounts, canAddTeamMember } from '@/lib/everittos-usage';
import { normalizePlan } from '@/lib/everittos-plans';
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

  const body = (await request.json()) as { email?: string; role?: string };
  const email = (body.email || '').trim().toLowerCase();
  const role = normalizeRole(body.role || 'employee');
  if (!email) {
    return NextResponse.json({ error: 'Email is required' }, { status: 400 });
  }
  if (!['admin', 'manager', 'employee', 'contractor', 'client', 'viewer'].includes(role)) {
    return NextResponse.json({ error: 'Invalid role for invitation' }, { status: 400 });
  }

  const { data: ownerProfile } = await admin.from('profiles').select('plan').eq('id', org.ownerUserId).maybeSingle();
  const plan = normalizePlan(ownerProfile?.plan);
  const counts = await fetchUsageCounts(org.ownerUserId, org.organizationId);
  if (!canAddTeamMember(plan, counts.teamMembers)) {
    return NextResponse.json({ error: 'Team member limit reached for this plan.' }, { status: 403 });
  }

  const { data: invite, error } = await admin
    .from('organization_invitations')
    .insert({
      organization_id: org.organizationId,
      email,
      role,
      invited_by: user.id,
      status: 'pending'
    })
    .select('id, token')
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  const acceptUrl = appUrl(`/team/accept?token=${invite.token}`);
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
    entity_id: invite.id,
    action: 'user_invited',
    message: `Invited ${email} as ${role}`,
    metadata: { email, role }
  });

  return NextResponse.json({
    ok: true,
    acceptUrl,
    invitationId: invite.id,
    emailSent: emailResult.sent,
    message: emailResult.sent ? 'Email sent.' : 'Email not configured. Copy this invite link.'
  });
}
