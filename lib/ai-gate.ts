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
import type { Locale } from '@/lib/i18n/config';
import { DEFAULT_LOCALE } from '@/lib/i18n/config';
import { getAiApiCopy } from '@/lib/i18n/ai-api-copy';

export type AiGateFailureCode = 'unauthorized' | 'no_organization' | 'permission_denied' | 'plan_required' | 'subscription_inactive' | 'not_configured' | 'rate_limited' | 'everittteam_budget_exhausted' | 'budget_verification_failed' | 'staff_daily_limit' | 'staff_monthly_limit';

export type AiGateResult = { ok: true; org: OrganizationContext; plan: EverittosPlan; ownerUserId: string; monthlyUsed: number; monthlyCap: number; unlimited: boolean } | { ok: false; code: AiGateFailureCode; message: string; requiredPlan?: EverittosPlan };

function localizedGateMessage(locale: Locale, code: AiGateFailureCode, fallback: string) {
  const c = getAiApiCopy(locale);
  if (code === 'no_organization') return c.noWorkspace;
  if (code === 'plan_required') return c.planLocked;
  if (code === 'subscription_inactive') return c.subscriptionInactive;
  if (code === 'rate_limited') return c.rateLimited;
  if (code === 'staff_daily_limit') return c.staffDailyLimit;
  if (code === 'staff_monthly_limit') return c.staffMonthlyLimit;
  if (code === 'everittteam_budget_exhausted') return c.budgetLocked;
  if (code === 'budget_verification_failed') return c.budgetVerificationFailed;
  return fallback;
}

export async function verifyAiRequest(supabase: SupabaseClient, admin: SupabaseClient, userId: string, options?: { feature?: AiFeatureId; requireManage?: boolean; locale?: Locale }): Promise<AiGateResult> {
  const locale = options?.locale || DEFAULT_LOCALE;
  const c = getAiApiCopy(locale);
  const org = await fetchOrganizationContextForUser(supabase, userId);
  if (!org) return { ok: false, code: 'no_organization', message: c.noWorkspace };

  const { plan, ownerUserId } = await resolveOrganizationPlan(supabase, userId);
  if (!canAccessFeature(plan, 'aiAccess') || !isAiFeatureAvailable(options?.feature || 'ask_everitt', plan)) return { ok: false, code: 'plan_required', message: c.planLocked, requiredPlan: AI_REQUIRED_PLAN };

  const staffGate = await canUseAiMode(admin, userId, org.organizationId, org.role, plan);
  if (!staffGate.ok) return { ok: false, code: staffGate.code, message: localizedGateMessage(locale, staffGate.code, staffGate.message) };

  const resolvedOwnerUserId = ownerUserId || org.ownerUserId || userId;
  const { profile: ownerProfile } = await fetchProfileByUserId(supabase, resolvedOwnerUserId);
  const subscriptionStatus = await resolveProfileSubscriptionStatus(supabase, resolvedOwnerUserId, ownerProfile);
  const sub = subscriptionAccess(plan, subscriptionStatus);
  if (!sub.ok && sub.billingRequired) return { ok: false, code: 'subscription_inactive', message: c.subscriptionInactive };

  if (!aiConfigured()) {
    const provider = getActiveAiProvider();
    return { ok: false, code: 'not_configured', message: c.notConfigured(provider.displayName) };
  }

  const gate = await assertAiAllowed(admin, plan, org.organizationId);
  if (!gate.ok) return { ok: false, code: gate.code, message: localizedGateMessage(locale, gate.code, gate.message), requiredPlan: gate.code === 'plan_required' ? AI_REQUIRED_PLAN : undefined };

  const isWorkspaceOwner = userId === resolvedOwnerUserId;
  const hasPaidPlanAccess = sub.ok && plan !== 'free';
  if (!isWorkspaceOwner && !hasPaidPlanAccess) {
    const everittteamBudget = await assertEverittteamBudgetAllowed(admin, userId, resolvedOwnerUserId, org.role);
    if (!everittteamBudget.ok) return { ok: false, code: everittteamBudget.code, message: localizedGateMessage(locale, everittteamBudget.code, everittteamBudget.message) };
  }

  const cap = aiMonthlyCap(plan);
  const used = await countAiGenerationsThisMonth(admin, org.organizationId, 'billable');
  return { ok: true, org, plan, ownerUserId: resolvedOwnerUserId, monthlyUsed: used, monthlyCap: cap, unlimited: cap < 0 };
}
