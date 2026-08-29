import { NextResponse } from 'next/server';
import { AI_REQUIRED_PLAN, planHasAiAccess } from '@/lib/ai-features';
import { verifyAiRequest } from '@/lib/ai-gate';
import { getAiUsageStats } from '@/lib/ai-server';
import { aiConfigured, getActiveAiProviderInfo } from '@/lib/ai/config';
import {
  EVERITTTEAM_BUDGET_EXHAUSTED_MESSAGE,
  getEverittteamBudgetWarning,
  getEverittteamPoolUsage,
  isEverittteamAccount
} from '@/lib/everittteam-ai-budget';
import { fetchOrganizationContextForUser } from '@/lib/organization-server';
import { resolveOrganizationPlan } from '@/lib/organization-plan';
import { isClientRole, isOwner, isStaffRole, normalizeRole } from '@/lib/roles';
import {
  getDailyAiPromptCount,
  getMonthlyAiPromptCount,
  getStaffAiUsageSummary,
  shouldApplyStaffAiLimits,
  STAFF_DAILY_AI_PROMPT_LIMIT,
  STAFF_MONTHLY_AI_PROMPT_LIMIT
} from '@/lib/ai-usage-events';
import { createAdminSupabase } from '@/lib/supabase-admin';
import { createServerSupabase } from '@/lib/supabase-server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const supabase = await createServerSupabase();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const org = await fetchOrganizationContextForUser(supabase, user.id);
  const { plan } = await resolveOrganizationPlan(supabase, user.id);
  const providerInfo = getActiveAiProviderInfo();
  const configured = aiConfigured();
  const searchAvailable = Boolean(org && !isClientRole(org.role));
  const allowed = planHasAiAccess(plan);

  const admin = createAdminSupabase();
  let usage = null;
  let everittteam = null;
  let staffAi = null;
  let gateStatus: { ok: boolean; code?: string; message?: string } = { ok: allowed && configured };

  if (admin && org) {
    const role = normalizeRole(org.role);
    let everittteamApplies = false;
    try {
      everittteamApplies = await isEverittteamAccount(admin, user.id, org.ownerUserId);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const optionalPromoColumnMissing =
        message.includes('stripe_promotion_code') &&
        (message.includes('does not exist') || message.includes('42703'));
      if (!optionalPromoColumnMissing) {
        console.warn('[ai-status] optional EVERITTTEAM lookup failed', message);
      }
    }

    if (everittteamApplies) {
      const pool = await getEverittteamPoolUsage(admin);
      const ownerBypass = isOwner(role);
      const warning = getEverittteamBudgetWarning(pool, ownerBypass);
      const budgetExhausted = pool.usedUsd >= pool.budgetUsd;

      everittteam = {
        applies: true,
        budgetUsd: pool.budgetUsd,
        usedUsd: pool.usedUsd,
        remainingUsd: pool.remainingUsd,
        percentUsed: pool.percentUsed,
        periodStart: pool.periodStart,
        ownerBypass,
        budgetExhausted,
        warning
      };
    }

    if (allowed) {
      const gate = await verifyAiRequest(supabase, admin, user.id);
      gateStatus = gate.ok
        ? { ok: true }
        : { ok: false, code: gate.code, message: gate.message };
      if (gate.ok || gate.code === 'rate_limited') {
        usage = await getAiUsageStats(admin, org.organizationId, plan);
      }
    }

    const staffLimitsApply = shouldApplyStaffAiLimits(plan, role);
    if (isStaffRole(role)) {
      const summary = await getStaffAiUsageSummary(admin, org.organizationId, plan);
      const [dailyUsed, monthlyUsed] = staffLimitsApply
        ? await Promise.all([
            getDailyAiPromptCount(admin, user.id),
            getMonthlyAiPromptCount(admin, user.id)
          ])
        : [0, 0];
      staffAi = {
        applies: staffLimitsApply,
        dailyUsed,
        dailyCap: STAFF_DAILY_AI_PROMPT_LIMIT,
        monthlyUsed,
        monthlyCap: STAFF_MONTHLY_AI_PROMPT_LIMIT,
        workspaceStaffSpendUsd: summary.workspaceStaffSpendUsd,
        usersThisMonth: summary.staffUsersThisMonth
      };
    }
  }

  const everittteamLocked =
    everittteam?.applies &&
    everittteam.budgetExhausted &&
    !everittteam.ownerBypass;

  const aiModeAvailable = allowed && gateStatus.ok && !everittteamLocked;

  const lockedMessage = !allowed
    ? 'Everitt AI writing and analysis is available on Business and Enterprise plans. Ask Everitt search still works.'
    : everittteamLocked
      ? EVERITTTEAM_BUDGET_EXHAUSTED_MESSAGE
      : gateStatus.ok
        ? null
        : gateStatus.message || null;

  return NextResponse.json({
    searchAvailable,
    aiModeAvailable,
    allowed: aiModeAvailable,
    configured,
    provider: providerInfo.id,
    providerLabel: providerInfo.displayName,
    model: providerInfo.model,
    plan,
    requiredPlan: AI_REQUIRED_PLAN,
    locked: !aiModeAvailable && gateStatus.code === 'plan_required',
    aiLocked: !aiModeAvailable,
    lockedMessage,
    gate: gateStatus,
    everittteam,
    staffAi,
    usage
  });
}
