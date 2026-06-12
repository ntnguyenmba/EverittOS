import type {
  AiChatCompletionRequest,
  AiChatCompletionResult,
  AiChatMessage,
  AiProviderId
} from '@/lib/ai/providers/types';

type OpenAiCompatOptions = {
  providerId: AiProviderId;
  providerLabel: string;
  getBaseUrl: () => string;
  getApiKey: () => string | null;
  getDefaultModel: () => string;
  estimateCost: (promptTokens: number, completionTokens: number, model: string) => number;
  requiresApiKey?: boolean;
};

function normalizeBaseUrl(baseUrl: string): string {
  return baseUrl.replace(/\/+$/, '');
}

function buildMessages(systemPrompt: string | undefined, messages: AiChatMessage[]) {
  const payload: { role: string; content: string }[] = [];
  if (systemPrompt?.trim()) {
    payload.push({ role: 'system', content: systemPrompt.trim() });
  }
  for (const message of messages) {
    payload.push({ role: message.role, content: message.content });
  }
  return payload;
}

export function createOpenAiCompatibleProvider(options: OpenAiCompatOptions) {
  const requiresApiKey = options.requiresApiKey ?? true;

  return {
    async chatCompletion(request: AiChatCompletionRequest): Promise<AiChatCompletionResult> {
      const apiKey = options.getApiKey();
      if (requiresApiKey && !apiKey) {
        return {
          ok: false,
          code: 'not_configured',
          message: `${options.providerLabel} API key is not configured.`
        };
      }

      const model = request.model?.trim() || options.getDefaultModel();
      const url = `${normalizeBaseUrl(options.getBaseUrl())}/chat/completions`;
      const payload = {
        model,
        messages: buildMessages(request.systemPrompt, request.messages),
        temperature: request.temperature ?? 0.35,
        max_tokens: request.maxTokens ?? 1400
      };

      const headers: Record<string, string> = {
        'Content-Type': 'application/json'
      };
      if (apiKey) {
        headers.Authorization = `Bearer ${apiKey}`;
      }

      let res: Response;
      try {
        res = await fetch(url, {
          method: 'POST',
          headers,
          body: JSON.stringify(payload)
        });
      } catch {
        return {
          ok: false,
          code: 'upstream_error',
          message: `Unable to reach ${options.providerLabel}. Try again shortly.`
        };
      }

      if (res.status === 429) {
        return {
          ok: false,
          code: 'rate_limited',
          message: `${options.providerLabel} rate limit reached. Please wait a moment.`
        };
      }

      if (!res.ok) {
        let detail = '';
        try {
          const errJson = (await res.json()) as { error?: { message?: string } };
          detail = errJson.error?.message || '';
        } catch {
          /* ignore */
        }
        return {
          ok: false,
          code: 'upstream_error',
          message:
            detail ||
            `${options.providerLabel} request failed. Core EverittOS features are unaffected.`
        };
      }

      const json = (await res.json()) as {
        choices?: { message?: { content?: string } }[];
        model?: string;
        usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number };
      };

      const reply = json.choices?.[0]?.message?.content?.trim();
      if (!reply) {
        return { ok: false, code: 'upstream_error', message: 'No response from AI provider.' };
      }

      const promptTokens = json.usage?.prompt_tokens || 0;
      const completionTokens = json.usage?.completion_tokens || 0;
      const totalTokens = json.usage?.total_tokens || promptTokens + completionTokens;
      const resolvedModel = json.model || model;

      return {
        ok: true,
        reply,
        model: resolvedModel,
        provider: options.providerId,
        usage: {
          promptTokens,
          completionTokens,
          totalTokens,
          estimatedCostUsd: options.estimateCost(promptTokens, completionTokens, resolvedModel)
        }
      };
    }
  };
}
