/** Rough per-token pricing (USD). Unknown models return 0. */

const OPENAI_RATES: Record<string, { input: number; output: number }> = {
  'gpt-4o-mini': { input: 0.15 / 1_000_000, output: 0.6 / 1_000_000 },
  'gpt-4o': { input: 2.5 / 1_000_000, output: 10 / 1_000_000 }
};

const DEEPSEEK_RATES: Record<string, { input: number; output: number }> = {
  'deepseek-chat': { input: 0.27 / 1_000_000, output: 1.1 / 1_000_000 },
  'deepseek-reasoner': { input: 0.55 / 1_000_000, output: 2.19 / 1_000_000 }
};

const ANTHROPIC_RATES: Record<string, { input: number; output: number }> = {
  'claude-3-5-haiku-latest': { input: 0.8 / 1_000_000, output: 4 / 1_000_000 },
  'claude-3-5-sonnet-latest': { input: 3 / 1_000_000, output: 15 / 1_000_000 }
};

const GEMINI_RATES: Record<string, { input: number; output: number }> = {
  'gemini-1.5-flash': { input: 0.075 / 1_000_000, output: 0.3 / 1_000_000 },
  'gemini-1.5-pro': { input: 1.25 / 1_000_000, output: 5 / 1_000_000 }
};

const QWEN_RATES: Record<string, { input: number; output: number }> = {
  'qwen-plus': { input: 0.4 / 1_000_000, output: 1.2 / 1_000_000 },
  'qwen-turbo': { input: 0.2 / 1_000_000, output: 0.6 / 1_000_000 }
};

function estimateFromTable(
  table: Record<string, { input: number; output: number }>,
  promptTokens: number,
  completionTokens: number,
  model: string,
  fallback?: { input: number; output: number }
): number {
  const rates = table[model] || fallback;
  if (!rates) return 0;
  return Number((promptTokens * rates.input + completionTokens * rates.output).toFixed(6));
}

export function estimateOpenAiCost(promptTokens: number, completionTokens: number, model: string): number {
  return estimateFromTable(OPENAI_RATES, promptTokens, completionTokens, model, OPENAI_RATES['gpt-4o-mini']);
}

export function estimateDeepSeekCost(promptTokens: number, completionTokens: number, model: string): number {
  return estimateFromTable(DEEPSEEK_RATES, promptTokens, completionTokens, model, DEEPSEEK_RATES['deepseek-chat']);
}

export function estimateAnthropicCost(promptTokens: number, completionTokens: number, model: string): number {
  return estimateFromTable(
    ANTHROPIC_RATES,
    promptTokens,
    completionTokens,
    model,
    ANTHROPIC_RATES['claude-3-5-haiku-latest']
  );
}

export function estimateGeminiCost(promptTokens: number, completionTokens: number, model: string): number {
  return estimateFromTable(GEMINI_RATES, promptTokens, completionTokens, model, GEMINI_RATES['gemini-1.5-flash']);
}

export function estimateQwenCost(promptTokens: number, completionTokens: number, model: string): number {
  return estimateFromTable(QWEN_RATES, promptTokens, completionTokens, model, QWEN_RATES['qwen-plus']);
}

/** Local Ollama runs have no metered API cost. */
export function estimateOllamaCost(): number {
  return 0;
}
