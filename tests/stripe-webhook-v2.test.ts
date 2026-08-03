import fs from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('Stripe hardened webhook', () => {
  it('keeps failed activation events retryable', () => {
    const source = fs.readFileSync('app/api/stripe/webhook-v2/route.ts', 'utf8');
    expect(source).toContain(".ilike('event_type', 'webhook.sync.ok:%')");
    expect(source).toContain(".delete()\n      .eq('stripe_event_id', event.id)");
    expect(source).toContain('Stripe should retry this event.');
    expect(source).toContain('status: 500');
  });

  it('requires successful sync for paid activation events only', () => {
    const source = fs.readFileSync('app/api/stripe/webhook-v2/route.ts', 'utf8');
    expect(source).toContain("'checkout.session.completed'");
    expect(source).toContain("'customer.subscription.created'");
    expect(source).toContain("'customer.subscription.updated'");
    expect(source).toContain("'invoice.payment_succeeded'");
    expect(source).not.toContain("'invoice.payment_failed',");
  });
});
