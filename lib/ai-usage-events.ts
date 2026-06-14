import type { SupabaseClient } from '@supabase/supabase-js';
import { estimateOpenAiCost } from '@/lib/ai-server';
import type { EverittosPlan } from '@/lib/everittos-plans';
import { limitsForPlan } from '@/lib/everittos-limits';
import { isAdminRole, isStaffRole, normalizeRole, type UserRole } from '@/lib/roles';
import { isMissingSchemaError } from '@/lib/supabase-schema-errors';

export const STAFF_DAILY_AI_PROMPT_LIMIT = 2;
export const STAFF_WORKSPACE_MONTHLY_AI_BUDGET_USD = 10;
export const FREE_PLAN_SEARCH_DAILY_LIMIT = 100;

export type AiUsageEventInput = {
  workspaceId: string;
  userId: string;
  userRole: string;
  feature: string;
  mode: 'search' | 'ai';
  prompt?: string | null;
  inputTokens?: number;
  outputTokens?: number;
  estimatedCost?: number;
};

export type StaffAiGateResult =
  | { ok: true; isStaff: boolean; staffLimitsApplied: boolean }
  | { ok: false; code: 'staff_daily_limit' | 'staff_budget_exhausted'; message: string };

const STAFF_ROLES = new Set<UserRole>(['employee', 'contractor', 'viewer']);

function calendarDayStartIso(): string {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}

function calendarMonthStartIso(): string {
  const d = new Date();
  d.setDate(1);
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}

export function estimateAiCost(inputTokens: number, outputTokens: number, _model?: string): number {
  return estimateOpenAiCost(inputTokens, outputTokens);
}

/** Staff AI caps apply only to staff roles on non-unlimited workspace plans. */
export function shouldApplyStaffAiLimits(plan: EverittosPlan, roleInput: string): boolean {
  const limits = limitsForPlan(plan);
  if (!limits.aiAccess || limits.aiUnlimited) return false;

  const role = normalizeRole(roleInput);
  if (isAdminRole(role) || role === 'manager') return false;
  return isStaffRole(role);
}

export function isStaffAiRole(roleInput: string): boolean {
  return STAFF_ROLES.has(normalizeRole(roleInput));
}

export function aiModeUsageEvent(input: {
  workspaceId: string;
  userId: string;
  userRole: string;
  feature: string;
  prompt?: string | null;
  inputTokens?: number;
  outputTokens?: number;
  estimatedCost?: number;
}): AiUsageEventInput {
  return {
    workspaceId: input.workspaceId,
    userId: input.userId,
    userRole: input.userRole,
    feature: input.feature,
    mode: 'ai',
    prompt: input.prompt,
    inputTokens: input.inputTokens ?? 0,
    outputTokens: input.outputTokens ?? 0,
    estimatedCost: input.estimatedCost ?? 0
  };
}

export async function getDailyAiPromptCount(admin: SupabaseClient, userId: string): Promise<number> {
  const { count, error } = await admin
    .from('ai_usage_events')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('mode', 'ai')
    .gte('created_at', calendarDayStartIso());

  if (error) {
    if (isMissingSchemaError(error)) return 0;
    throw error;
  }
  return count || 0;
}

export async function getDailySearchCount(admin: SupabaseClient, userId: string): Promise<number> {
  const { count, error } = await admin
    .from('ai_usage_events')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('mode', 'search')
    .gte('created_at', calendarDayStartIso());

  if (error) {
    if (isMissingSchemaError(error)) return 0;
    throw error;
  }
  return count || 0;
}

/** Combined staff AI spend for one workspace in the current calendar month. */
export async function getMonthlyStaffAiSpend(admin: SupabaseClient, workspaceId: string): Promise<number> {
  const { data, error } = await admin
    .from('ai_usage_events')
    .select('estimated_cost, user_role')
    .eq('workspace_id', workspaceId)
    .eq('mode', 'ai')
    .gte('created_at', calendarMonthStartIso());

  if (error) {
    if (isMissingSchemaError(error)) return 0;
    throw error;
  }

  const total = (data || [])
    .filter((row) => isStaffAiRole(row.user_role))
    .reduce((sum, row) => sum + Number(row.estimated_cost || 0), 0);

  return Number(total.toFixed(6));
}

export async function recordAiUsage(admin: SupabaseClient, event: AiUsageEventInput): Promise<void> {
  const { error } = await admin.from('ai_usage_events').insert({
    workspace_id: event.workspaceId,
    user_id: event.userId,
    user_role: event.userRole,
    feature: event.feature,
    mode: event.mode,
    prompt: event.prompt?.slice(0, 4000) || null,
    input_tokens: event.inputTokens ?? 0,
    output_tokens: event.outputTokens ?? 0,
    estimated_cost: event.estimatedCost ?? 0
  });

  if (error && !isMissingSchemaError(error)) {
    console.warn('[ai-usage-events] record skipped', error.message);
  }
}

export async function canUseAiMode(
  admin: SupabaseClient,
  userId: string,
  workspaceId: string,
  roleInput: string,
  plan: EverittosPlan
): Promise<StaffAiGateResult> {
  if (!shouldApplyStaffAiLimits(plan, roleInput)) {
    return { ok: true, isStaff: isStaffRole(normalizeRole(roleInput)), staffLimitsApplied: false };
  }

  const [dailyCount, monthlySpend] = await Promise.all([
    getDailyAiPromptCount(admin, userId),
    getMonthlyStaffAiSpend(admin, workspaceId)
  ]);

  if (dailyCount >= STAFF_DAILY_AI_PROMPT_LIMIT) {
    return {
      ok: false,
      code: 'staff_daily_limit',
      message:
        "You've reached your 2 AI prompts for today. Ask Everitt search is still available."
    };
  }

  if (monthlySpend >= STAFF_WORKSPACE_MONTHLY_AI_BUDGET_USD) {
    return {
      ok: false,
      code: 'staff_budget_exhausted',
      message:
        'Your workspace staff AI allowance has been reached for this month. Ask Everitt search is still available, and AI access will reset next month.'
    };
  }

  return { ok: true, isStaff: true, staffLimitsApplied: true };
}

export type StaffAiUsageSummary = {
  staffPromptsToday: number;
  staffBudgetUsedUsd: number;
  staffBudgetCapUsd: number;
  staffLimitsApply: boolean;
  staffUsersThisMonth: { userId: string; role: UserRole; prompts: number; costUsd: number }[];
};

export type WorkspaceUserAiUsage = {
  userId: string;
  role: UserRole;
  aiPromptsThisMonth: number;
  searchQueriesToday: number;
  estimatedCostUsd: number;
};

export async function getWorkspaceUserAiUsage(
  admin: SupabaseClient,
  workspaceId: string,
  monthStart = calendarMonthStartIso(),
  dayStart = calendarDayStartIso()
): Promise<WorkspaceUserAiUsage[]> {
  const { data, error } = await admin
    .from('ai_usage_events')
    .select('user_id, user_role, mode, estimated_cost, created_at')
    .eq('workspace_id', workspaceId)
    .gte('created_at', monthStart);

  if (error) {
    if (isMissingSchemaError(error)) return [];
    throw error;
  }

  const byUser = new Map<string, WorkspaceUserAiUsage>();
  for (const row of data || []) {
    const userId = row.user_id as string;
    const existing = byUser.get(userId) || {
      userId,
      role: normalizeRole(row.user_role),
      aiPromptsThisMonth: 0,
      searchQueriesToday: 0,
      estimatedCostUsd: 0
    };

    if (row.mode === 'ai') {
      existing.aiPromptsThisMonth += 1;
      existing.estimatedCostUsd += Number(row.estimated_cost || 0);
    } else if (row.mode === 'search' && row.created_at >= dayStart) {
      existing.searchQueriesToday += 1;
    }

    byUser.set(userId, existing);
  }

  return Array.from(byUser.values()).map((entry) => ({
    ...entry,
    estimatedCostUsd: Number(entry.estimatedCostUsd.toFixed(4))
  }));
}

export async function getStaffAiUsageSummary(
  admin: SupabaseClient,
  workspaceId: string,
  plan: EverittosPlan
): Promise<StaffAiUsageSummary> {
  const monthStart = calendarMonthStartIso();
  const dayStart = calendarDayStartIso();
  const staffLimitsApply = limitsForPlan(plan).aiAccess && !limitsForPlan(plan).aiUnlimited;

  const { data: monthRows, error } = await admin
    .from('ai_usage_events')
    .select('user_id, user_role, estimated_cost, created_at')
    .eq('workspace_id', workspaceId)
    .eq('mode', 'ai')
    .gte('created_at', monthStart);

  if (error && !isMissingSchemaError(error)) {
    throw error;
  }

  const rows = (monthRows || []).filter((r) => isStaffAiRole(r.user_role));
  const staffPromptsToday = rows.filter((r) => r.created_at >= dayStart).length;
  const staffBudgetUsedUsd = Number(
    rows.reduce((s, r) => s + Number(r.estimated_cost || 0), 0).toFixed(4)
  );

  const byUser = new Map<string, { role: UserRole; prompts: number; costUsd: number }>();
  for (const row of rows) {
    const uid = row.user_id as string;
    const existing = byUser.get(uid) || {
      role: normalizeRole(row.user_role),
      prompts: 0,
      costUsd: 0
    };
    existing.prompts += 1;
    existing.costUsd += Number(row.estimated_cost || 0);
    byUser.set(uid, existing);
  }

  return {
    staffPromptsToday,
    staffBudgetUsedUsd,
    staffBudgetCapUsd: STAFF_WORKSPACE_MONTHLY_AI_BUDGET_USD,
    staffLimitsApply,
    staffUsersThisMonth: Array.from(byUser.entries()).map(([userId, stats]) => ({
      userId,
      role: stats.role,
      prompts: stats.prompts,
      costUsd: Number(stats.costUsd.toFixed(4))
    }))
  };
}
