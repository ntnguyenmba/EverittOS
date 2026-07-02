import type { SupabaseClient } from '@supabase/supabase-js';
import { createAdminSupabase } from '@/lib/supabase-admin';

export type TeamRow = {
  id: string;
  organization_id: string;
  name: string;
  description: string | null;
  color: string | null;
  active: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

export async function assertActiveOrgMember(
  admin: SupabaseClient,
  organizationId: string,
  userId: string
): Promise<boolean> {
  const { data } = await admin
    .from('organization_members')
    .select('user_id')
    .eq('organization_id', organizationId)
    .eq('user_id', userId)
    .eq('active', true)
    .maybeSingle();
  return Boolean(data);
}

export async function assertTeamInOrg(
  admin: SupabaseClient,
  organizationId: string,
  teamId: string
): Promise<TeamRow | null> {
  const { data } = await admin
    .from('teams')
    .select('*')
    .eq('id', teamId)
    .eq('organization_id', organizationId)
    .maybeSingle();
  return (data as TeamRow | null) ?? null;
}

export async function listTeamMemberUserIds(
  admin: SupabaseClient,
  teamId: string
): Promise<string[]> {
  const { data } = await admin.from('team_members').select('user_id').eq('team_id', teamId);
  return (data || []).map((row) => row.user_id as string);
}

export function teamAdminClient() {
  return createAdminSupabase();
}
