import type { SupabaseClient } from '@supabase/supabase-js';

export async function fetchOrganizationIsDemo(
  supabase: SupabaseClient,
  organizationId: string | null | undefined
): Promise<boolean> {
  if (!organizationId) return false;
  const { data } = await supabase.from('organizations').select('is_demo').eq('id', organizationId).maybeSingle();
  return Boolean(data?.is_demo);
}
