/**
 * Server-only AI configuration. Never use NEXT_PUBLIC_ for provider keys.
 * Select provider via AI_PROVIDER; credentials via AI_API_KEY or provider-specific keys.
 */

import { getActiveAiProvider, getActiveAiProviderInfo, resolveAiProviderId } from '@/lib/ai/providers/registry';
import type { AiProviderId } from '@/lib/ai/providers/types';

export { resolveAiProviderId, getActiveAiProvider, getActiveAiProviderInfo };

export function aiProviderId(): AiProviderId {
  return resolveAiProviderId();
}

export function aiConfigured(): boolean {
  return getActiveAiProvider().isConfigured();
}

export function aiModel(): string {
  return getActiveAiProvider().defaultModel();
}

export function aiProviderDisplayName(): string {
  return getActiveAiProvider().displayName;
}

/** @deprecated Use aiConfigured() */
export function openAiConfigured(): boolean {
  return aiConfigured();
}

/** @deprecated Use getActiveAiProvider().defaultModel() */
export function openAiModel(): string {
  return aiModel();
}

/** @deprecated Provider keys are resolved inside each provider */
export function openAiApiKey(): string | null {
  const provider = getActiveAiProvider();
  if (provider.id !== 'openai') return null;
  return provider.isConfigured() ? 'configured' : null;
}
