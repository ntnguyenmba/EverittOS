import type { SupabaseClient } from '@supabase/supabase-js';
import { isOwner, type UserRole } from '@/lib/roles';

export const EVERITTTEAM_PROMO_CODE = 'EVERITTTEAM';

export const EVERITTTEAM_BUDGET_EXHAUSTED_MESSAGE =
  'EVERITTTEAM AI budget has been reached for this month.';

export const EVERITTTEAM_BUDGET_WARNING_MESSAGE =
  'EVERITTTEAM AI budget is nearing its monthly limit.';

export const EVERITTTEAM_BUDGET_PAUSED_MESSAGE =
  'EVERITTTEAM AI access has been paused until the next monthly reset.';

const BUDGET_VERIFICATION_FAILED_MESSAGE =
  'AI usage could not be verified. Please try again later or contact support.';

export type EverittteamBudgetFailureCode = 'everittteam_budget_exhausted' | 'budget_verification_failed';

export type EverittteamUserUsage = {
  userId: string;
  name: string;
  email: string | null;
  prompts: number;
  estimatedCostUsd: number;
};

export type EverittteamPoolUsage = {
  applies: boolean;
  budgetUsd: number;
  usedUsd: number;
  remainingUsd: number;
  percentUsed: number;
  periodStart: string;
  manualResetAt: string | null;
  byUser: EverittteamUserUsage[];
  verificationFailed: boolean;
};

function monthStartIso(): string {
  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);
  return monthStart.toISOString();
}

export function getEverittteamMonthlyBudgetUsd(): number {
  const raw = (process.env.AI_EVERITTTEAM_MONTHLY_BUDGET_USD || '10').trim();
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed < 0) return 10;
  return parsed;
}

export function isEverittteamPromoCode(code: string | null | undefined): boolean {
  return (code || '').trim().toUpperCase() === EVERITTTEAM_PROMO_CODE;
}

async function fetchProfilePromoCode(
  admin: SupabaseClient,
  userId: string
): Promise<string | null | undefined> {
  const { data, error } = await admin
    .from('profiles')
    .select('stripe_promotion_code')
    .eq('id', userId)
    .maybeSingle();

  if (error) throw error;
  return data?.stripe_promotion_code;
}

export async function isEverittteamAccount(
  admin: SupabaseClient,
  userId: string,
  ownerUserId: string
): Promise<boolean> {
  const [userPromo, ownerPromo] = await Promise.all([
    fetchProfilePromoCode(admin, userId),
    ownerUserId && ownerUserId !== userId
      ? fetchProfilePromoCode(admin, ownerUserId)
      : Promise.resolve(null)
  ]);

  return isEverittteamPromoCode(userPromo) || isEverittteamPromoCode(ownerPromo);
}

async function getManualResetAt(admin: SupabaseClient): Promise<string | null> {
  const { data, error } = await admin
    .from('everittteam_ai_pool')
    .select('manual_reset_at')
    .eq('id', 1)
    .maybeSingle();

  if (error) {
    if (error.code === '42P01') return null;
    throw error;
  }

  return data?.manual_reset_at || null;
}

function resolvePeriodStart(manualResetAt: string | null): string {
  const monthStart = monthStartIso();
  if (!manualResetAt) return monthStart;
  return new Date(manualResetAt).getTime() > new Date(monthStart).getTime() ? manualResetAt : monthStart;
}

async function listEverittteamUserIds(admin: SupabaseClient): Promise<string[]> {
  const { data, error } = await admin
    .from('profiles')
    .select('id')
    .ilike('stripe_promotion_code', EVERITTTEAM_PROMO_CODE);

  if (error) throw error;
  return (data || []).map((row) => row.id);
}

async function listEverittteamOrganizationIds(admin: SupabaseClient): Promise<string[]> {
  const everittteamUserIds = await listEverittteamUserIds(admin);
  if (everittteamUserIds.length === 0) return [];

  const { data, error } = await admin
    .from('organizations')
    .select('id')
    .in('owner_user_id', everittteamUserIds);

  if (error) throw error;
  return (data || []).map((row) => row.id);
}

type GenerationRow = {
  id: string;
  user_id: string;
  organization_id: string;
  estimated_cost_usd: number | null;
};

async function fetchEverittteamGenerations(
  admin: SupabaseClient,
  periodStart: string,
  everittteamUserIds: string[],
  everittteamOrgIds: string[]
): Promise<GenerationRow[]> {
  if (everittteamUserIds.length === 0 && everittteamOrgIds.length === 0) return [];

  const merged = new Map<string, GenerationRow>();

  if (everittteamUserIds.length > 0) {
    const { data, error } = await admin
      .from('ai_generations')
      .select('id, user_id, organization_id, estimated_cost_usd')
      .gte('created_at', periodStart)
      .in('user_id', everittteamUserIds);

    if (error) throw error;
    for (const row of data || []) {
      merged.set(row.id, row);
    }
  }

  if (everittteamOrgIds.length > 0) {
    const { data, error } = await admin
      .from('ai_generations')
      .select('id, user_id, organization_id, estimated_cost_usd')
      .gte('created_at', periodStart)
      .in('organization_id', everittteamOrgIds);

    if (error) throw error;
    for (const row of data || []) {
      merged.set(row.id, row);
    }
  }

  return Array.from(merged.values());
}

function buildByUser(
  generations: GenerationRow[],
  profiles: Map<string, { full_name: string | null; email: string | null }>
): EverittteamUserUsage[] {
  const byUser = new Map<string, { prompts: number; cost: number }>();

  for (const row of generations) {
    const current = byUser.get(row.user_id) || { prompts: 0, cost: 0 };
    current.prompts += 1;
    current.cost += Number(row.estimated_cost_usd || 0);
    byUser.set(row.user_id, current);
  }

  return Array.from(byUser.entries())
    .map(([userId, stats]) => {
      const profile = profiles.get(userId);
      return {
        userId,
        name: profile?.full_name?.trim() || profile?.email || 'Team member',
        email: profile?.email || null,
        prompts: stats.prompts,
        estimatedCostUsd: Number(stats.cost.toFixed(4))
      };
    })
    .sort((a, b) => b.estimatedCostUsd - a.estimatedCostUsd);
}

export async function getEverittteamPoolUsage(admin: SupabaseClient): Promise<EverittteamPoolUsage> {
  const budgetUsd = getEverittteamMonthlyBudgetUsd();

  try {
    const manualResetAt = await getManualResetAt(admin);
    const periodStart = resolvePeriodStart(manualResetAt);
    const everittteamUserIds = await listEverittteamUserIds(admin);
    const everittteamOrgIds = await listEverittteamOrganizationIds(admin);

    if (everittteamUserIds.length === 0 && everittteamOrgIds.length === 0) {
      return {
        applies: false,
        budgetUsd,
        usedUsd: 0,
        remainingUsd: budgetUsd,
        percentUsed: 0,
        periodStart,
        manualResetAt,
        byUser: [],
        verificationFailed: false
      };
    }

    const generations = await fetchEverittteamGenerations(
      admin,
      periodStart,
      everittteamUserIds,
      everittteamOrgIds
    );

    const userIds = Array.from(new Set(generations.map((row) => row.user_id)));
    const profiles = new Map<string, { full_name: string | null; email: string | null }>();

    if (userIds.length > 0) {
      const { data: profileRows, error: profileError } = await admin
        .from('profiles')
        .select('id, full_name, email')
        .in('id', userIds);

      if (profileError) throw profileError;

      for (const row of profileRows || []) {
        profiles.set(row.id, { full_name: row.full_name, email: row.email });
      }
    }

    const usedUsd = Number(
      generations.reduce((sum, row) => sum + Number(row.estimated_cost_usd || 0), 0).toFixed(4)
    );
    const remainingUsd = Number(Math.max(0, budgetUsd - usedUsd).toFixed(4));
    const percentUsed = budgetUsd > 0 ? Number(((usedUsd / budgetUsd) * 100).toFixed(1)) : 0;

    return {
      applies: true,
      budgetUsd,
      usedUsd,
      remainingUsd,
      percentUsed,
      periodStart,
      manualResetAt,
      byUser: buildByUser(generations, profiles),
      verificationFailed: false
    };
  } catch {
    return {
      applies: true,
      budgetUsd,
      usedUsd: 0,
      remainingUsd: 0,
      percentUsed: 0,
      periodStart: monthStartIso(),
      manualResetAt: null,
      byUser: [],
      verificationFailed: true
    };
  }
}

export function getEverittteamBudgetWarning(
  usage: Pick<EverittteamPoolUsage, 'applies' | 'budgetUsd' | 'usedUsd' | 'percentUsed'>,
  viewerIsOwner: boolean
): string | null {
  if (!usage.applies || !viewerIsOwner) return null;
  if (usage.usedUsd >= usage.budgetUsd) return EVERITTTEAM_BUDGET_PAUSED_MESSAGE;
  if (usage.percentUsed >= 80) return EVERITTTEAM_BUDGET_WARNING_MESSAGE;
  return null;
}

export async function assertEverittteamBudgetAllowed(
  admin: SupabaseClient,
  userId: string,
  ownerUserId: string,
  userRole: UserRole
): Promise<{ ok: true } | { ok: false; code: EverittteamBudgetFailureCode; message: string }> {
  try {
    const subject = await isEverittteamAccount(admin, userId, ownerUserId);
    if (!subject) return { ok: true };

    if (isOwner(userRole)) return { ok: true };

    const usage = await getEverittteamPoolUsage(admin);
    if (usage.verificationFailed) {
      return {
        ok: false,
        code: 'budget_verification_failed',
        message: BUDGET_VERIFICATION_FAILED_MESSAGE
      };
    }

    if (usage.usedUsd >= usage.budgetUsd) {
      return {
        ok: false,
        code: 'everittteam_budget_exhausted',
        message: EVERITTTEAM_BUDGET_EXHAUSTED_MESSAGE
      };
    }

    return { ok: true };
  } catch {
    return {
      ok: false,
      code: 'budget_verification_failed',
      message: BUDGET_VERIFICATION_FAILED_MESSAGE
    };
  }
}

export async function resetEverittteamBudget(admin: SupabaseClient): Promise<void> {
  const now = new Date().toISOString();
  const { error } = await admin.from('everittteam_ai_pool').upsert({
    id: 1,
    manual_reset_at: now,
    updated_at: now
  });

  if (error) throw error;
}
