import type { SupabaseClient } from '@supabase/supabase-js';
import { normalizeRole, type UserRole } from '@/lib/roles';

export type OrganizationContext = {
  organizationId: string;
  organizationName: string;
  role: UserRole;
  ownerUserId: string;
};

export async function fetchOrganizationContextForUser(
  supabase: SupabaseClient,
  userId: string
): Promise<OrganizationContext | null> {
  const { data: profile } = await supabase
    .from('profiles')
    .select('organization_id, role')
    .eq('id', userId)
    .maybeSingle();

  let orgId = profile?.organization_id;

  if (!orgId) {
    const { data: membership } = await supabase
      .from('organization_members')
      .select('organization_id, role')
      .eq('user_id', userId)
      .eq('active', true)
      .limit(1)
      .maybeSingle();
    orgId = membership?.organization_id;
  }

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

  if (!org) return null;

  return {
    organizationId: org.id,
    organizationName: org.name,
    role: normalizeRole(member?.role || profile?.role),
    ownerUserId: org.owner_user_id
  };
}
