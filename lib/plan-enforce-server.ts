import type { SupabaseClient } from '@supabase/supabase-js';
import { resolveEffectiveOrganizationPlan } from '@/lib/effective-plan-server';
import { fetchUsageCounts } from '@/lib/everittos-usage';
import { validatePlanAction, type PlanResource, type PlanValidateResult } from '@/lib/plan-validate';

export async function enforcePlanForUser(
  supabase: SupabaseClient,
  userId: string,
  resource: PlanResource
): Promise<PlanValidateResult & { plan: string; organizationId: string | null }> {
  const { plan, organizationId } = await resolveEffectiveOrganizationPlan(supabase, userId);
  const counts = await fetchUsageCounts(userId, organizationId);
  const countMap = {
    jobs: counts.jobs,
    photos: counts.photos,
    customers: counts.customers,
    reports: counts.reports,
    workers: counts.workers,
    teamMembers: counts.teamMembers,
    locations: counts.locations
  };
  const result = validatePlanAction({ plan, resource, currentCount: countMap[resource] });
  return { ...result, plan, organizationId };
}
