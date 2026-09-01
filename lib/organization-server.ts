import type { SupabaseClient } from '@supabase/supabase-js';
import { resolveActiveOrganizationId } from '@/lib/organization-active';
import { normalizeRole, type UserRole } from '@/lib/roles';

export type OrganizationContext = {
  organizationId: string;
  organizationName: string;
  role: UserRole;
  ownerUserId: string;
};

export async function fetchOrganizationContextForUser(
  supabase: SupabaseClient,
  userId: string,
  preferredOrgId?: string | null
): Promise<OrganizationContext | null> {
  const { data: profile } = await supabase
    .from('profiles')
    .select('organization_id')
    .eq('id', userId)
    .maybeSingle();

  const orgId = await resolveActiveOrganizationId(
    supabase,
    userId,
    preferredOrgId ?? profile?.organization_id ?? null
  );

  if (!orgId) return null;

  const [{ data: org }, { data: member }] = await Promise.all([
    supabase.from('organizations').select('id, name, owner_user_id').eq('id', orgId).maybeSingle(),
    supabase
      .from('organization_members')
      .select('role')
      .eq('organization_id', orgId)
      .eq('user_id', userId)
      .eq('active', true)
      .maybeSingle()
  ]);

  if (!org || !member) return null;

  const role: UserRole = org.owner_user_id === userId ? 'owner' : normalizeRole(member.role);

  return {
    organizationId: org.id,
    organizationName: org.name,
    role,
    ownerUserId: org.owner_user_id
  };
}

/** Resolve the user's role from their active organization membership. */
export async function resolveWorkspaceRoleForUser(
  supabase: SupabaseClient,
  userId: string,
  _profileRole?: string | null
): Promise<UserRole> {
  const org = await fetchOrganizationContextForUser(supabase, userId);
  return org?.role ?? 'employee';
}
