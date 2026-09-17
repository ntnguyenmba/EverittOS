import { NextResponse } from 'next/server';
import { createServerSupabase } from '@/lib/supabase-server';
import { createAdminSupabase } from '@/lib/supabase-admin';
import { fetchOrganizationContextForUser } from '@/lib/organization-server';
import { canAssignAdminRole, canManageTeam, canModifyTeamMember, normalizeRole } from '@/lib/roles';
import { parseAssignableMemberRole } from '@/lib/role-assignment';
import { getPeopleForAssignment } from '@/lib/people-assignment';
import { localeFromRequest } from '@/lib/i18n/server-request-locale';
import { getTeamMembersApiCopy } from '@/lib/i18n/team-members-api-copy';

function isCreateJobRequest(request: Request) {
  const referer = request.headers.get('referer');
  if (!referer) return false;
  try {
    const requestUrl = new URL(request.url);
    const refererUrl = new URL(referer);
    return refererUrl.origin === requestUrl.origin && (refererUrl.pathname === '/jobs/new' || refererUrl.pathname === '/jobs/create');
  } catch {
    return false;
  }
}

export async function GET(request: Request) {
  const c = getTeamMembersApiCopy(localeFromRequest(request));
  const supabase = await createServerSupabase();
  const admin = createAdminSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || !admin) return NextResponse.json({ error: c.unauthorized }, { status: 401 });

  const org = await fetchOrganizationContextForUser(supabase, user.id);
  if (!org) return NextResponse.json({ error: c.workspaceNotFound }, { status: 404 });

  const assignableOnly = new URL(request.url).searchParams.get('assignable') === '1' || isCreateJobRequest(request);
  if (assignableOnly) {
    const people = await getPeopleForAssignment(admin, org.organizationId);
    return NextResponse.json({ members: people.map((person) => ({ user_id: person.workerId || person.userId, role: person.role, active: true, profile: { full_name: person.name, email: null } })) });
  }

  const { data: memberRows, error } = await admin.from('organization_members').select('user_id, role, active, created_at').eq('organization_id', org.organizationId).eq('active', true).order('created_at');
  if (error) return NextResponse.json({ error: c.loadError }, { status: 400 });

  const rows = memberRows || [];
  const ids = rows.map((member) => member.user_id).filter(Boolean);
  const { data: profileRows } = ids.length ? await admin.from('profiles').select('id, email, full_name, updated_at').in('id', ids) : { data: [] };
  const profiles = new Map<string, { id: string; email: string | null; full_name: string | null; updated_at?: string | null }>();
  for (const profile of profileRows || []) profiles.set(profile.id, profile);

  return NextResponse.json({ members: rows.map((member) => ({ ...member, profile: profiles.get(member.user_id) || null })) });
}

export async function PATCH(request: Request) {
  const c = getTeamMembersApiCopy(localeFromRequest(request));
  const supabase = await createServerSupabase();
  const admin = createAdminSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || !admin) return NextResponse.json({ error: c.unauthorized }, { status: 401 });

  const org = await fetchOrganizationContextForUser(supabase, user.id);
  if (!org || !canManageTeam(org.role)) return NextResponse.json({ error: c.permissionDenied }, { status: 403 });

  const body = (await request.json().catch(() => ({}))) as { memberId?: string; userId?: string; role?: string; active?: boolean };
  const targetUserId = body.userId;
  if (!targetUserId) return NextResponse.json({ error: c.userIdRequired }, { status: 400 });

  const { data: targetMember } = await admin.from('organization_members').select('role').eq('organization_id', org.organizationId).eq('user_id', targetUserId).maybeSingle();
  if (!targetMember) return NextResponse.json({ error: c.memberNotFound }, { status: 404 });

  const targetRole = normalizeRole(targetMember.role as string);
  if (!canModifyTeamMember(org.role, targetRole)) return NextResponse.json({ error: c.permissionDenied }, { status: 403 });

  const updates: Record<string, unknown> = {};
  if (body.role) {
    const role = parseAssignableMemberRole(body.role);
    if (!role) return NextResponse.json({ error: c.invalidRole }, { status: 400 });
    if (role === 'admin' && !canAssignAdminRole(org.role)) return NextResponse.json({ error: c.ownerOnlyAdmin }, { status: 403 });
    updates.role = role;
  }
  if (typeof body.active === 'boolean') updates.active = body.active;

  const { error } = await admin.from('organization_members').update(updates).eq('organization_id', org.organizationId).eq('user_id', targetUserId).neq('role', 'owner');
  if (error) return NextResponse.json({ error: c.saveError }, { status: 400 });

  if (updates.role) {
    const { error: profileError } = await admin.from('profiles').update({ role: updates.role }).eq('id', targetUserId);
    if (profileError) return NextResponse.json({ error: c.saveError }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}

export async function DELETE(request: Request) {
  const c = getTeamMembersApiCopy(localeFromRequest(request));
  const supabase = await createServerSupabase();
  const admin = createAdminSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || !admin) return NextResponse.json({ error: c.unauthorized }, { status: 401 });

  const org = await fetchOrganizationContextForUser(supabase, user.id);
  if (!org || !canManageTeam(org.role)) return NextResponse.json({ error: c.permissionDenied }, { status: 403 });

  const targetUserId = new URL(request.url).searchParams.get('userId');
  if (!targetUserId) return NextResponse.json({ error: c.userIdRequired }, { status: 400 });

  const { data: targetMember } = await admin.from('organization_members').select('role').eq('organization_id', org.organizationId).eq('user_id', targetUserId).maybeSingle();
  if (!targetMember) return NextResponse.json({ error: c.memberNotFound }, { status: 404 });
  if (!canModifyTeamMember(org.role, normalizeRole(targetMember.role as string))) return NextResponse.json({ error: c.permissionDenied }, { status: 403 });

  const { error } = await admin.from('organization_members').delete().eq('organization_id', org.organizationId).eq('user_id', targetUserId).neq('role', 'owner');
  if (error) return NextResponse.json({ error: c.removeError }, { status: 400 });

  return NextResponse.json({ ok: true });
}
