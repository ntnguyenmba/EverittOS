import { NextResponse } from 'next/server';
import { dashboardPathForRole } from '@/lib/dashboard-nav';
import { ACTIVE_ORG_COOKIE } from '@/lib/org-context-cookie';
import type { OrgMembership } from '@/lib/os-types';
import { normalizeRole } from '@/lib/roles';
import { createServerSupabase } from '@/lib/supabase-server';
import { publicErrorMessage } from '@/lib/safe-api-error';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const supabase = await createServerSupabase();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { data: rows, error } = await supabase
    .from('organization_members')
    .select('organization_id, role, organizations(id, name, owner_user_id)')
    .eq('user_id', user.id)
    .eq('active', true)
    .order('created_at', { ascending: true });

  if (error) {
    return NextResponse.json({ error: publicErrorMessage(error) }, { status: 500 });
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('organization_id')
    .eq('id', user.id)
    .maybeSingle();

  const memberships: OrgMembership[] = (rows || []).map((row) => {
    const org = Array.isArray(row.organizations) ? row.organizations[0] : row.organizations;
    const isOwner = (org as { owner_user_id?: string } | null)?.owner_user_id === user.id;
    return {
      organizationId: row.organization_id as string,
      organizationName: (org as { name?: string } | null)?.name || 'Workspace',
      role: isOwner ? 'owner' : (row.role as string),
      isOwner
    };
  });

  const cookieHeader = request.headers.get('cookie') || '';
  const activeCookie = cookieHeader
    .split(';')
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${ACTIVE_ORG_COOKIE}=`));
  const cookieOrganizationId = activeCookie ? decodeURIComponent(activeCookie.slice(ACTIVE_ORG_COOKIE.length + 1)) : null;
  const cookieMembership = memberships.find((membership) => membership.organizationId === cookieOrganizationId) || null;
  const profileMembership = memberships.find((membership) => membership.organizationId === profile?.organization_id) || null;
  const activeMembership = cookieMembership || profileMembership || memberships[0] || null;
  const activeOrganizationId = activeMembership?.organizationId || null;
  const activeRole = activeMembership ? normalizeRole(activeMembership.role) : null;

  return NextResponse.json({
    activeOrganizationId,
    activeRole,
    destination: activeRole ? dashboardPathForRole(activeRole) : '/dashboard',
    memberships
  }, { headers: { 'Cache-Control': 'no-store' } });
}
