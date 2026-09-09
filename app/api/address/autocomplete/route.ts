import { NextResponse } from 'next/server';
import {
  filterAddressSuggestionsForQuery,
  parseCensusMatch,
  parsePhotonFeatures,
  structuredAddressFromManual,
  type CensusAddressMatch,
  type PhotonFeature
} from '@/lib/address/parse-photon';
import type { AddressSuggestion } from '@/lib/address/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const PHOTON_ENDPOINT = 'https://photon.komoot.io/api/';
const CENSUS_ENDPOINT = 'https://geocoding.geo.census.gov/geocoder/locations/onelineaddress';
const MIN_QUERY_LENGTH = 2;
const DISPLAY_LIMIT = 8;
const PROVIDER_LIMIT = 32;

function typedHouseNumber(query: string): string | null {
  return query.trim().toLowerCase().match(/^(\d+[a-z]?)(?:\s|$)/)?.[1] || null;
}

function looksLikeStreetAddress(query: string): boolean {
  return /^\d+[a-z]?\s+[a-z]/i.test(query.trim());
}

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

async function fetchPhoton(query: string): Promise<AddressSuggestion[]> {
  const photonUrl = new URL(PHOTON_ENDPOINT);
  photonUrl.searchParams.set('q', query);
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
  if (!response.ok) return [];
  const payload = (await response.json()) as { features?: PhotonFeature[] };
  return parsePhotonFeatures(payload.features || []);
}

async function fetchCensus(query: string): Promise<AddressSuggestion[]> {
  if (!looksLikeStreetAddress(query)) return [];
  const censusUrl = new URL(CENSUS_ENDPOINT);
  censusUrl.searchParams.set('address', query);
  censusUrl.searchParams.set('benchmark', 'Public_AR_Current');
  censusUrl.searchParams.set('vintage', 'Current_Current');
  censusUrl.searchParams.set('format', 'json');

  const response = await fetch(censusUrl.toString(), {
    headers: { Accept: 'application/json' },
    signal: AbortSignal.timeout(5000),
    cache: 'no-store'
  });
  if (!response.ok) return [];
  const payload = (await response.json()) as { result?: { addressMatches?: CensusAddressMatch[] } };
  const house = typedHouseNumber(query);
  return (payload.result?.addressMatches || [])
    .map((match) => parseCensusMatch(match, house))
    .filter((item): item is AddressSuggestion => Boolean(item && item.postalCode));
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const q = (url.searchParams.get('q') || '').trim();
  if (q.length < MIN_QUERY_LENGTH) {
    return NextResponse.json({
      suggestions: [],
      attribution: 'Address search © OpenStreetMap contributors, © Komoot Photon, U.S. Census Bureau',
      provider: 'photon'
    });
  }

  try {
    const [photonSuggestions, censusSuggestions] = await Promise.all([
      fetchPhoton(q).catch(() => [] as AddressSuggestion[]),
      fetchCensus(q).catch(() => [] as AddressSuggestion[])
    ]);
    const suggestions = mergeSuggestions(q, [...censusSuggestions, ...photonSuggestions]);

    return NextResponse.json({
      suggestions,
      attribution: 'Address search © OpenStreetMap contributors, © Komoot Photon, U.S. Census Bureau',
      provider: censusSuggestions.length ? 'census+photon' : 'photon'
    });
  } catch {
    const fallback = manualSuggestion(q);
    return NextResponse.json({
      suggestions: fallback ? [fallback] : [],
      error: fallback ? undefined : 'Address provider temporarily unavailable. You can enter the address manually.',
      attribution: 'Address search © OpenStreetMap contributors, © Komoot Photon, U.S. Census Bureau',
      provider: 'photon',
      unavailable: !fallback
    });
  }
}
