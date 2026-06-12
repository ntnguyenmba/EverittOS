export {
  aiConfigured,
  aiModel,
  aiProviderDisplayName,
  aiProviderId,
  getActiveAiProvider,
  getActiveAiProviderInfo,
  resolveAiProviderId
} from '@/lib/ai/config';

export type {
  AiChatCompletionRequest,
  AiChatCompletionResult,
  AiChatMessage,
  AiProvider,
  AiProviderId,
  AiProviderPublicInfo
} from '@/lib/ai/providers/types';

export { AI_PROVIDER_IDS, getAiProvider, listAiProviders } from '@/lib/ai/providers/registry';
