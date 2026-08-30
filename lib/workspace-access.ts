type SupabaseLike = {
  from(table: string): any;
};

export type WorkspaceDeletionState = {
  organizationId: string | null;
  blocked: boolean;
};

export async function resolveWorkspaceDeletionState(
  supabase: SupabaseLike,
  userId: string,
  profileOrganizationId: string | null | undefined
): Promise<WorkspaceDeletionState> {
  let organizationId = profileOrganizationId || null;

  if (!organizationId) {
    const { data: membership } = await supabase
      .from('organization_members')
      .select('organization_id')
      .eq('user_id', userId)
      .eq('active', true)
      .limit(1)
      .maybeSingle();
    organizationId = membership?.organization_id || null;
  }

  if (!organizationId) return { organizationId: null, blocked: false };

  const { data: org } = await supabase
    .from('organizations')
    .select('deleted_at, owner_user_id')
    .eq('id', organizationId)
    .maybeSingle();

  return {
    organizationId,
    blocked: Boolean(org?.deleted_at && org.owner_user_id !== userId)
  };
}
