import { firstEnv } from '@/lib/ai/env';
import { estimateOllamaCost } from '@/lib/ai/providers/cost';
import type {
  AiChatCompletionRequest,
  AiChatCompletionResult,
  AiChatMessage,
  AiProvider
} from '@/lib/ai/providers/types';

const DEFAULT_MODEL = 'llama3.2';
const DEFAULT_BASE_URL = 'http://127.0.0.1:11434';

function baseUrl(): string {
  return (firstEnv('AI_BASE_URL', 'OLLAMA_BASE_URL') || DEFAULT_BASE_URL).replace(/\/+$/, '');
}

function defaultModel(): string {
  return firstEnv('AI_MODEL', 'OLLAMA_MODEL') || DEFAULT_MODEL;
}

function buildOllamaMessages(systemPrompt: string | undefined, messages: AiChatMessage[]) {
  const payload: { role: string; content: string }[] = [];
  if (systemPrompt?.trim()) {
    payload.push({ role: 'system', content: systemPrompt.trim() });
  }
  for (const message of messages) {
    payload.push({ role: message.role, content: message.content });
  }
  return payload;
}

export const ollamaProvider: AiProvider = {
  id: 'ollama',
  displayName: 'Ollama',
  isConfigured: () => Boolean(baseUrl()),
  defaultModel,
  resolveModel: (override?: string) => override?.trim() || defaultModel(),
  async chatCompletion(request: AiChatCompletionRequest): Promise<AiChatCompletionResult> {
    const model = request.model?.trim() || defaultModel();
    const url = `${baseUrl()}/api/chat`;

    let res: Response;
    try {
      res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model,
          messages: buildOllamaMessages(request.systemPrompt, request.messages),
          stream: false,
          options: {
            temperature: request.temperature ?? 0.35,
            num_predict: request.maxTokens ?? 1400
          }
        })
      });
    } catch {
      return {
        ok: false,
        code: 'upstream_error',
        message: 'Unable to reach Ollama. Ensure OLLAMA_BASE_URL is correct and the server is running.'
      };
    }

    if (!res.ok) {
      return {
        ok: false,
        code: 'upstream_error',
        message: 'Ollama request failed. Core EverittOS features are unaffected.'
      };
    }

    const json = (await res.json()) as {
      message?: { content?: string };
      prompt_eval_count?: number;
      eval_count?: number;
    };

    const reply = json.message?.content?.trim();
    if (!reply) {
      return { ok: false, code: 'upstream_error', message: 'No response from Ollama.' };
    }

    const promptTokens = json.prompt_eval_count || 0;
    const completionTokens = json.eval_count || 0;

    return {
      ok: true,
      reply,
      model,
      provider: 'ollama',
      usage: {
        promptTokens,
        completionTokens,
        totalTokens: promptTokens + completionTokens,
        estimatedCostUsd: estimateOllamaCost()
      }
    };
  },
  estimateCost: () => estimateOllamaCost()
};
