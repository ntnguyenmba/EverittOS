export type AskEverittMode = 'search' | 'ai';

const AI_VERBS =
  /\b(analyze|analyse|summarize|summarise|generate|write|draft|improve|recommend|explain|predict|create|compose|rewrite|identify|suggest|brainstorm|polish|proofread|translate|paraphrase|outline|campaign)\b/i;

const SEARCH_VERBS =
  /\b(find|show|list|open|search|lookup|look up|filter|display|get|fetch|which|what|who|where|when|count|how many|tell me about)\b/i;

/** Route queries: business search first; AI only for generation and analysis. */
export function detectAskEverittMode(query: string): AskEverittMode {
  const text = query.trim();
  if (!text) return 'search';

  const hasAi = AI_VERBS.test(text);
  const hasSearch = SEARCH_VERBS.test(text);

  if (hasAi && !hasSearch) return 'ai';
  if (hasSearch && !hasAi) return 'search';

  if (/\b(follow-up message|follow up email|draft (an|a) email|write (an|a) message|reactivation email)\b/i.test(text)) {
    return 'ai';
  }

  return 'search';
}

export function isAiSuggestion(text: string): boolean {
  return detectAskEverittMode(text) === 'ai';
}

export function isSearchSuggestion(text: string): boolean {
  return detectAskEverittMode(text) === 'search';
}
