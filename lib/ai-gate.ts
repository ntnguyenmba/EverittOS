import type { SupabaseClient } from '@supabase/supabase-js';
import { aiConfigured, getActiveAiProvider } from '@/lib/ai/config';
import { aiMonthlyCap, assertAiAllowed, countAiGenerationsThisMonth } from '@/lib/ai-server';
import type { AiFeatureId } from '@/lib/ai-features';
import { isAiFeatureAvailable, AI_REQUIRED_PLAN } from '@/lib/ai-features';
import { canAccessFeature } from '@/lib/plan-access';
import type { EverittosPlan } from '@/lib/everittos-plans';
import { fetchOrganizationContextForUser, type OrganizationContext } from '@/lib/organization-server';
import { resolveOrganizationPlan } from '@/lib/organization-plan';
import { fetchProfileByUserId, resolveProfileSubscriptionStatus } from '@/lib/profile-query';
import { subscriptionAccess } from '@/lib/subscription-access';
import { assertEverittteamBudgetAllowed } from '@/lib/everittteam-ai-budget';
import { canUseAiMode } from '@/lib/ai-usage-events';

export type AiGateFailureCode =
  | 'unauthorized'
  | 'no_organization'
  | 'permission_denied'
  | 'plan_required'
  | 'subscription_inactive'
  | 'not_configured'
  | 'rate_limited'
  | 'everittteam_budget_exhausted'
  | 'budget_verification_failed'
  | 'staff_daily_limit'
  | 'staff_budget_exhausted';

export type AiGateResult =
  | {
      ok: true;
      org: OrganizationContext;
      plan: EverittosPlan;
      ownerUserId: string;
      monthlyUsed: number;
      monthlyCap: number;
      unlimited: boolean;
    }
  | { ok: false; code: AiGateFailureCode; message: string; requiredPlan?: EverittosPlan };

/**
 * Server-side gate for every AI request.
 * Verifies auth context, organization, Stripe subscription, plan, and usage limits.
 */
export async function verifyAiRequest(
  supabase: SupabaseClient,
  admin: SupabaseClient,
  userId: string,
  options?: { feature?: AiFeatureId; requireManage?: boolean }
): Promise<AiGateResult> {
  const org = await fetchOrganizationContextForUser(supabase, userId);
  if (!org) {
    return { ok: false, code: 'no_organization', message: 'No active workspace found.' };
  }

  const { plan, ownerUserId } = await resolveOrganizationPlan(supabase, userId);

  if (!canAccessFeature(plan, 'aiAccess') || !isAiFeatureAvailable(options?.feature || 'ask_everitt', plan)) {
    return {
      ok: false,
      code: 'plan_required',
      message: 'Everitt AI writing and analysis is available on Business and Enterprise plans.',
      requiredPlan: AI_REQUIRED_PLAN
    };
  }

  const staffGate = await canUseAiMode(admin, userId, org.organizationId, org.role, plan);
  if (!staffGate.ok) {
    return {
      ok: false,
      code: staffGate.code,
      message: staffGate.message
    };
  }

  const { profile: ownerProfile } = await fetchProfileByUserId(supabase, ownerUserId || userId);
  const subscriptionStatus = await resolveProfileSubscriptionStatus(
    supabase,
    ownerUserId || userId,
    ownerProfile
  );
  const sub = subscriptionAccess(plan, subscriptionStatus);
  if (!sub.ok && sub.billingRequired) {
    return {
      ok: false,
      code: 'subscription_inactive',
      message: 'Update your subscription billing to use AI features.'
    };
  }

  if (!aiConfigured()) {
    const provider = getActiveAiProvider();
    return {
      ok: false,
      code: 'not_configured',
      message: `${provider.displayName} is not configured on this server.`
    };
  }

  const gate = await assertAiAllowed(admin, plan, org.organizationId);
  if (!gate.ok) {
    return {
      ok: false,
      code: gate.code,
      message: gate.message,
      requiredPlan: gate.code === 'plan_required' ? AI_REQUIRED_PLAN : undefined
    };
  }

  const everittteamBudget = await assertEverittteamBudgetAllowed(
    admin,
    userId,
    org.ownerUserId,
    org.role
  );
  if (!everittteamBudget.ok) {
    return {
      ok: false,
      code: everittteamBudget.code,
      message: everittteamBudget.message
    };
  }

  const cap = aiMonthlyCap(plan);
  const used = await countAiGenerationsThisMonth(admin, org.organizationId, 'billable');

  return {
    ok: true,
    org,
    plan,
    ownerUserId: ownerUserId || userId,
    monthlyUsed: used,
    monthlyCap: cap,
    unlimited: cap < 0
  };
}
