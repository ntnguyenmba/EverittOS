import type { SupabaseClient } from '@supabase/supabase-js';
import type { AskEverittAiPrefetchedContext } from '@/lib/ask-everitt/types';
import { runAskEverittSearchEngine } from '@/lib/ask-everitt/search-engine';

/**
 * Before calling an AI model, gather relevant workspace records from Supabase.
 * Keeps AI prompts small and grounded in real business data.
 */
export async function prefetchAskEverittContextForAi(
  supabase: SupabaseClient,
  organizationId: string,
  prompt: string
): Promise<AskEverittAiPrefetchedContext> {
  const search = await runAskEverittSearchEngine(supabase, organizationId, prompt);

  const recordLines = search.results.slice(0, 12).map((r) => {
    const parts = [`- [${r.type}] ${r.title}`];
    if (r.subtitle) parts.push(`(${r.subtitle})`);
    if (r.status) parts.push(`status: ${r.status}`);
    if (r.date) parts.push(`date: ${r.date}`);
    return parts.join(' ');
  });

  const metricLines = (search.metrics || []).map((m) => `- ${m.label}: ${m.value}`);

  const contextBlock = [
    search.summary,
    metricLines.length ? `Metrics:\n${metricLines.join('\n')}` : '',
    recordLines.length ? `Matching records:\n${recordLines.join('\n')}` : search.noResultsHint || ''
  ]
    .filter(Boolean)
    .join('\n\n');

  return {
    summary: search.summary,
    records: search.results,
    metrics: search.metrics,
    ...(contextBlock ? { _contextBlock: contextBlock } : {})
  } as AskEverittAiPrefetchedContext & { _contextBlock?: string };
}

export function formatPrefetchedContextForAi(
  prefetched: AskEverittAiPrefetchedContext & { _contextBlock?: string }
): string {
  if (prefetched._contextBlock) return prefetched._contextBlock;
  return prefetched.summary;
}
