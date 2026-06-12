import { firstEnv } from '@/lib/ai/env';
import { estimateDeepSeekCost } from '@/lib/ai/providers/cost';
import { createOpenAiCompatibleProvider } from '@/lib/ai/providers/openai-compat';
import type { AiChatCompletionRequest, AiProvider } from '@/lib/ai/providers/types';

const DEFAULT_MODEL = 'deepseek-chat';
const DEFAULT_BASE_URL = 'https://api.deepseek.com/v1';

function apiKey(): string | null {
  return firstEnv('AI_API_KEY', 'DEEPSEEK_API_KEY');
}

function baseUrl(): string {
  return firstEnv('AI_BASE_URL', 'DEEPSEEK_BASE_URL') || DEFAULT_BASE_URL;
}

function defaultModel(): string {
  return firstEnv('AI_MODEL', 'DEEPSEEK_MODEL') || DEFAULT_MODEL;
}

const compat = createOpenAiCompatibleProvider({
  providerId: 'deepseek',
  providerLabel: 'DeepSeek',
  getBaseUrl: baseUrl,
  getApiKey: apiKey,
  getDefaultModel: defaultModel,
  estimateCost: estimateDeepSeekCost
});

export const deepSeekProvider: AiProvider = {
  id: 'deepseek',
  displayName: 'DeepSeek',
  isConfigured: () => Boolean(apiKey()),
  defaultModel,
  resolveModel: (override?: string) => override?.trim() || defaultModel(),
  chatCompletion: (request: AiChatCompletionRequest) => compat.chatCompletion(request),
  estimateCost: (promptTokens, completionTokens, model) =>
    estimateDeepSeekCost(promptTokens, completionTokens, model || defaultModel())
};
