import type { SupabaseClient } from '@supabase/supabase-js';
import { normalizePlan, type EverittosPlan } from '@/lib/everittos-plans';
import { fetchOrganizationContextForUser } from '@/lib/organization-server';

/** Billing limits follow the organization owner's subscription plan. */
export async function resolveOrganizationPlan(
  supabase: SupabaseClient,
  userId: string
): Promise<{ plan: EverittosPlan; organizationId: string | null; ownerUserId: string | null }> {
  const org = await fetchOrganizationContextForUser(supabase, userId);
  if (!org) {
    const { data: profile } = await supabase.from('profiles').select('plan').eq('id', userId).maybeSingle();
    return {
      plan: normalizePlan(profile?.plan),
      organizationId: null,
      ownerUserId: userId
    };
  }

  const { data: ownerProfile } = await supabase
    .from('profiles')
    .select('plan, subscription_status')
    .eq('id', org.ownerUserId)
    .maybeSingle();

  return {
    plan: normalizePlan(ownerProfile?.plan),
    organizationId: org.organizationId,
    ownerUserId: org.ownerUserId
  };
}
