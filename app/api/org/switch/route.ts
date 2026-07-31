import { NextResponse } from 'next/server';
import { logActivityServer } from '@/lib/activity-server';
import { dashboardPathForRole } from '@/lib/dashboard-nav';
import { ACTIVE_ORG_COOKIE } from '@/lib/org-context-cookie';
import { fetchOrganizationContextForUser } from '@/lib/organization-server';
import { normalizeRole, roleToDb } from '@/lib/roles';
import { createAdminSupabase } from '@/lib/supabase-admin';
import { createServerSupabase } from '@/lib/supabase-server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  const supabase = await createServerSupabase();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = (await request.json()) as { organizationId?: string };
  const organizationId = body.organizationId?.trim();
  if (!organizationId) {
    return NextResponse.json({ error: 'organizationId is required' }, { status: 400 });
  }

  const { data: membership, error: membershipError } = await supabase
    .from('organization_members')
    .select('role')
    .eq('user_id', user.id)
    .eq('organization_id', organizationId)
    .eq('active', true)
    .maybeSingle();

  if (membershipError) {
    return NextResponse.json({ error: membershipError.message }, { status: 500 });
  }
  if (!membership) {
    return NextResponse.json({ error: 'You are not a member of this organization' }, { status: 403 });
  }

  const role = normalizeRole(membership.role);
  const admin = createAdminSupabase();
  if (!admin) {
    return NextResponse.json({ error: 'Server not configured' }, { status: 503 });
  }

  const prior = await fetchOrganizationContextForUser(supabase, user.id);
  const { error } = await admin
    .from('profiles')
    .update({ organization_id: organizationId, role: roleToDb(role) })
    .eq('id', user.id);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  await logActivityServer({
    organizationId,
    userId: user.id,
    entityType: 'organization',
    entityId: organizationId,
    action: 'org_switched',
    message: `Switched company to ${organizationId}`,
    metadata: { from: prior?.organizationId || null, role }
  });

  const destination = dashboardPathForRole(role);
  const response = NextResponse.json({ ok: true, organizationId, role, destination });
  response.cookies.set(ACTIVE_ORG_COOKIE, organizationId, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 365
  });
  return response;
}
