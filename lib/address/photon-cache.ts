import type { AddressSuggestion } from '@/lib/address/types';

type CacheEntry = {
  expiresAt: number;
  suggestions: AddressSuggestion[];
};

const MEMORY_TTL_MS = 1000 * 60 * 30;
const memoryCache = new Map<string, CacheEntry>();

function cacheKey(query: string): string {
  return query.trim().toLowerCase();
}

export function getCachedAddressSuggestions(query: string): AddressSuggestion[] | null {
  const key = cacheKey(query);
  const entry = memoryCache.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    memoryCache.delete(key);
    return null;
  }
  return entry.suggestions;
}

export function setCachedAddressSuggestions(query: string, suggestions: AddressSuggestion[]): void {
  memoryCache.set(cacheKey(query), {
    expiresAt: Date.now() + MEMORY_TTL_MS,
    suggestions
  });
  if (memoryCache.size > 200) {
    const oldest = memoryCache.keys().next().value;
    if (oldest) memoryCache.delete(oldest);
  }
}

export function clearAddressSuggestionCache(): void {
  memoryCache.clear();
}
