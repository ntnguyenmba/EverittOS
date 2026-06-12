/** Server-only OpenAI configuration. Never use NEXT_PUBLIC_ for AI keys. */

export function openAiApiKey(): string | null {
  const key = (process.env.OPENAI_API_KEY || '').trim();
  return key || null;
}

export function openAiConfigured(): boolean {
  return Boolean(openAiApiKey());
}

export function openAiModel(): string {
  return (process.env.OPENAI_MODEL || 'gpt-4o-mini').trim();
}
