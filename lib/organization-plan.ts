import type { SupabaseClient } from '@supabase/supabase-js';
import { normalizePlan, type EverittosPlan } from '@/lib/everittos-plans';
import { fetchOrganizationContextForUser } from '@/lib/organization-server';
import { fetchProfileByUserId, resolveProfilePlan } from '@/lib/profile-query';

/** Billing limits follow the organization owner's subscription plan. */
export async function resolveOrganizationPlan(
  supabase: SupabaseClient,
  userId: string
): Promise<{ plan: EverittosPlan; organizationId: string | null; ownerUserId: string | null }> {
  const org = await fetchOrganizationContextForUser(supabase, userId);
  if (!org) {
    const { profile } = await fetchProfileByUserId(supabase, userId);
    return {
      plan: await resolveProfilePlan(supabase, userId, profile),
      organizationId: null,
      ownerUserId: userId
    };
  }

  const { profile: ownerProfile } = await fetchProfileByUserId(supabase, org.ownerUserId);

  return {
    plan: await resolveProfilePlan(supabase, org.ownerUserId, ownerProfile),
    organizationId: org.organizationId,
    ownerUserId: org.ownerUserId
  };
}
