import { NextResponse } from 'next/server';
import { normalizeOrgMemberships, type OrgMembershipRow } from '@/lib/org-memberships';
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
    .select('organization_id, role, organizations(id, name, owner_user_id, deleted_at)')
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

  const mapped: OrgMembershipRow[] = (rows || []).map((row) => {
    const org = Array.isArray(row.organizations) ? row.organizations[0] : row.organizations;
    const orgRow = org as { name?: string; owner_user_id?: string; deleted_at?: string | null } | null;
    return {
      organizationId: row.organization_id as string,
      organizationName: orgRow?.name || 'Workspace',
      role: row.role as string,
      isOwner: orgRow?.owner_user_id === user.id,
      deletedAt: orgRow?.deleted_at || null
    };
  });

  const activeOrganizationId = profile?.organization_id || mapped.find((row) => !row.deletedAt)?.organizationId || null;
  const memberships = normalizeOrgMemberships(mapped, activeOrganizationId);

  return NextResponse.json({
    activeOrganizationId: activeOrganizationId || memberships[0]?.organizationId || null,
    memberships
  });
}
