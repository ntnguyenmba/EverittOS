export type AskEverittMode = 'search' | 'ai';

const AI_VERBS =
  /\b(write|summarize|summarise|analyze|analyse|recommend|generate|draft|rewrite|create|compose|explain|identify|suggest|improve|brainstorm|polish|proofread|translate|paraphrase|outline|campaign|sop)\b/i;

const SEARCH_VERBS =
  /\b(find|show|list|search|count|open|filter|lookup|look up|display|get|fetch|which|what|who|how many|where|when|tell me about)\b/i;

/** Route Ask Everitt queries: search business data first; AI only for generative tasks. */
export function detectAskEverittMode(query: string): AskEverittMode {
  const text = query.trim();
  if (!text) return 'search';

  const hasAi = AI_VERBS.test(text);
  const hasSearch = SEARCH_VERBS.test(text);

  if (hasAi && !hasSearch) return 'ai';
  if (hasSearch && !hasAi) return 'search';

  // Phrases that strongly imply AI even without explicit verbs
  if (/\b(follow-up message|follow up email|draft (an|a) email|write (an|a) message)\b/i.test(text)) {
    return 'ai';
  }

  // Default to search to avoid model costs
  return 'search';
}

export function isAiSuggestion(text: string): boolean {
  return detectAskEverittMode(text) === 'ai';
}
