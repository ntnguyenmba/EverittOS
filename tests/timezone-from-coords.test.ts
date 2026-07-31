import assert from 'node:assert/strict';
import { test } from 'node:test';
import { timezoneFromCoordinates, timezoneFromCoordinatesOrDefault } from '../lib/timezone-from-coords';

test('timezoneFromCoordinates resolves Central Time for Chicago', () => {
  assert.equal(timezoneFromCoordinates(41.8781, -87.6298), 'America/Chicago');
});

test('timezoneFromCoordinates resolves Eastern Time for New York', () => {
  assert.equal(timezoneFromCoordinates(40.7128, -74.006), 'America/New_York');
});

test('timezoneFromCoordinates resolves Mountain Time for Denver', () => {
  assert.equal(timezoneFromCoordinates(39.7392, -104.9903), 'America/Denver');
});

test('timezoneFromCoordinates resolves Pacific Time for Los Angeles', () => {
  assert.equal(timezoneFromCoordinates(34.0522, -118.2437), 'America/Los_Angeles');
});

test('timezoneFromCoordinates rejects invalid coordinates and uses fallback', () => {
  assert.equal(timezoneFromCoordinates(null, null, 'America/Chicago'), 'America/Chicago');
  assert.equal(timezoneFromCoordinates(999, 999), null);
  assert.equal(timezoneFromCoordinatesOrDefault(null, null), 'America/Chicago');
});

test('existing jobs with no timezone fall back safely', () => {
  assert.equal(timezoneFromCoordinatesOrDefault(undefined, undefined, 'America/New_York'), 'America/New_York');
});
