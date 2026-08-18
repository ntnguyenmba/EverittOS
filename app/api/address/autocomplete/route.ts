import { NextResponse } from 'next/server';
import {
  filterAddressSuggestionsForQuery,
  parsePhotonFeatures,
  structuredAddressFromManual,
  type PhotonFeature
} from '@/lib/address/parse-photon';
import type { AddressSuggestion } from '@/lib/address/types';
import { createServerSupabase } from '@/lib/supabase-server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const PHOTON_ENDPOINT = 'https://photon.komoot.io/api/';
const MIN_QUERY_LENGTH = 3;
const DISPLAY_LIMIT = 8;
const PROVIDER_LIMIT = 32;

function manualSuggestion(query: string): AddressSuggestion | null {
  const trimmed = query.trim();
  if (trimmed.length < 8 || !/^\d+[a-z]?\s+/i.test(trimmed)) return null;
  const structured = structuredAddressFromManual(trimmed);
  return {
    ...structured,
    id: `manual-${trimmed.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`,
    label: trimmed,
    detail: 'Use this address'
  };
}

function mergeSuggestions(query: string, providerSuggestions: AddressSuggestion[]) {
  const filtered = filterAddressSuggestionsForQuery(providerSuggestions, query);
  const manual = manualSuggestion(query);
  if (!manual) return filtered.slice(0, DISPLAY_LIMIT);

  const normalizedManual = manual.formattedAddress.toLowerCase();
  const alreadyPresent = filtered.some(
    (suggestion) => suggestion.formattedAddress.toLowerCase() === normalizedManual
  );

  return (alreadyPresent ? filtered : [manual, ...filtered]).slice(0, DISPLAY_LIMIT);
}

/**
 * Server-side Photon (OpenStreetMap) autocomplete proxy.
 * Always requests fresh provider results so recently added addresses are not hidden by stale server cache.
 */
export async function GET(request: Request) {
  const supabase = await createServerSupabase();
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const url = new URL(request.url);
  const q = (url.searchParams.get('q') || '').trim();
  if (q.length < MIN_QUERY_LENGTH) {
    return NextResponse.json({
      suggestions: [],
      attribution: 'Address search © OpenStreetMap contributors, © Komoot Photon',
      provider: 'photon'
    });
  }

  try {
    const photonUrl = new URL(PHOTON_ENDPOINT);
    photonUrl.searchParams.set('q', q);
    photonUrl.searchParams.set('limit', String(PROVIDER_LIMIT));
    photonUrl.searchParams.set('lang', 'en');

    const response = await fetch(photonUrl.toString(), {
      headers: {
        Accept: 'application/json',
        'User-Agent': 'EverittOS/1.0 (address-autocomplete; https://everittos.com)'
      },
      signal: AbortSignal.timeout(5000),
      cache: 'no-store'
    });

    if (!response.ok) {
      const fallback = manualSuggestion(q);
      return NextResponse.json({
        suggestions: fallback ? [fallback] : [],
        error: fallback ? undefined : 'Address provider temporarily unavailable. You can enter the address manually.',
        attribution: 'Address search © OpenStreetMap contributors, © Komoot Photon',
        provider: 'photon',
        unavailable: !fallback
      });
    }

    const payload = (await response.json()) as { features?: PhotonFeature[] };
    const parsedSuggestions = parsePhotonFeatures(payload.features || []);
    const suggestions = mergeSuggestions(q, parsedSuggestions);

    return NextResponse.json({
      suggestions,
      attribution: 'Address search © OpenStreetMap contributors, © Komoot Photon',
      provider: 'photon'
    });
  } catch {
    const fallback = manualSuggestion(q);
    return NextResponse.json({
      suggestions: fallback ? [fallback] : [],
      error: fallback ? undefined : 'Address provider temporarily unavailable. You can enter the address manually.',
      attribution: 'Address search © OpenStreetMap contributors, © Komoot Photon',
      provider: 'photon',
      unavailable: !fallback
    });
  }
}
