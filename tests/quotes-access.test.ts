import test from 'node:test';
import assert from 'node:assert/strict';
import { canShowNavHref } from '@/lib/nav-access';
import { meetsMinimumPlan } from '@/lib/plan-access';
import {
  DEFAULT_PRICING_HELPER_SETTINGS,
  normalizePricingHelperSettings,
  calculatePricingHelper,
} from '@/lib/pricing-helper';
import { resolveMarketCountry, marketSourcesForCountry } from '@/lib/market-context';

test('Quotes is visible only to owner and admin roles', () => {
  assert.equal(canShowNavHref('owner', '/pricing-helper'), true);
  assert.equal(canShowNavHref('admin', '/pricing-helper'), true);
  assert.equal(canShowNavHref('manager', '/pricing-helper'), false);
  assert.equal(canShowNavHref('employee', '/pricing-helper'), false);
  assert.equal(canShowNavHref('contractor', '/pricing-helper'), false);
  assert.equal(canShowNavHref('client', '/pricing-helper'), false);
  assert.equal(canShowNavHref('viewer', '/pricing-helper'), false);
});

test('pricing intelligence begins at Pro', () => {
  assert.equal(meetsMinimumPlan('free', 'pro'), false);
  assert.equal(meetsMinimumPlan('pro', 'pro'), true);
  assert.equal(meetsMinimumPlan('business', 'pro'), true);
  assert.equal(meetsMinimumPlan('starter', 'pro'), true);
  assert.equal(meetsMinimumPlan('growth', 'pro'), true);
  assert.equal(meetsMinimumPlan('enterprise', 'pro'), true);
});

test('worldwide quote settings preserve postal code', () => {
  const settings = normalizePricingHelperSettings({
    currency: 'CAD',
    market_country_code: 'CA',
    market_region: 'Ontario',
    market_city: 'Toronto',
    market_postal_code: 'M5V 3A8',
  });

  assert.equal(settings.marketCountryCode, 'CA');
  assert.equal(settings.marketRegion, 'Ontario');
  assert.equal(settings.marketCity, 'Toronto');
  assert.equal(settings.marketPostalCode, 'M5V 3A8');
  assert.equal(settings.currency, 'CAD');
});

test('known countries resolve their local currency', () => {
  assert.equal(resolveMarketCountry('Vietnam').currency, 'VND');
  assert.equal(resolveMarketCountry('Canada').currency, 'CAD');
  assert.equal(resolveMarketCountry('Germany').currency, 'EUR');
  assert.equal(resolveMarketCountry('Australia').currency, 'AUD');
});

test('countries without a dedicated source receive the global official fallback', () => {
  const sources = marketSourcesForCountry('Nigeria');
  assert.ok(sources.length > 0);
  assert.equal(sources[0].country, 'Nigeria');
  assert.match(sources[0].source, /International Labour Organization/i);
});

test('manual quote calculation remains usable without pricing intelligence history', () => {
  const settings = {
    ...DEFAULT_PRICING_HELPER_SETTINGS,
    workerHourlyCost: 25,
    desiredMargin: 35,
  };

  const result = calculatePricingHelper(
    settings,
    {
      serviceType: 'Residential cleaning',
      squareFeet: 1500,
      sizeUnit: 'square-feet',
      bedrooms: 3,
      bathrooms: 2,
      condition: 'Average / standard',
      frequency: 'One-time',
      addOns: [],
    },
    [],
  );

  assert.ok(result.low > 0);
  assert.ok(result.high >= result.low);
  assert.equal(result.historicalAverage, null);
});
