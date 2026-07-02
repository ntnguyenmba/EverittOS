import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { transactionalEmailConfigured } from '@/lib/email-provider';
import { quickbooksConfigured, quickbooksMissingCredentialsMessage } from '@/lib/quickbooks';
import { advanceNextRunOn, isRecurringCadence } from '@/lib/recurring-invoices';
import { buildHeuristicRoute } from '@/lib/route-optimization';

describe('recurring invoices', () => {
  it('recognizes supported cadences', () => {
    assert.equal(isRecurringCadence('monthly'), true);
    assert.equal(isRecurringCadence('weekly'), true);
    assert.equal(isRecurringCadence('daily'), false);
  });

  it('advances monthly next run date', () => {
    assert.equal(advanceNextRunOn('monthly', '2026-01-15'), '2026-02-15');
  });
});

describe('email provider readiness', () => {
  it('reports not configured when env is missing', () => {
    const originalKey = process.env.RESEND_API_KEY;
    const originalFrom = process.env.EMAIL_FROM;
    delete process.env.RESEND_API_KEY;
    delete process.env.EMAIL_FROM;
    assert.equal(transactionalEmailConfigured(), false);
    process.env.RESEND_API_KEY = originalKey;
    process.env.EMAIL_FROM = originalFrom;
  });
});

describe('quickbooks configuration', () => {
  it('returns helpful message when credentials are missing', () => {
    assert.match(quickbooksMissingCredentialsMessage(), /QUICKBOOKS_CLIENT_ID/);
  });

  it('is false without env credentials', () => {
    const id = process.env.QUICKBOOKS_CLIENT_ID;
    const secret = process.env.QUICKBOOKS_CLIENT_SECRET;
    delete process.env.QUICKBOOKS_CLIENT_ID;
    delete process.env.QUICKBOOKS_CLIENT_SECRET;
    assert.equal(quickbooksConfigured(), false);
    process.env.QUICKBOOKS_CLIENT_ID = id;
    process.env.QUICKBOOKS_CLIENT_SECRET = secret;
  });
});

describe('route optimization heuristic', () => {
  it('orders jobs and flags missing addresses', () => {
    const result = buildHeuristicRoute([
      { id: 'a', title: 'B job', address: null, scheduled_start: '2026-05-01T10:00:00Z', status: 'scheduled' },
      { id: 'b', title: 'A job', address: '123 Main St, Austin, TX 78701', scheduled_start: '2026-05-01T09:00:00Z', status: 'scheduled' }
    ]);
    assert.equal(result.stops.length, 2);
    assert.equal(result.flaggedMissingAddress, 1);
    assert.equal(result.provider, 'heuristic');
  });
});
