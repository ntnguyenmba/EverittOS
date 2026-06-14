import type { SupabaseClient } from '@supabase/supabase-js';
import { bookingsPlanDeniedPayload, canUseBookings } from '@/lib/plan-access';
import { resolveOrganizationPlan } from '@/lib/organization-plan';
import type { EverittosPlan } from '@/lib/everittos-plans';

export async function requireBookingsPlan(supabase: SupabaseClient, userId: string) {
  const { plan } = await resolveOrganizationPlan(supabase, userId);
  if (!canUseBookings(plan)) {
    return { ok: false as const, plan, payload: bookingsPlanDeniedPayload(plan) };
  }
  return { ok: true as const, plan: plan as EverittosPlan };
}
