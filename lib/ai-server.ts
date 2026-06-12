import type { SupabaseClient } from '@supabase/supabase-js';
import { openAiApiKey, openAiConfigured, openAiModel } from '@/lib/ai-config';
import { canAccessFeature } from '@/lib/plan-access';
import type { EverittosPlan } from '@/lib/everittos-plans';
import { limitsForPlan } from '@/lib/everittos-limits';

export type AiChatMessage = {
  role: 'system' | 'user' | 'assistant';
  content: string;
};

export type AiChatResult =
  | { ok: true; reply: string; model: string }
  | { ok: false; code: 'not_configured' | 'plan_required' | 'rate_limited' | 'upstream_error'; message: string };

const MONTHLY_AI_CAP: Record<EverittosPlan, number> = {
  free: 0,
  pro: 0,
  business: 200,
  operations: 0,
  growth: 0,
  enterprise: -1
};

export function aiMonthlyCap(plan: EverittosPlan): number {
  const limits = limitsForPlan(plan);
  if (!limits.aiAccess) return 0;
  if (limits.aiUnlimited) return -1;
  return MONTHLY_AI_CAP[plan] ?? 0;
}

export async function countAiGenerationsThisMonth(
  admin: SupabaseClient,
  organizationId: string
): Promise<number> {
  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);

  const { count } = await admin
    .from('ai_generations')
    .select('id', { count: 'exact', head: true })
    .eq('organization_id', organizationId)
    .gte('created_at', monthStart.toISOString());

  return count || 0;
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
      message: 'Ask Everitt requires Business or Enterprise.'
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
  context?: string
): Promise<AiChatResult> {
  const apiKey = openAiApiKey();
  if (!apiKey) {
    return { ok: false, code: 'not_configured', message: 'OPENAI_API_KEY is not configured.' };
  }

  const systemContext = context?.trim()
    ? `Organization context:\n${context.trim()}`
    : 'You are Everitt, the AI assistant inside EverittOS, a business operating system for service companies. Be concise, professional, and action-oriented.';

  const payload = {
    model: openAiModel(),
    messages: [{ role: 'system', content: systemContext }, ...messages],
    temperature: 0.4,
    max_tokens: 1200
  };

  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload)
  });

  if (!res.ok) {
    const errText = await res.text();
    return {
      ok: false,
      code: 'upstream_error',
      message: errText.slice(0, 200) || 'OpenAI request failed.'
    };
  }

  const json = (await res.json()) as {
    choices?: { message?: { content?: string } }[];
    model?: string;
  };

  const reply = json.choices?.[0]?.message?.content?.trim();
  if (!reply) {
    return { ok: false, code: 'upstream_error', message: 'No response from AI.' };
  }

  return { ok: true, reply, model: json.model || openAiModel() };
}

export async function logAiGeneration(
  admin: SupabaseClient,
  input: {
    organizationId: string;
    userId: string;
    prompt: string;
    response: string;
    model: string;
    feature?: string;
  }
): Promise<void> {
  await admin.from('ai_generations').insert({
    organization_id: input.organizationId,
    user_id: input.userId,
    prompt: input.prompt.slice(0, 4000),
    response: input.response.slice(0, 8000),
    model: input.model,
    feature: input.feature || 'ask_everitt'
  });
}
