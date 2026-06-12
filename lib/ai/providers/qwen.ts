import { firstEnv } from '@/lib/ai/env';
import { estimateQwenCost } from '@/lib/ai/providers/cost';
import { createOpenAiCompatibleProvider } from '@/lib/ai/providers/openai-compat';
import type { AiChatCompletionRequest, AiProvider } from '@/lib/ai/providers/types';

const DEFAULT_MODEL = 'qwen-plus';
const DEFAULT_BASE_URL = 'https://dashscope.aliyuncs.com/compatible-mode/v1';

function apiKey(): string | null {
  return firstEnv('AI_API_KEY', 'QWEN_API_KEY', 'DASHSCOPE_API_KEY');
}

function baseUrl(): string {
  return firstEnv('AI_BASE_URL', 'QWEN_BASE_URL', 'DASHSCOPE_BASE_URL') || DEFAULT_BASE_URL;
}

function defaultModel(): string {
  return firstEnv('AI_MODEL', 'QWEN_MODEL', 'DASHSCOPE_MODEL') || DEFAULT_MODEL;
}

const compat = createOpenAiCompatibleProvider({
  providerId: 'qwen',
  providerLabel: 'Qwen',
  getBaseUrl: baseUrl,
  getApiKey: apiKey,
  getDefaultModel: defaultModel,
  estimateCost: estimateQwenCost
});

export const qwenProvider: AiProvider = {
  id: 'qwen',
  displayName: 'Qwen',
  isConfigured: () => Boolean(apiKey()),
  defaultModel,
  resolveModel: (override?: string) => override?.trim() || defaultModel(),
  chatCompletion: (request: AiChatCompletionRequest) => compat.chatCompletion(request),
  estimateCost: (promptTokens, completionTokens, model) =>
    estimateQwenCost(promptTokens, completionTokens, model || defaultModel())
};
