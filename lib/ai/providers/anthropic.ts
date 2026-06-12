import { firstEnv } from '@/lib/ai/env';
import { estimateAnthropicCost } from '@/lib/ai/providers/cost';
import type {
  AiChatCompletionRequest,
  AiChatCompletionResult,
  AiChatMessage,
  AiProvider
} from '@/lib/ai/providers/types';

const DEFAULT_MODEL = 'claude-3-5-haiku-latest';

function apiKey(): string | null {
  return firstEnv('AI_API_KEY', 'ANTHROPIC_API_KEY');
}

function defaultModel(): string {
  return firstEnv('AI_MODEL', 'ANTHROPIC_MODEL') || DEFAULT_MODEL;
}

function toAnthropicMessages(messages: AiChatMessage[]) {
  return messages
    .filter((m) => m.role !== 'system')
    .map((m) => ({
      role: m.role === 'assistant' ? 'assistant' : 'user',
      content: m.content
    }));
}

export const anthropicProvider: AiProvider = {
  id: 'anthropic',
  displayName: 'Anthropic',
  isConfigured: () => Boolean(apiKey()),
  defaultModel,
  resolveModel: (override?: string) => override?.trim() || defaultModel(),
  async chatCompletion(request: AiChatCompletionRequest): Promise<AiChatCompletionResult> {
    const key = apiKey();
    if (!key) {
      return { ok: false, code: 'not_configured', message: 'Anthropic API key is not configured.' };
    }

    const model = request.model?.trim() || defaultModel();

    let res: Response;
    try {
      res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': key,
          'anthropic-version': '2023-06-01'
        },
        body: JSON.stringify({
          model,
          max_tokens: request.maxTokens ?? 1400,
          temperature: request.temperature ?? 0.35,
          system: request.systemPrompt?.trim() || undefined,
          messages: toAnthropicMessages(request.messages)
        })
      });
    } catch {
      return {
        ok: false,
        code: 'upstream_error',
        message: 'Unable to reach Anthropic. Try again shortly.'
      };
    }

    if (res.status === 429) {
      return { ok: false, code: 'rate_limited', message: 'Anthropic rate limit reached. Please wait a moment.' };
    }

    if (!res.ok) {
      return {
        ok: false,
        code: 'upstream_error',
        message: 'Anthropic request failed. Core EverittOS features are unaffected.'
      };
    }

    const json = (await res.json()) as {
      content?: { type?: string; text?: string }[];
      model?: string;
      usage?: { input_tokens?: number; output_tokens?: number };
    };

    const reply = json.content
      ?.filter((block) => block.type === 'text')
      .map((block) => block.text || '')
      .join('')
      .trim();

    if (!reply) {
      return { ok: false, code: 'upstream_error', message: 'No response from Anthropic.' };
    }

    const promptTokens = json.usage?.input_tokens || 0;
    const completionTokens = json.usage?.output_tokens || 0;

    return {
      ok: true,
      reply,
      model: json.model || model,
      provider: 'anthropic',
      usage: {
        promptTokens,
        completionTokens,
        totalTokens: promptTokens + completionTokens,
        estimatedCostUsd: estimateAnthropicCost(promptTokens, completionTokens, model)
      }
    };
  },
  estimateCost: (promptTokens, completionTokens, model) =>
    estimateAnthropicCost(promptTokens, completionTokens, model || defaultModel())
};
