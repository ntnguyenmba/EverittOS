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
import { isOwner, normalizeRole } from '@/lib/roles';
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
  const allowed = planHasAiAccess(plan);

  const admin = createAdminSupabase();
  let usage = null;
  let everittteam = null;
  let gateStatus: { ok: boolean; code?: string; message?: string } = { ok: allowed && configured };

  if (admin && org) {
    const role = normalizeRole(org.role);
    const everittteamApplies = await isEverittteamAccount(admin, user.id, org.ownerUserId);

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
  }

  const everittteamLocked =
    everittteam?.applies &&
    everittteam.budgetExhausted &&
    !everittteam.ownerBypass;

  const lockedMessage = !allowed
    ? 'Ask Everitt is available on Business and Enterprise plans.'
    : everittteamLocked
      ? EVERITTTEAM_BUDGET_EXHAUSTED_MESSAGE
      : gateStatus.ok
        ? null
        : gateStatus.message || null;

  return NextResponse.json({
    allowed: allowed && gateStatus.ok && !everittteamLocked,
    configured,
    provider: providerInfo.id,
    providerLabel: providerInfo.displayName,
    model: providerInfo.model,
    plan,
    requiredPlan: AI_REQUIRED_PLAN,
    locked: !allowed || everittteamLocked || (!gateStatus.ok && gateStatus.code === 'plan_required'),
    lockedMessage,
    gate: gateStatus,
    everittteam,
    usage
  });
}
