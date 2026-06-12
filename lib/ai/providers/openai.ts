import { firstEnv } from '@/lib/ai/env';
import { estimateOpenAiCost } from '@/lib/ai/providers/cost';
import { createOpenAiCompatibleProvider } from '@/lib/ai/providers/openai-compat';
import type { AiChatCompletionRequest, AiProvider } from '@/lib/ai/providers/types';

const DEFAULT_MODEL = 'gpt-4o-mini';
const DEFAULT_BASE_URL = 'https://api.openai.com/v1';

function apiKey(): string | null {
  return firstEnv('AI_API_KEY', 'OPENAI_API_KEY');
}

function baseUrl(): string {
  return firstEnv('AI_BASE_URL', 'OPENAI_BASE_URL') || DEFAULT_BASE_URL;
}

function defaultModel(): string {
  return firstEnv('AI_MODEL', 'OPENAI_MODEL') || DEFAULT_MODEL;
}

const compat = createOpenAiCompatibleProvider({
  providerId: 'openai',
  providerLabel: 'OpenAI',
  getBaseUrl: baseUrl,
  getApiKey: apiKey,
  getDefaultModel: defaultModel,
  estimateCost: estimateOpenAiCost
});

export const openAiProvider: AiProvider = {
  id: 'openai',
  displayName: 'OpenAI',
  isConfigured: () => Boolean(apiKey()),
  defaultModel,
  resolveModel: (override?: string) => override?.trim() || defaultModel(),
  chatCompletion: (request: AiChatCompletionRequest) => compat.chatCompletion(request),
  estimateCost: (promptTokens, completionTokens, model) =>
    estimateOpenAiCost(promptTokens, completionTokens, model || defaultModel())
};
