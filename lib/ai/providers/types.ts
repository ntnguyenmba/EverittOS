export type AiProviderId = 'openai' | 'deepseek' | 'ollama' | 'qwen' | 'gemini' | 'anthropic';

export type AiChatRole = 'system' | 'user' | 'assistant';

export type AiChatMessage = {
  role: AiChatRole;
  content: string;
};

export type AiChatCompletionRequest = {
  messages: AiChatMessage[];
  systemPrompt?: string;
  temperature?: number;
  maxTokens?: number;
  model?: string;
};

export type AiTokenUsage = {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  estimatedCostUsd: number;
};

export type AiChatCompletionSuccess = {
  ok: true;
  reply: string;
  model: string;
  provider: AiProviderId;
  usage: AiTokenUsage;
};

export type AiChatCompletionFailureCode =
  | 'not_configured'
  | 'upstream_error'
  | 'rate_limited';

export type AiChatCompletionFailure = {
  ok: false;
  code: AiChatCompletionFailureCode;
  message: string;
};

export type AiChatCompletionResult = AiChatCompletionSuccess | AiChatCompletionFailure;

/** Provider plug-in contract. Add new models by implementing this interface. */
export interface AiProvider {
  readonly id: AiProviderId;
  readonly displayName: string;
  isConfigured(): boolean;
  defaultModel(): string;
  resolveModel(override?: string): string;
  chatCompletion(request: AiChatCompletionRequest): Promise<AiChatCompletionResult>;
  estimateCost(promptTokens: number, completionTokens: number, model?: string): number;
}

export type AiProviderPublicInfo = {
  id: AiProviderId;
  displayName: string;
  configured: boolean;
  model: string;
};
