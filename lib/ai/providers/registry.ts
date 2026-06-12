import { envTrim } from '@/lib/ai/env';
import { anthropicProvider } from '@/lib/ai/providers/anthropic';
import { deepSeekProvider } from '@/lib/ai/providers/deepseek';
import { geminiProvider } from '@/lib/ai/providers/gemini';
import { ollamaProvider } from '@/lib/ai/providers/ollama';
import { openAiProvider } from '@/lib/ai/providers/openai';
import { qwenProvider } from '@/lib/ai/providers/qwen';
import type { AiProvider, AiProviderId, AiProviderPublicInfo } from '@/lib/ai/providers/types';

export const AI_PROVIDER_IDS = [
  'openai',
  'deepseek',
  'ollama',
  'qwen',
  'gemini',
  'anthropic'
] as const satisfies readonly AiProviderId[];

const PROVIDERS: Record<AiProviderId, AiProvider> = {
  openai: openAiProvider,
  deepseek: deepSeekProvider,
  ollama: ollamaProvider,
  qwen: qwenProvider,
  gemini: geminiProvider,
  anthropic: anthropicProvider
};

export function resolveAiProviderId(): AiProviderId {
  const raw = (envTrim('AI_PROVIDER') || 'openai').toLowerCase();
  if ((AI_PROVIDER_IDS as readonly string[]).includes(raw)) {
    return raw as AiProviderId;
  }
  return 'openai';
}

export function getAiProvider(id?: AiProviderId): AiProvider {
  const providerId = id || resolveAiProviderId();
  return PROVIDERS[providerId];
}

export function getActiveAiProvider(): AiProvider {
  return getAiProvider(resolveAiProviderId());
}

export function listAiProviders(): AiProvider[] {
  return AI_PROVIDER_IDS.map((id) => PROVIDERS[id]);
}

export function getActiveAiProviderInfo(): AiProviderPublicInfo {
  const provider = getActiveAiProvider();
  return {
    id: provider.id,
    displayName: provider.displayName,
    configured: provider.isConfigured(),
    model: provider.defaultModel()
  };
}
