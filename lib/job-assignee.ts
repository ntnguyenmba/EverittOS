import type { SupabaseClient } from '@supabase/supabase-js';
import { ensureWorkerForPerson } from '@/lib/people-assignment';

export async function resolveAssigneeWorkerId(
  supabase: SupabaseClient,
  organizationId: string,
  ownerUserId: string,
  assigneeUserId: string | null | undefined
): Promise<string | null> {
  const userId = assigneeUserId?.trim() || null;
  if (!userId) return null;

  const { data: profile } = await supabase
    .from('profiles')
    .select('email, full_name')
    .eq('id', userId)
    .maybeSingle();

  const label = profile?.full_name?.trim() || profile?.email?.trim() || 'Team member';
  return ensureWorkerForPerson(supabase, organizationId, userId, label, ownerUserId);
}
