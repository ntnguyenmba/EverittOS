import { NextResponse } from 'next/server';
import { getCachedAddressSuggestions, setCachedAddressSuggestions } from '@/lib/address/photon-cache';
import {
  filterAddressSuggestionsForQuery,
  parsePhotonFeatures,
  type PhotonFeature
} from '@/lib/address/parse-photon';
import { createServerSupabase } from '@/lib/supabase-server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const PHOTON_ENDPOINT = 'https://photon.komoot.io/api/';
const MIN_QUERY_LENGTH = 3;
const LIMIT = 8;

/**
 * Server-side Photon (OpenStreetMap) autocomplete proxy.
 * Keeps browser requests authenticated to EverittOS and avoids uncontrolled public traffic.
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

  const cached = getCachedAddressSuggestions(q);
  if (cached) {
    return NextResponse.json({
      suggestions: filterAddressSuggestionsForQuery(cached, q).slice(0, LIMIT),
      attribution: 'Address search © OpenStreetMap contributors, © Komoot Photon',
      provider: 'photon',
      cached: true
    });
  }

  try {
    const photonUrl = new URL(PHOTON_ENDPOINT);
    photonUrl.searchParams.set('q', q);
    photonUrl.searchParams.set('limit', String(LIMIT));
    photonUrl.searchParams.set('lang', 'en');

    const response = await fetch(photonUrl.toString(), {
      headers: {
        Accept: 'application/json',
        'User-Agent': 'EverittOS/1.0 (address-autocomplete; https://everittos.com)'
      },
      signal: AbortSignal.timeout(4500),
      next: { revalidate: 0 }
    });

    if (!response.ok) {
      return NextResponse.json({
        suggestions: [],
        error: 'Address provider temporarily unavailable. You can enter the address manually.',
        attribution: 'Address search © OpenStreetMap contributors, © Komoot Photon',
        provider: 'photon',
        unavailable: true
      });
    }

    const payload = (await response.json()) as { features?: PhotonFeature[] };
    const parsedSuggestions = parsePhotonFeatures(payload.features || []);
    setCachedAddressSuggestions(q, parsedSuggestions);
    const suggestions = filterAddressSuggestionsForQuery(parsedSuggestions, q).slice(0, LIMIT);

    return NextResponse.json({
      suggestions,
      attribution: 'Address search © OpenStreetMap contributors, © Komoot Photon',
      provider: 'photon'
    });
  } catch {
    return NextResponse.json({
      suggestions: [],
      error: 'Address provider temporarily unavailable. You can enter the address manually.',
      attribution: 'Address search © OpenStreetMap contributors, © Komoot Photon',
      provider: 'photon',
      unavailable: true
    });
  }
}
