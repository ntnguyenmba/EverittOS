import assert from 'node:assert/strict';
import { test } from 'node:test';
import { addressesLikelySame, normalizeAddressKey, normalizeEmailKey, normalizePhoneKey } from '../lib/address/normalize';
import { parsePhotonFeature, parsePhotonFeatures, structuredAddressFromManual } from '../lib/address/parse-photon';
import { stateToCode } from '../lib/address/types';
import { getCachedAddressSuggestions, setCachedAddressSuggestions, clearAddressSuggestionCache } from '../lib/address/photon-cache';

test('parsePhotonFeature fills structured address fields', () => {
  const suggestion = parsePhotonFeature({
    geometry: { coordinates: [-87.6298, 41.8781] },
    properties: {
      osm_type: 'N',
      osm_id: 1,
      housenumber: '233 S',
      street: 'Wacker Dr',
      city: 'Chicago',
      state: 'Illinois',
      postcode: '60606',
      country: 'United States',
      countrycode: 'us',
      county: 'Cook County'
    }
  });

  assert.ok(suggestion);
  assert.equal(suggestion?.addressLine1, '233 S Wacker Dr');
  assert.equal(suggestion?.city, 'Chicago');
  assert.equal(suggestion?.state, 'Illinois');
  assert.equal(suggestion?.stateCode, 'IL');
  assert.equal(suggestion?.postalCode, '60606');
  assert.equal(suggestion?.countryCode, 'US');
  assert.equal(suggestion?.latitude, 41.8781);
  assert.equal(suggestion?.longitude, -87.6298);
  assert.match(suggestion?.formattedAddress || '', /Chicago/);
});

test('manual address fallback keeps typed value without coordinates', () => {
  const manual = structuredAddressFromManual('12 Oak St Apt 4B, Austin, TX');
  assert.equal(manual.formattedAddress, '12 Oak St Apt 4B, Austin, TX');
  assert.equal(manual.addressLine1, '12 Oak St Apt 4B, Austin, TX');
  assert.equal(manual.latitude, null);
  assert.equal(manual.longitude, null);
});

test('parsePhotonFeatures deduplicates similar labels', () => {
  const features = parsePhotonFeatures([
    {
      geometry: { coordinates: [-74.006, 40.7128] },
      properties: { osm_type: 'N', osm_id: 1, housenumber: '1', street: 'Broadway', city: 'New York', state: 'NY', postcode: '10004', countrycode: 'us' }
    },
    {
      geometry: { coordinates: [-74.006, 40.7128] },
      properties: { osm_type: 'N', osm_id: 2, housenumber: '1', street: 'Broadway', city: 'New York', state: 'NY', postcode: '10004', countrycode: 'us' }
    }
  ]);
  assert.equal(features.length, 1);
});

test('stateToCode maps full names and abbreviations', () => {
  assert.equal(stateToCode('California'), 'CA');
  assert.equal(stateToCode('tx'), 'TX');
});

test('normalizeAddressKey preserves unit identity', () => {
  assert.notEqual(normalizeAddressKey('100 Main St Apt 1'), normalizeAddressKey('100 Main St Apt 2'));
  assert.equal(normalizeAddressKey('100 Main St, Austin'), normalizeAddressKey('100  main st austin'));
});

test('addressesLikelySame and contact normalization support duplicate detection', () => {
  assert.equal(addressesLikelySame('100 Main St', '100 main st'), true);
  assert.equal(normalizeEmailKey('A@B.com'), 'a@b.com');
  assert.equal(normalizePhoneKey('+1 (555) 010-1234'), '5550101234');
});

test('in-memory address cache stores and expires suggestions', () => {
  clearAddressSuggestionCache();
  setCachedAddressSuggestions('chi', [
    {
      id: '1',
      label: 'Chicago',
      detail: 'IL',
      formattedAddress: 'Chicago, IL',
      addressLine1: 'Chicago',
      addressLine2: null,
      city: 'Chicago',
      county: null,
      state: 'Illinois',
      stateCode: 'IL',
      postalCode: null,
      country: 'United States',
      countryCode: 'US',
      latitude: 41.8,
      longitude: -87.6
    }
  ]);
  assert.equal(getCachedAddressSuggestions('CHI')?.length, 1);
  clearAddressSuggestionCache();
  assert.equal(getCachedAddressSuggestions('chi'), null);
});
