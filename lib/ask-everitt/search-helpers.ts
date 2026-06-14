import type { SupabaseClient } from '@supabase/supabase-js';
import type {
  AskEverittMetric,
  AskEverittSearchRecord,
  AskEverittSearchResponse
} from '@/lib/ask-everitt/types';
import { getSearchSource, resolveHref, type SearchSourceId } from '@/lib/ask-everitt/search-sources';

export type QueryHandler = (
  supabase: SupabaseClient,
  orgId: string,
  query: string
) => Promise<AskEverittSearchResponse | null>;

export function buildRecord(
  sourceId: SearchSourceId,
  partial: Pick<AskEverittSearchRecord, 'id' | 'title'> & {
    type?: AskEverittSearchRecord['type'];
    subtitle?: string | null;
    status?: string | null;
    date?: string | null;
    owner?: string | null;
    href?: string;
  }
): AskEverittSearchRecord {
  const source = getSearchSource(sourceId);
  const type = partial.type || source?.recordType || 'document';
  return {
    id: partial.id,
    type,
    sourceId,
    title: partial.title,
    subtitle: partial.subtitle ?? null,
    status: partial.status ?? null,
    date: partial.date ?? null,
    owner: partial.owner ?? null,
    href: partial.href || (source ? resolveHref(source, partial.id) : '/dashboard'),
    actionLabel: source?.actionLabel || 'Open'
  };
}

export function groupResults(results: AskEverittSearchRecord[]) {
  const bySource = new Map<string, AskEverittSearchRecord[]>();
  for (const r of results) {
    const list = bySource.get(r.sourceId) || [];
    list.push(r);
    bySource.set(r.sourceId, list);
  }
  return Array.from(bySource.entries()).map(([sourceId, items]) => ({
    sourceId,
    label: getSearchSource(sourceId as SearchSourceId)?.label || sourceId,
    results: items
  }));
}

export function response(
  summary: string,
  results: AskEverittSearchRecord[],
  opts?: { sourcesUsed?: SearchSourceId[]; metrics?: AskEverittMetric[]; noResultsHint?: string }
): AskEverittSearchResponse {
  const groups = groupResults(results);
  return {
    mode: 'search',
    summary,
    results,
    groups: groups.length > 1 ? groups : undefined,
    metrics: opts?.metrics,
    sourcesUsed: opts?.sourcesUsed?.map(String),
    noResultsHint: opts?.noResultsHint
  };
}
