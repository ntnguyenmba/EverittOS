import { stateToCode, type AddressSuggestion, type StructuredAddress } from '@/lib/address/types';

export type PhotonProperties = {
  osm_id?: number | string;
  osm_type?: string;
  osm_key?: string;
  osm_value?: string;
  name?: string;
  street?: string;
  housenumber?: string;
  city?: string;
  locality?: string;
  district?: string;
  county?: string;
  state?: string;
  postcode?: string;
  country?: string;
  countrycode?: string;
  type?: string;
};

export type PhotonFeature = {
  type?: string;
  geometry?: {
    type?: string;
    coordinates?: [number, number] | number[];
  };
  properties?: PhotonProperties;
};

function firstNonEmpty(...values: Array<string | null | undefined>): string | null {
  for (const value of values) {
    const trimmed = value?.trim();
    if (trimmed) return trimmed;
  }
  return null;
}

export function parsePhotonFeature(feature: PhotonFeature, index = 0): AddressSuggestion | null {
  const p = feature.properties || {};
  const coords = feature.geometry?.coordinates;
  const longitude = Array.isArray(coords) && typeof coords[0] === 'number' ? coords[0] : null;
  const latitude = Array.isArray(coords) && typeof coords[1] === 'number' ? coords[1] : null;

  const streetLine = firstNonEmpty(
    [p.housenumber, p.street].filter(Boolean).join(' ').trim(),
    p.name,
    p.street
  );
  if (!streetLine && !p.city && !p.state) return null;

  const city = firstNonEmpty(p.city, p.locality, p.district);
  const county = firstNonEmpty(p.county, p.district !== city ? p.district : null);
  const state = firstNonEmpty(p.state);
  const stateCode = stateToCode(state);
  const postalCode = firstNonEmpty(p.postcode);
  const country = firstNonEmpty(p.country);
  const countryCode = firstNonEmpty(p.countrycode)?.toUpperCase() || null;

  const addressLine2 = null;
  const formattedParts = [
    streetLine,
    city,
    [stateCode || state, postalCode].filter(Boolean).join(' ').trim() || null,
    country && countryCode !== 'US' ? country : null
  ].filter(Boolean);

  const formattedAddress = formattedParts.join(', ');
  const detailParts = [city, stateCode || state, postalCode, country].filter(Boolean);

  const structured: StructuredAddress = {
    formattedAddress,
    addressLine1: streetLine || formattedAddress,
    addressLine2,
    city,
    county,
    state,
    stateCode,
    postalCode,
    country,
    countryCode,
    latitude,
    longitude
  };

  const osmId = p.osm_type && p.osm_id != null ? `${p.osm_type}:${p.osm_id}` : `photon-${index}`;

  return {
    ...structured,
    id: osmId,
    label: streetLine || formattedAddress,
    detail: detailParts.join(', ')
  };
}

export function parsePhotonFeatures(features: PhotonFeature[] | undefined | null): AddressSuggestion[] {
  if (!features?.length) return [];
  const seen = new Set<string>();
  const suggestions: AddressSuggestion[] = [];
  features.forEach((feature, index) => {
    const parsed = parsePhotonFeature(feature, index);
    if (!parsed) return;
    const key = parsed.formattedAddress.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    suggestions.push(parsed);
  });
  return suggestions;
}

export function filterAddressSuggestionsForQuery(
  suggestions: AddressSuggestion[],
  query: string
): AddressSuggestion[] {
  const typedHouseNumber = query.trim().match(/^(\d+[a-zA-Z]?)(?:\s|$)/)?.[1]?.toLowerCase();
  if (!typedHouseNumber) return suggestions;

  return suggestions.filter((suggestion) => {
    const suggestedHouseNumber = suggestion.addressLine1.trim().match(/^(\d+[a-zA-Z]?)(?:\s|$)/)?.[1]?.toLowerCase();
    return suggestedHouseNumber === typedHouseNumber;
  });
}

export function structuredAddressFromManual(value: string): StructuredAddress {
  const formattedAddress = value.trim();
  return {
    formattedAddress,
    addressLine1: formattedAddress,
    addressLine2: null,
    city: null,
    county: null,
    state: null,
    stateCode: null,
    postalCode: null,
    country: null,
    countryCode: null,
    latitude: null,
    longitude: null
  };
}
