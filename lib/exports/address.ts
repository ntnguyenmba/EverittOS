/**
 * Best-effort US-style address parsing. Does not invent missing parts.
 * Typical shapes:
 *   "123 Main St, Austin, TX 78701"
 *   "123 Main St, Suite 2, Austin, TX 78701"
 *   "Austin, TX 78701"
 */

export type AddressParts = {
  street: string;
  city: string;
  state: string;
  postalCode: string;
  cityState: string;
};

const EMPTY: AddressParts = {
  street: '',
  city: '',
  state: '',
  postalCode: '',
  cityState: ''
};

const STATE_ZIP = /^([A-Za-z]{2})\s+(\d{5}(?:-\d{4})?)$/;
const ZIP_ONLY = /^(\d{5}(?:-\d{4})?)$/;
const STATE_ONLY = /^([A-Za-z]{2})$/;

function joinCityState(city: string, state: string): string {
  if (city && state) return `${city}, ${state}`;
  return city || state || '';
}

export function parseAddressParts(address: string | null | undefined): AddressParts {
  const raw = String(address || '').trim();
  if (!raw) return { ...EMPTY };

  const parts = raw
    .split(',')
    .map((p) => p.trim())
    .filter(Boolean);

  if (parts.length === 0) return { ...EMPTY };

  if (parts.length === 1) {
    const only = parts[0];
    const zip = only.match(ZIP_ONLY);
    if (zip) {
      return { ...EMPTY, postalCode: zip[1] };
    }
    const stateZip = only.match(STATE_ZIP);
    if (stateZip) {
      return {
        street: '',
        city: '',
        state: stateZip[1].toUpperCase(),
        postalCode: stateZip[2],
        cityState: stateZip[1].toUpperCase()
      };
    }
    return { ...EMPTY, street: only };
  }

  // Last segment often "TX 78701" or just zip / state.
  const last = parts[parts.length - 1];
  let state = '';
  let postalCode = '';
  let city = '';
  let streetParts = parts.slice(0, -1);

  const stateZip = last.match(STATE_ZIP);
  if (stateZip) {
    state = stateZip[1].toUpperCase();
    postalCode = stateZip[2];
  } else if (ZIP_ONLY.test(last)) {
    postalCode = last;
    // Previous segment may be state or "City ST"
    if (streetParts.length) {
      const prev = streetParts[streetParts.length - 1];
      if (STATE_ONLY.test(prev)) {
        state = prev.toUpperCase();
        streetParts = streetParts.slice(0, -1);
      } else {
        const cityState = prev.match(/^(.+?)\s+([A-Za-z]{2})$/);
        if (cityState) {
          city = cityState[1].trim();
          state = cityState[2].toUpperCase();
          streetParts = streetParts.slice(0, -1);
        }
      }
    }
  } else if (STATE_ONLY.test(last)) {
    state = last.toUpperCase();
  } else {
    // Last segment is likely city when no state/zip pattern matched.
    city = last;
  }

  if (!city && streetParts.length >= 1) {
    // Prefer the last remaining segment as city for "street, city, ST ZIP"
    if (streetParts.length >= 2 || state || postalCode) {
      city = streetParts[streetParts.length - 1];
      streetParts = streetParts.slice(0, -1);
    }
  }

  const street = streetParts.join(', ').trim();

  return {
    street,
    city,
    state,
    postalCode,
    cityState: joinCityState(city, state)
  };
}
