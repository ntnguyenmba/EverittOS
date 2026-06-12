import type { SupabaseClient } from '@supabase/supabase-js';
import { openAiApiKey, openAiConfigured, openAiModel } from '@/lib/ai-config';
import type { AiFeatureId } from '@/lib/ai-features';
import { canAccessFeature } from '@/lib/plan-access';
import type { EverittosPlan } from '@/lib/everittos-plans';
import { limitsForPlan } from '@/lib/everittos-limits';

export type AiChatMessage = {
  role: 'system' | 'user' | 'assistant';
  content: string;
};

export type AiUsageStats = {
  requests: number;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  estimatedCostUsd: number;
  monthlyCap: number;
  monthlyUsed: number;
  remaining: number | null;
  unlimited: boolean;
  periodStart: string;
};

export type AiChatResult =
  | {
      ok: true;
      reply: string;
      model: string;
      usage: { promptTokens: number; completionTokens: number; totalTokens: number; estimatedCostUsd: number };
    }
  | { ok: false; code: 'not_configured' | 'plan_required' | 'rate_limited' | 'upstream_error'; message: string };

const MONTHLY_AI_CAP: Record<EverittosPlan, number> = {
  free: 0,
  pro: 0,
  business: 200,
  operations: 0,
  growth: 0,
  enterprise: -1
};

/** Rough gpt-4o-mini pricing per token (USD). */
const COST_PER_INPUT_TOKEN = 0.15 / 1_000_000;
const COST_PER_OUTPUT_TOKEN = 0.6 / 1_000_000;

export function estimateOpenAiCost(promptTokens: number, completionTokens: number): number {
  return Number((promptTokens * COST_PER_INPUT_TOKEN + completionTokens * COST_PER_OUTPUT_TOKEN).toFixed(6));
}

export function aiMonthlyCap(plan: EverittosPlan): number {
  const limits = limitsForPlan(plan);
  if (!limits.aiAccess) return 0;
  if (limits.aiUnlimited) return -1;
  return MONTHLY_AI_CAP[plan] ?? 0;
}

function monthStartIso(): string {
  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);
  return monthStart.toISOString();
}

export async function countAiGenerationsThisMonth(
  admin: SupabaseClient,
  organizationId: string
): Promise<number> {
  const { count } = await admin
    .from('ai_generations')
    .select('id', { count: 'exact', head: true })
    .eq('organization_id', organizationId)
    .gte('created_at', monthStartIso());

  return count || 0;
}

export async function getAiUsageStats(
  admin: SupabaseClient,
  organizationId: string,
  plan: EverittosPlan
): Promise<AiUsageStats> {
  const periodStart = monthStartIso();
  const cap = aiMonthlyCap(plan);

  const { data: rows } = await admin
    .from('ai_generations')
    .select('prompt_tokens, completion_tokens, total_tokens, estimated_cost_usd')
    .eq('organization_id', organizationId)
    .gte('created_at', periodStart);

  const generations = rows || [];
  const promptTokens = generations.reduce((s, r) => s + (r.prompt_tokens || 0), 0);
  const completionTokens = generations.reduce((s, r) => s + (r.completion_tokens || 0), 0);
  const totalTokens = generations.reduce((s, r) => s + (r.total_tokens || 0), 0);
  const estimatedCostUsd = generations.reduce((s, r) => s + Number(r.estimated_cost_usd || 0), 0);
  const monthlyUsed = generations.length;

  return {
    requests: monthlyUsed,
    promptTokens,
    completionTokens,
    totalTokens,
    estimatedCostUsd: Number(estimatedCostUsd.toFixed(4)),
    monthlyCap: cap,
    monthlyUsed,
    remaining: cap < 0 ? null : Math.max(0, cap - monthlyUsed),
    unlimited: cap < 0,
    periodStart
  };
}

export async function assertAiAllowed(
  admin: SupabaseClient,
  plan: EverittosPlan,
  organizationId: string
): Promise<{ ok: true } | { ok: false; message: string; code: 'plan_required' | 'rate_limited' | 'not_configured' }> {
  if (!canAccessFeature(plan, 'aiAccess')) {
    return {
      ok: false,
      code: 'plan_required',
      message: 'Ask Everitt is available on Business and Enterprise plans.'
    };
  }

  if (!openAiConfigured()) {
    return {
      ok: false,
      code: 'not_configured',
      message: 'AI is not configured on this server. Contact your administrator.'
    };
  }

  const cap = aiMonthlyCap(plan);
  if (cap >= 0) {
    const used = await countAiGenerationsThisMonth(admin, organizationId);
    if (used >= cap) {
      return {
        ok: false,
        code: 'rate_limited',
        message: 'Monthly AI usage limit reached. Upgrade to Enterprise for unlimited AI.'
      };
    }
  }

  return { ok: true };
}

export async function runAiChat(
  messages: AiChatMessage[],
  context?: string,
  options?: { feature?: AiFeatureId }
): Promise<AiChatResult> {
  const apiKey = openAiApiKey();
  if (!apiKey) {
    return { ok: false, code: 'not_configured', message: 'OPENAI_API_KEY is not configured.' };
  }

  const featureHint = options?.feature ? `Feature: ${options.feature}.` : '';
  const systemContext = [
    'You are Everitt, the AI command center inside EverittOS — a business operating system for service companies.',
    'Answer using the organization data provided. Be concise, professional, and action-oriented.',
    'You can answer questions about jobs, leads, proposals, tasks, team, and knowledge documents.',
    'You can draft proposals, emails, SOPs, and meeting summaries when asked.',
    featureHint,
    context?.trim() ? `Live organization data:\n${context.trim()}` : ''
  ]
    .filter(Boolean)
    .join('\n\n');

  const payload = {
    model: openAiModel(),
    messages: [{ role: 'system', content: systemContext }, ...messages],
    temperature: 0.35,
    max_tokens: 1400
  };

  let res: Response;
  try {
    res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });
  } catch {
    return { ok: false, code: 'upstream_error', message: 'Unable to reach OpenAI. Try again shortly.' };
  }

  if (res.status === 429) {
    return { ok: false, code: 'upstream_error', message: 'OpenAI rate limit reached. Please wait a moment.' };
  }

  if (!res.ok) {
    return {
      ok: false,
      code: 'upstream_error',
      message: 'AI request failed. Core EverittOS features are unaffected.'
    };
  }

  const json = (await res.json()) as {
    choices?: { message?: { content?: string } }[];
    model?: string;
    usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number };
  };

  const reply = json.choices?.[0]?.message?.content?.trim();
  if (!reply) {
    return { ok: false, code: 'upstream_error', message: 'No response from AI.' };
  }

  const promptTokens = json.usage?.prompt_tokens || 0;
  const completionTokens = json.usage?.completion_tokens || 0;
  const totalTokens = json.usage?.total_tokens || promptTokens + completionTokens;

  return {
    ok: true,
    reply,
    model: json.model || openAiModel(),
    usage: {
      promptTokens,
      completionTokens,
      totalTokens,
      estimatedCostUsd: estimateOpenAiCost(promptTokens, completionTokens)
    }
  };
}

export async function logAiGeneration(
  admin: SupabaseClient,
  input: {
    organizationId: string;
    userId: string;
    prompt: string;
    response: string;
    model: string;
    feature?: AiFeatureId | string;
    usage?: { promptTokens: number; completionTokens: number; totalTokens: number; estimatedCostUsd: number };
  }
): Promise<void> {
  await admin.from('ai_generations').insert({
    organization_id: input.organizationId,
    user_id: input.userId,
    prompt: input.prompt.slice(0, 4000),
    response: input.response.slice(0, 8000),
    model: input.model,
    feature: input.feature || 'ask_everitt',
    prompt_tokens: input.usage?.promptTokens || 0,
    completion_tokens: input.usage?.completionTokens || 0,
    total_tokens: input.usage?.totalTokens || 0,
    estimated_cost_usd: input.usage?.estimatedCostUsd || 0
  });
}
