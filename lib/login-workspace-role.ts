import type { SupabaseClient } from '@supabase/supabase-js';
import { normalizeRole, type UserRole } from '@/lib/roles';

type MembershipRoleRow = {
  organization_id?: string | null;
  role?: string | null;
};

/**
 * Resolve the role used for post-login routing from organization membership.
 * profiles.role is accepted only as a final compatibility fallback when the
 * membership table cannot be read, so stale profile roles cannot override a
 * valid active-company membership.
 */
export async function resolveLoginWorkspaceRole(
  supabase: SupabaseClient,
  userId: string,
  organizationId?: string | null,
  legacyProfileRole?: string | null
): Promise<UserRole> {
  let query = supabase
    .from('organization_members')
    .select('organization_id, role')
    .eq('user_id', userId)
    .eq('active', true);

  if (organizationId) {
    query = query.eq('organization_id', organizationId);
  }

  const { data: preferredMembership, error: preferredError } = await query
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle();

  if (!preferredError && preferredMembership?.role) {
    return normalizeRole((preferredMembership as MembershipRoleRow).role);
  }

  // If the selected organization was stale, still prefer another active
  // membership over profiles.role.
  if (organizationId) {
    const { data: fallbackMembership, error: fallbackError } = await supabase
      .from('organization_members')
      .select('organization_id, role')
      .eq('user_id', userId)
      .eq('active', true)
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle();

    if (!fallbackError && fallbackMembership?.role) {
      return normalizeRole((fallbackMembership as MembershipRoleRow).role);
    }
  }

  return normalizeRole(legacyProfileRole || 'employee');
}
