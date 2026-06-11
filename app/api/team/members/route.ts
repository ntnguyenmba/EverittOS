import { NextResponse } from 'next/server';
import { createServerSupabase } from '@/lib/supabase-server';
import { createAdminSupabase } from '@/lib/supabase-admin';
import { fetchOrganizationContextForUser } from '@/lib/organization-server';
import { canManageTeam } from '@/lib/roles';
import { parseAssignableMemberRole } from '@/lib/role-assignment';

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

  const updates: Record<string, unknown> = {};
  if (body.role) {
    const role = parseAssignableMemberRole(body.role);
    if (!role) {
      return NextResponse.json({ error: 'Invalid role. Owner must use transfer ownership.' }, { status: 400 });
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

  const { data: actorProfile } = await admin.from('profiles').select('full_name, email').eq('id', user.id).maybeSingle();
  const actorName = actorProfile?.full_name || actorProfile?.email || user.email || 'Team member';
  const action = updates.role ? 'status_changed' : 'status_changed';
  await admin.from('activity_logs').insert({
    organization_id: org.organizationId,
    user_id: user.id,
    actor_name: actorName,
    entity_type: 'member',
    entity_id: targetUserId,
    action,
    message: updates.role
      ? `Changed member role to ${updates.role}`
      : updates.active === false
        ? 'Deactivated team member'
        : updates.active === true
          ? 'Reactivated team member'
          : 'Updated team member',
    metadata: updates
  });

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

  const { error } = await admin
    .from('organization_members')
    .delete()
    .eq('organization_id', org.organizationId)
    .eq('user_id', targetUserId)
    .neq('role', 'owner');

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  const { data: actorProfile } = await admin.from('profiles').select('full_name, email').eq('id', user.id).maybeSingle();
  const actorName = actorProfile?.full_name || actorProfile?.email || user.email || 'Team member';
  await admin.from('activity_logs').insert({
    organization_id: org.organizationId,
    user_id: user.id,
    actor_name: actorName,
    entity_type: 'member',
    entity_id: targetUserId,
    action: 'user_removed',
    message: 'Removed team member from organization',
    metadata: { userId: targetUserId }
  });

  return NextResponse.json({ ok: true });
}
