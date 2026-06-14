import type { SupabaseClient } from '@supabase/supabase-js';
import type { EverittosPlan } from '@/lib/everittos-plans';
import { isClientRole, normalizeRole } from '@/lib/roles';
import {
  FREE_PLAN_SEARCH_DAILY_LIMIT,
  getDailySearchCount,
  type AiUsageEventInput
} from '@/lib/ai-usage-events';

export type AskEverittSearchAccessResult =
  | { ok: true }
  | { ok: false; code: 'no_organization' | 'client_forbidden' | 'search_daily_limit'; message: string };

export async function assertAskEverittSearchAccess(
  admin: SupabaseClient,
  userId: string,
  roleInput: string | null | undefined,
  organizationId: string | null,
  plan: EverittosPlan
): Promise<AskEverittSearchAccessResult> {
  if (!organizationId) {
    return { ok: false, code: 'no_organization', message: 'No active workspace found.' };
  }

  const role = normalizeRole(roleInput);
  if (isClientRole(role)) {
    return { ok: false, code: 'client_forbidden', message: 'Client accounts cannot use Ask Everitt.' };
  }

  if (plan === 'free') {
    const used = await getDailySearchCount(admin, userId);
    if (used >= FREE_PLAN_SEARCH_DAILY_LIMIT) {
      return {
        ok: false,
        code: 'search_daily_limit',
        message: `Daily Ask Everitt search limit reached (${FREE_PLAN_SEARCH_DAILY_LIMIT}). Upgrade for higher limits.`
      };
    }
  }

  return { ok: true };
}

export function searchUsageEvent(input: {
  workspaceId: string;
  userId: string;
  userRole: string;
  prompt: string;
}): AiUsageEventInput {
  return {
    workspaceId: input.workspaceId,
    userId: input.userId,
    userRole: input.userRole,
    feature: 'ask_everitt_search',
    mode: 'search',
    prompt: input.prompt,
    inputTokens: 0,
    outputTokens: 0,
    estimatedCost: 0
  };
}
