import type { SupabaseClient } from '@supabase/supabase-js';
import { normalizeRole, type UserRole } from '@/lib/roles';

type MembershipRow = {
  organization_id: string;
  role: string | null;
};

export type MiddlewareWorkspaceContext = {
  organizationId: string | null;
  role: UserRole;
  source: 'selected_membership' | 'active_membership' | 'legacy_profile';
};

/**
 * Resolve middleware authorization from an active organization membership.
 * The profile fields are retained only as a compatibility fallback while old
 * accounts are repaired. A valid membership always wins over profiles.role.
 */
export async function resolveMiddlewareWorkspaceContext(
  supabase: SupabaseClient,
  userId: string,
  profileOrganizationId?: string | null,
  profileRole?: string | null
): Promise<MiddlewareWorkspaceContext> {
  if (profileOrganizationId) {
    const { data: selectedMembership } = await supabase
      .from('organization_members')
      .select('organization_id, role')
      .eq('user_id', userId)
      .eq('organization_id', profileOrganizationId)
      .eq('active', true)
      .maybeSingle();

    if (selectedMembership?.organization_id) {
      const membership = selectedMembership as MembershipRow;
      return {
        organizationId: membership.organization_id,
        role: normalizeRole(membership.role),
        source: 'selected_membership'
      };
    }
  }

  const { data: activeMembership } = await supabase
    .from('organization_members')
    .select('organization_id, role')
    .eq('user_id', userId)
    .eq('active', true)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle();

  if (activeMembership?.organization_id) {
    const membership = activeMembership as MembershipRow;
    return {
      organizationId: membership.organization_id,
      role: normalizeRole(membership.role),
      source: 'active_membership'
    };
  }

  return {
    organizationId: profileOrganizationId || null,
    role: normalizeRole(profileRole || 'employee'),
    source: 'legacy_profile'
  };
}
