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

export type CensusAddressMatch = {
  matchedAddress?: string;
  coordinates?: { x?: number; y?: number };
  addressComponents?: {
    fromAddress?: string;
    toAddress?: string;
    streetName?: string;
    preType?: string;
    preDirection?: string;
    suffixType?: string;
    suffixDirection?: string;
    city?: string;
    state?: string;
    zip?: string;
  };
};

function firstNonEmpty(...values: Array<string | null | undefined>): string | null {
  for (const value of values) {
    const trimmed = value?.trim();
    if (trimmed) return trimmed;
  }
  return null;
}

function titleCase(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  if (!trimmed) return null;
  return trimmed
    .toLowerCase()
    .split(/\s+/)
    .map((part) => (part.length <= 2 && /^[a-z]+$/i.test(part) ? part.toUpperCase() : part.charAt(0).toUpperCase() + part.slice(1)))
    .join(' ');
}

function formatUsAddress(line1: string | null, city: string | null, stateCode: string | null, postalCode: string | null, country?: string | null, countryCode?: string | null) {
  const locality = [city, [stateCode, postalCode].filter(Boolean).join(' ').trim() || null].filter(Boolean).join(', ');
  const parts = [line1, locality || null, country && countryCode && countryCode !== 'US' ? country : null].filter(Boolean);
  return parts.join(', ');
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

  const formattedAddress = formatUsAddress(streetLine, city, stateCode || state, postalCode, country, countryCode);
  const detailParts = [city, stateCode || state, postalCode, country].filter(Boolean);

  const structured: StructuredAddress = {
    formattedAddress,
    addressLine1: streetLine || formattedAddress,
    addressLine2: null,
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

export function parseCensusMatch(match: CensusAddressMatch, typedHouseNumber?: string | null): AddressSuggestion | null {
  const components = match.addressComponents || {};
  const houseNumber = firstNonEmpty(typedHouseNumber, components.fromAddress);
  const streetName = titleCase(
    [components.preDirection, components.preType, components.streetName, components.suffixType, components.suffixDirection]
      .filter(Boolean)
      .join(' ')
  );
  const line1 = firstNonEmpty([houseNumber, streetName].filter(Boolean).join(' ').trim(), match.matchedAddress);
  const city = titleCase(components.city);
  const stateCode = stateToCode(components.state);
  const postalCode = firstNonEmpty(components.zip);
  if (!line1) return null;

  const formattedAddress = formatUsAddress(line1, city, stateCode, postalCode, 'United States', 'US');
  return {
    formattedAddress,
    addressLine1: line1,
    addressLine2: null,
    city,
    county: null,
    state: stateCode,
    stateCode,
    postalCode,
    country: 'United States',
    countryCode: 'US',
    latitude: typeof match.coordinates?.y === 'number' ? match.coordinates.y : null,
    longitude: typeof match.coordinates?.x === 'number' ? match.coordinates.x : null,
    id: `census-${formattedAddress.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`,
    label: line1,
    detail: [city, stateCode, postalCode].filter(Boolean).join(', ')
  };
}

function normalizeAddressSearchPart(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

export function filterAddressSuggestionsForQuery(
  suggestions: AddressSuggestion[],
  query: string
): AddressSuggestion[] {
  const normalizedQuery = normalizeAddressSearchPart(query);
  const typedHouseNumber = normalizedQuery.match(/^(\d+[a-z]?)(?:\s|$)/)?.[1];
  if (!typedHouseNumber) return suggestions;

  const queryWithoutHouseNumber = normalizedQuery.replace(/^\d+[a-z]?(?:\s|$)/, '').trim();
  const exactHouseNumber: AddressSuggestion[] = [];
  const sameStreet: AddressSuggestion[] = [];
  const remaining: AddressSuggestion[] = [];

  for (const suggestion of suggestions) {
    const normalizedLine = normalizeAddressSearchPart(suggestion.addressLine1);
    const suggestedHouseNumber = normalizedLine.match(/^(\d+[a-z]?)(?:\s|$)/)?.[1];
    const lineWithoutHouseNumber = normalizedLine.replace(/^\d+[a-z]?(?:\s|$)/, '').trim();

    if (suggestedHouseNumber === typedHouseNumber) {
      exactHouseNumber.push(suggestion);
    } else if (
      queryWithoutHouseNumber &&
      (lineWithoutHouseNumber.includes(queryWithoutHouseNumber) ||
        queryWithoutHouseNumber.includes(lineWithoutHouseNumber))
    ) {
      if (!suggestedHouseNumber && suggestion.addressLine1.trim()) {
        const projectedLine = `${typedHouseNumber} ${suggestion.addressLine1}`.trim();
        const projectedFormattedAddress = suggestion.formattedAddress.startsWith(suggestion.addressLine1)
          ? `${projectedLine}${suggestion.formattedAddress.slice(suggestion.addressLine1.length)}`
          : `${projectedLine}, ${suggestion.formattedAddress}`;
        sameStreet.push({
          ...suggestion,
          id: `${suggestion.id}-typed-${typedHouseNumber}`,
          label: projectedLine,
          addressLine1: projectedLine,
          formattedAddress: projectedFormattedAddress
        });
      } else {
        sameStreet.push(suggestion);
      }
    } else {
      remaining.push(suggestion);
    }
  }

  const ranked = [...exactHouseNumber, ...sameStreet, ...remaining];
  ranked.sort((a, b) => Number(Boolean(b.postalCode)) - Number(Boolean(a.postalCode)));
  return ranked;
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
