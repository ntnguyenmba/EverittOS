import assert from 'node:assert/strict';
import test from 'node:test';
import { logBillingActivation } from '@/lib/billing-activation-logs';

test('logBillingActivation emits structured activation tags', () => {
  const original = console.log;
  const lines: unknown[][] = [];
  console.log = (...args: unknown[]) => {
    lines.push(args);
  };

  try {
    logBillingActivation('WEBHOOK_RECEIVED', { eventId: 'evt_123' });
    logBillingActivation('CHECKOUT_RETURN_SYNC', { plan: 'enterprise' });
    assert.equal(lines.length, 2);
    assert.equal(lines[0][0], 'WEBHOOK_RECEIVED');
    assert.deepEqual(lines[0][1], { eventId: 'evt_123' });
    assert.equal(lines[1][0], 'CHECKOUT_RETURN_SYNC');
  } finally {
    console.log = original;
  }
});
