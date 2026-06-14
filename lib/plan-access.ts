import type { SupabaseClient } from '@supabase/supabase-js';
import { limitsForPlan, PLAN_LIMITS, type PlanLimits } from '@/lib/everittos-limits';
import { normalizePlan, type EverittosPlan } from '@/lib/everittos-plans';
import { resolveOrganizationPlan } from '@/lib/organization-plan';

export type PlanFeature =
  | 'photoUpload'
  | 'teamManagement'
  | 'crewAssignment'
  | 'scheduling'
  | 'activityLog'
  | 'advancedReporting'
  | 'workflowCustomization'
  | 'multiLocation'
  | 'customBranding'
  | 'pdfReports'
  | 'clientPortal'
  | 'contractorPortal'
  | 'brandedReports'
  | 'beforeAfterPhotos'
  | 'aiAccess'
  | 'aiUnlimited'
  | 'apiAccess'
  | 'prioritySupport'
  | 'bookings';

export const BOOKINGS_REQUIRED_PLAN: EverittosPlan = 'pro';

export const PLAN_ORDER: Record<EverittosPlan, number> = {
  free: 0,
  pro: 1,
  business: 2,
  operations: 3,
  growth: 4,
  enterprise: 5
};

export const planLimits = PLAN_LIMITS;

export function planRank(plan: EverittosPlan): number {
  return PLAN_ORDER[normalizePlan(plan)] ?? 0;
}

export function meetsMinimumPlan(userPlan: EverittosPlan, requiredPlan: EverittosPlan): boolean {
  return planRank(userPlan) >= planRank(requiredPlan);
}

export function canAccessFeature(plan: EverittosPlan, feature: PlanFeature): boolean {
  const limits = limitsForPlan(normalizePlan(plan));
  const value = limits[feature as keyof typeof limits];
  return typeof value === 'boolean' ? value : Boolean(value);
}

export function canUseBookings(plan: EverittosPlan): boolean {
  return canAccessFeature(plan, 'bookings');
}

export function bookingsPlanGate(plan: EverittosPlan): RequirePlanResult {
  const normalized = normalizePlan(plan);
  if (canUseBookings(normalized)) {
    return { ok: true, plan: normalized };
  }
  return {
    ok: false,
    plan: normalized,
    requiredPlan: BOOKINGS_REQUIRED_PLAN,
    message: 'Bookings requires EverittOS Pro ($9/month) or higher.'
  };
}

export function bookingsPlanDeniedPayload(plan: EverittosPlan) {
  const gate = bookingsPlanGate(plan);
  return {
    error: gate.ok ? 'Bookings requires EverittOS Pro ($9/month) or higher.' : gate.message,
    code: 'plan_required' as const,
    locked: true,
    requiredPlan: BOOKINGS_REQUIRED_PLAN,
    plan: normalizePlan(plan)
  };
}

export function limitsForUserPlan(plan: EverittosPlan): PlanLimits {
  return limitsForPlan(normalizePlan(plan));
}

export async function getUserPlan(
  supabase: SupabaseClient,
  userId: string
): Promise<{ plan: EverittosPlan; organizationId: string | null }> {
  const resolved = await resolveOrganizationPlan(supabase, userId);
  return { plan: resolved.plan, organizationId: resolved.organizationId };
}

export type RequirePlanResult =
  | { ok: true; plan: EverittosPlan }
  | { ok: false; plan: EverittosPlan; requiredPlan: EverittosPlan; message: string };

export function requirePlan(userPlan: EverittosPlan, requiredPlan: EverittosPlan): RequirePlanResult {
  const plan = normalizePlan(userPlan);
  const required = normalizePlan(requiredPlan);

  if (meetsMinimumPlan(plan, required)) {
    return { ok: true, plan };
  }

  return {
    ok: false,
    plan,
    requiredPlan: required,
    message: `${required} or higher is required for this feature.`
  };
}

/** Route prefixes that require a minimum plan tier. */
export const ROUTE_MIN_PLAN: { prefix: string; plan: EverittosPlan }[] = [
  { prefix: '/workers', plan: 'business' },
  { prefix: '/team', plan: 'business' },
  { prefix: '/settings/team', plan: 'business' },
  { prefix: '/activity', plan: 'business' },
  { prefix: '/expenses', plan: 'pro' },
  { prefix: '/analytics', plan: 'pro' },
  { prefix: '/workflows', plan: 'operations' },
  { prefix: '/portal/client', plan: 'operations' },
  { prefix: '/portal/contractor', plan: 'operations' },
  { prefix: '/settings/api', plan: 'growth' },
  { prefix: '/settings/ai-memory', plan: 'business' },
  { prefix: '/knowledge', plan: 'pro' },
  { prefix: '/proposals', plan: 'pro' },
  { prefix: '/bookings', plan: 'pro' },
  { prefix: '/automations', plan: 'business' },
  { prefix: '/admin', plan: 'enterprise' }
];

export function minimumPlanForPath(pathname: string): EverittosPlan | null {
  for (const route of ROUTE_MIN_PLAN) {
    if (pathname === route.prefix || pathname.startsWith(`${route.prefix}/`)) {
      return route.plan;
    }
  }
  return null;
}
