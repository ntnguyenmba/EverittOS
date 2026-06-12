import type { SupabaseClient } from '@supabase/supabase-js';
import { parseActiveOrgCookie } from '@/lib/org-context-cookie';

export async function verifyOrgMembership(
  supabase: SupabaseClient,
  userId: string,
  organizationId: string
): Promise<boolean> {
  const { data } = await supabase
    .from('organization_members')
    .select('id')
    .eq('user_id', userId)
    .eq('organization_id', organizationId)
    .eq('active', true)
    .maybeSingle();
  return Boolean(data);
}

export async function resolveActiveOrganizationId(
  supabase: SupabaseClient,
  userId: string,
  cookieValue?: string | null
): Promise<string | null> {
  const preferred = parseActiveOrgCookie(cookieValue);

  if (preferred && (await verifyOrgMembership(supabase, userId, preferred))) {
    return preferred;
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('organization_id')
    .eq('id', userId)
    .maybeSingle();

  if (profile?.organization_id && (await verifyOrgMembership(supabase, userId, profile.organization_id))) {
    return profile.organization_id;
  }

  const { data: memberships } = await supabase
    .from('organization_members')
    .select('organization_id, organizations(name)')
    .eq('user_id', userId)
    .eq('active', true)
    .order('created_at', { ascending: true });

  if (!memberships?.length) return null;
  return memberships[0].organization_id;
}
