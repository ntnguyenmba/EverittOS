import { NextResponse } from 'next/server';
import { createServerSupabase } from '@/lib/supabase-server';
import { createAdminSupabase } from '@/lib/supabase-admin';
import { fetchOrganizationContextForUser } from '@/lib/organization-server';
import { canAssignAdminRole, canManageTeam, canModifyTeamMember, normalizeRole } from '@/lib/roles';
import { parseAssignableMemberRole } from '@/lib/role-assignment';
import { getPeopleForAssignment } from '@/lib/people-assignment';

export async function GET() {
  const supabase = await createServerSupabase();
  const admin = createAdminSupabase();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user || !admin) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const org = await fetchOrganizationContextForUser(supabase, user.id);
  if (!org) {
    return NextResponse.json({ error: 'Workspace not found.' }, { status: 404 });
  }

  const people = await getPeopleForAssignment(admin, org.organizationId);
  return NextResponse.json({
    members: people.map((person) => ({
      user_id: person.workerId || person.userId,
      role: person.role,
      active: true,
      profile: { full_name: person.name, email: null }
    }))
  });
}

export async function PATCH(request: Request) {
  const supabase = await createServerSupabase();
  const admin = createAdminSupabase();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user || !admin) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const org = await fetchOrganizationContextForUser(supabase, user.id);
  if (!org || !canManageTeam(org.role)) {
    return NextResponse.json({ error: 'Permission denied' }, { status: 403 });
  }

  const body = (await request.json()) as {
    memberId?: string;
    userId?: string;
    role?: string;
    active?: boolean;
  };

  const targetUserId = body.userId;
  if (!targetUserId) {
    return NextResponse.json({ error: 'userId is required' }, { status: 400 });
  }

  const { data: targetMember } = await admin
    .from('organization_members')
    .select('role')
    .eq('organization_id', org.organizationId)
    .eq('user_id', targetUserId)
    .maybeSingle();

  if (!targetMember) {
    return NextResponse.json({ error: 'Member not found.' }, { status: 404 });
  }

  const targetRole = normalizeRole(targetMember.role as string);
  if (!canModifyTeamMember(org.role, targetRole)) {
    return NextResponse.json({ error: 'Permission denied.' }, { status: 403 });
  }

  const updates: Record<string, unknown> = {};
  if (body.role) {
    const role = parseAssignableMemberRole(body.role);
    if (!role) {
      return NextResponse.json({ error: 'Invalid role. Owner must use transfer ownership.' }, { status: 400 });
    }
    if (role === 'admin' && !canAssignAdminRole(org.role)) {
      return NextResponse.json({ error: 'Only the owner can assign admin role.' }, { status: 403 });
    }
    updates.role = role;
  }
  if (typeof body.active === 'boolean') updates.active = body.active;

  const { error } = await admin
    .from('organization_members')
    .update(updates)
    .eq('organization_id', org.organizationId)
    .eq('user_id', targetUserId)
    .neq('role', 'owner');

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  if (updates.role) {
    await admin.from('profiles').update({ role: updates.role }).eq('id', targetUserId);
  }

  return NextResponse.json({ ok: true });
}

export async function DELETE(request: Request) {
  const supabase = await createServerSupabase();
  const admin = createAdminSupabase();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user || !admin) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const org = await fetchOrganizationContextForUser(supabase, user.id);
  if (!org || !canManageTeam(org.role)) {
    return NextResponse.json({ error: 'Permission denied' }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const targetUserId = searchParams.get('userId');
  if (!targetUserId) {
    return NextResponse.json({ error: 'userId is required' }, { status: 400 });
  }

  const { data: targetMember } = await admin
    .from('organization_members')
    .select('role')
    .eq('organization_id', org.organizationId)
    .eq('user_id', targetUserId)
    .maybeSingle();

  if (!targetMember) {
    return NextResponse.json({ error: 'Member not found.' }, { status: 404 });
  }

  if (!canModifyTeamMember(org.role, normalizeRole(targetMember.role as string))) {
    return NextResponse.json({ error: 'Permission denied.' }, { status: 403 });
  }

  const { error } = await admin
    .from('organization_members')
    .delete()
    .eq('organization_id', org.organizationId)
    .eq('user_id', targetUserId)
    .neq('role', 'owner');

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}
