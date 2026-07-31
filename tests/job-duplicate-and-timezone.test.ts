import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import { wallClockDateTime } from '../lib/schedule-times';
import { normalizeTimeZone } from '../lib/time-zones';

test('calendar wall-clock times keep local meaning for a job timezone', () => {
  // Job scheduled at 9:00 in Chicago should encode as that wall clock, not browser TZ.
  const chicagoStart = wallClockDateTime('2026-07-15', '09:00');
  assert.ok(chicagoStart);
  assert.match(chicagoStart || '', /2026-07-15T09:00/);
});

test('jobs without timezone normalize to a safe fallback', () => {
  assert.equal(normalizeTimeZone(null), 'America/Chicago');
  assert.equal(normalizeTimeZone(''), 'America/Chicago');
  assert.equal(normalizeTimeZone('America/New_York'), 'America/New_York');
});

test('duplicate job route excludes completion payment and media fields', () => {
  const source = readFileSync(join(process.cwd(), 'app/api/jobs/[id]/duplicate/route.ts'), 'utf8');
  assert.match(source, /status: 'new'/);
  assert.match(source, /completed_at: null/);
  assert.match(source, /requiresScheduleConfirmation: true/);
  assert.doesNotMatch(source, /invoice_id/);
  assert.doesNotMatch(source, /job_photos/);
  assert.doesNotMatch(source, /portal_token/);
});

test('job create accepts property_id and copies property timezone', () => {
  const source = readFileSync(join(process.cwd(), 'app/api/jobs/route.ts'), 'utf8');
  assert.match(source, /property_id/);
  assert.match(source, /resolvedTimeZone/);
  assert.match(source, /isMissingSchemaError/);
});
