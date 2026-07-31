import { NextResponse } from 'next/server';
import { dashboardPathForRole } from '@/lib/dashboard-nav';
import type { OrgMembership } from '@/lib/os-types';
import { normalizeRole } from '@/lib/roles';
import { createServerSupabase } from '@/lib/supabase-server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
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
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('organization_id')
    .eq('id', user.id)
    .maybeSingle();

  const memberships: OrgMembership[] = (rows || []).map((row) => {
    const org = Array.isArray(row.organizations) ? row.organizations[0] : row.organizations;
    return {
      organizationId: row.organization_id as string,
      organizationName: (org as { name?: string } | null)?.name || 'Workspace',
      role: row.role as string,
      isOwner: (org as { owner_user_id?: string } | null)?.owner_user_id === user.id
    };
  });

  const activeOrganizationId = profile?.organization_id || memberships[0]?.organizationId || null;
  const activeMembership = memberships.find((membership) => membership.organizationId === activeOrganizationId) || null;
  const activeRole = activeMembership ? normalizeRole(activeMembership.role) : null;

  return NextResponse.json({
    activeOrganizationId,
    activeRole,
    destination: activeRole ? dashboardPathForRole(activeRole) : '/dashboard',
    memberships
  });
}
