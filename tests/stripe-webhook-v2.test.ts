import assert from 'node:assert/strict';
import fs from 'node:fs';
import { describe, it } from 'node:test';

describe('Stripe hardened webhook', () => {
  it('keeps failed activation events retryable', () => {
    const source = fs.readFileSync('app/api/stripe/webhook-v2/route.ts', 'utf8');
    assert.match(source, /\.ilike\('event_type', 'webhook\.sync\.ok:%'\)/);
    assert.match(source, /\.delete\(\)\s*\n\s*\.eq\('stripe_event_id', event\.id\)/);
    assert.match(source, /Stripe should retry this event\./);
    assert.match(source, /status:\s*500/);
  });

  it('requires successful sync for paid activation events only', () => {
    const source = fs.readFileSync('app/api/stripe/webhook-v2/route.ts', 'utf8');
    assert.match(source, /'checkout\.session\.completed'/);
    assert.match(source, /'customer\.subscription\.created'/);
    assert.match(source, /'customer\.subscription\.updated'/);
    assert.match(source, /'invoice\.payment_succeeded'/);
    assert.doesNotMatch(source, /'invoice\.payment_failed',/);
  });
});
