import fs from 'node:fs';

const syncPath = 'lib/stripe-billing-sync.ts';
let source = fs.readFileSync(syncPath, 'utf8');

const oldClaim = `export async function claimStripeWebhookEvent(
  admin: AdminClient,
  eventId: string,
  eventType: string
): Promise<'claimed' | 'duplicate'> {
  const { data: existing } = await admin
    .from('subscription_events')
    .select('id')
    .eq('stripe_event_id', eventId)
    .ilike('event_type', 'webhook.claimed:%')
    .maybeSingle();

  if (existing?.id) {
    return 'duplicate';
  }

  const { error } = await admin.from('subscription_events').insert({
    email: 'stripe-webhook@system',
    event_type: \`webhook.claimed:\${eventType}\`,
    plan: null,
    stripe_event_id: eventId,
    payload: { eventType, claimedAt: new Date().toISOString() }
  });

  if (error) {
    if (error.code === '23505') return 'duplicate';
    logBillingSyncIssue('webhook_claim_insert_failed', { eventId, eventType, error: error.message });
  }

  return 'claimed';
}`;

const newClaim = `export async function claimStripeWebhookEvent(
  admin: AdminClient,
  eventId: string,
  eventType: string
): Promise<'claimed' | 'duplicate'> {
  const { data: completed } = await admin
    .from('subscription_events')
    .select('id')
    .eq('stripe_event_id', eventId)
    .ilike('event_type', 'webhook.sync.ok:%')
    .limit(1)
    .maybeSingle();

  if (completed?.id) return 'duplicate';

  // A prior attempt may have claimed the event and then failed. Remove only the
  // temporary claim so Stripe can retry until a sync.ok result is recorded.
  const { error: releaseError } = await admin
    .from('subscription_events')
    .delete()
    .eq('stripe_event_id', eventId)
    .ilike('event_type', 'webhook.claimed:%');

  if (releaseError) {
    throw new Error(\`Unable to release failed Stripe webhook claim: \${releaseError.message}\`);
  }

  const { error } = await admin.from('subscription_events').insert({
    email: 'stripe-webhook@system',
    event_type: \`webhook.claimed:\${eventType}\`,
    plan: null,
    stripe_event_id: eventId,
    payload: { eventType, claimedAt: new Date().toISOString() }
  });

  if (error) {
    if (error.code === '23505') return 'duplicate';
    throw new Error(\`Unable to claim Stripe webhook event: \${error.message}\`);
  }

  return 'claimed';
}`;

if (!source.includes(oldClaim)) throw new Error('Expected Stripe claim block was not found.');
source = source.replace(oldClaim, newClaim);

const oldFailureEnd = `  } else {
    logBillingActivation('WEBHOOK_SYNC_FAILED', {
      email: input.email,
      eventType: input.eventType,
      plan: input.plan,
      reason: input.reason || null,
      stripeEventId: input.stripeEventId,
      ...(input.details || {})
    });
  }
}`;

const newFailureEnd = `  } else {
    logBillingActivation('WEBHOOK_SYNC_FAILED', {
      email: input.email,
      eventType: input.eventType,
      plan: input.plan,
      reason: input.reason || null,
      stripeEventId: input.stripeEventId,
      ...(input.details || {})
    });

    // Payment failures are valid billing events. All other failed syncs must
    // return 500 so Stripe retries instead of leaving a paid user on Free.
    if (input.reason !== 'payment_failed') {
      throw new Error(input.reason || 'Stripe billing synchronization failed.');
    }
  }
}`;

if (!source.includes(oldFailureEnd)) throw new Error('Expected webhook result block was not found.');
source = source.replace(oldFailureEnd, newFailureEnd);
fs.writeFileSync(syncPath, source);

const test = `import fs from 'node:fs';
import { describe, expect, it } from 'vitest';
import { normalizePlan } from '@/lib/everittos-plans';
import { planFromAppleProductId, planFromGoogleProductId } from '@/lib/billing/product-catalog';

describe('billing release safety', () => {
  it.each(['free', 'pro', 'business', 'starter', 'growth', 'enterprise'])(
    'normalizes the %s plan',
    (plan) => expect(normalizePlan(plan)).toBe(plan)
  );

  it('maps configured Apple and Google products to paid plans', () => {
    process.env.NEXT_PUBLIC_IOS_PRO_MONTHLY_PRODUCT_ID = 'test.ios.pro';
    process.env.NEXT_PUBLIC_IOS_BUSINESS_MONTHLY_PRODUCT_ID = 'test.ios.business';
    process.env.NEXT_PUBLIC_ANDROID_PRO_SUBSCRIPTION_ID = 'test_android_pro';
    process.env.NEXT_PUBLIC_ANDROID_BUSINESS_SUBSCRIPTION_ID = 'test_android_business';
    expect(planFromAppleProductId('test.ios.pro')).toBe('pro');
    expect(planFromAppleProductId('test.ios.business')).toBe('business');
    expect(planFromGoogleProductId('test_android_pro')).toBe('pro');
    expect(planFromGoogleProductId('test_android_business')).toBe('business');
  });

  it('keeps failed Stripe events retryable', () => {
    const source = fs.readFileSync('lib/stripe-billing-sync.ts', 'utf8');
    expect(source).toContain(".ilike('event_type', 'webhook.sync.ok:%')");
    expect(source).toContain(".delete()\n    .eq('stripe_event_id', eventId)");
    expect(source).toContain("input.reason !== 'payment_failed'");
  });
});
`;
fs.writeFileSync('tests/billing-release-safety.test.ts', test);
