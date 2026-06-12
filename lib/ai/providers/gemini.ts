import { firstEnv } from '@/lib/ai/env';
import { estimateGeminiCost } from '@/lib/ai/providers/cost';
import type {
  AiChatCompletionRequest,
  AiChatCompletionResult,
  AiChatMessage,
  AiProvider
} from '@/lib/ai/providers/types';

const DEFAULT_MODEL = 'gemini-1.5-flash';

function apiKey(): string | null {
  return firstEnv('AI_API_KEY', 'GEMINI_API_KEY', 'GOOGLE_AI_API_KEY');
}

function defaultModel(): string {
  return firstEnv('AI_MODEL', 'GEMINI_MODEL') || DEFAULT_MODEL;
}

function toGeminiContents(systemPrompt: string | undefined, messages: AiChatMessage[]) {
  const contents: { role: string; parts: { text: string }[] }[] = [];
  for (const message of messages) {
    const role = message.role === 'assistant' ? 'model' : 'user';
    contents.push({ role, parts: [{ text: message.content }] });
  }
  return { systemInstruction: systemPrompt?.trim() ? { parts: [{ text: systemPrompt.trim() }] } : undefined, contents };
}

export const geminiProvider: AiProvider = {
  id: 'gemini',
  displayName: 'Google Gemini',
  isConfigured: () => Boolean(apiKey()),
  defaultModel,
  resolveModel: (override?: string) => override?.trim() || defaultModel(),
  async chatCompletion(request: AiChatCompletionRequest): Promise<AiChatCompletionResult> {
    const key = apiKey();
    if (!key) {
      return { ok: false, code: 'not_configured', message: 'Gemini API key is not configured.' };
    }

    const model = request.model?.trim() || defaultModel();
    const { systemInstruction, contents } = toGeminiContents(request.systemPrompt, request.messages);
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(key)}`;

    let res: Response;
    try {
      res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          systemInstruction,
          contents,
          generationConfig: {
            temperature: request.temperature ?? 0.35,
            maxOutputTokens: request.maxTokens ?? 1400
          }
        })
      });
    } catch {
      return {
        ok: false,
        code: 'upstream_error',
        message: 'Unable to reach Google Gemini. Try again shortly.'
      };
    }

    if (res.status === 429) {
      return { ok: false, code: 'rate_limited', message: 'Gemini rate limit reached. Please wait a moment.' };
    }

    if (!res.ok) {
      return {
        ok: false,
        code: 'upstream_error',
        message: 'Gemini request failed. Core EverittOS features are unaffected.'
      };
    }

    const json = (await res.json()) as {
      candidates?: { content?: { parts?: { text?: string }[] } }[];
      usageMetadata?: {
        promptTokenCount?: number;
        candidatesTokenCount?: number;
        totalTokenCount?: number;
      };
    };

    const reply = json.candidates?.[0]?.content?.parts?.map((p) => p.text || '').join('').trim();
    if (!reply) {
      return { ok: false, code: 'upstream_error', message: 'No response from Gemini.' };
    }

    const promptTokens = json.usageMetadata?.promptTokenCount || 0;
    const completionTokens = json.usageMetadata?.candidatesTokenCount || 0;
    const totalTokens = json.usageMetadata?.totalTokenCount || promptTokens + completionTokens;

    return {
      ok: true,
      reply,
      model,
      provider: 'gemini',
      usage: {
        promptTokens,
        completionTokens,
        totalTokens,
        estimatedCostUsd: estimateGeminiCost(promptTokens, completionTokens, model)
      }
    };
  },
  estimateCost: (promptTokens, completionTokens, model) =>
    estimateGeminiCost(promptTokens, completionTokens, model || defaultModel())
};
