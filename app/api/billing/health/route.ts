import { NextResponse } from 'next/server';
import { createAdminSupabase } from '@/lib/supabase-admin';
import { createServerSupabase } from '@/lib/supabase-server';
import { normalizePlan } from '@/lib/everittos-plans';
import { isValidStripeCustomerId, isValidStripeSubscriptionId } from '@/lib/stripe-ids';
import { canManageBilling, normalizeRole } from '@/lib/roles';
import { isPaidCheckoutPlan, stripePriceIdForPlan } from '@/lib/stripe-prices';
import type { EverittosPlan } from '@/lib/everittos-plans';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const supabase = await createServerSupabase();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('id, email, role, plan, subscription_status, stripe_customer_id, organization_id')
    .eq('id', user.id)
    .maybeSingle();

  if (!canManageBilling(normalizeRole(profile?.role))) {
    return NextResponse.json({ error: 'Only workspace owners and admins can view billing health.' }, { status: 403 });
  }

  const admin = createAdminSupabase();
  if (!admin) {
    return NextResponse.json({ error: 'Billing health is temporarily unavailable.' }, { status: 503 });
  }

  const email = (profile?.email || user.email).trim().toLowerCase();
  const plan = normalizePlan(profile?.plan);

  const { data: subscription } = await admin
    .from('everittos_subscriptions')
    .select(
      'plan, status, stripe_customer_id, stripe_subscription_id, stripe_price_id, current_period_end, updated_at, last_payment_status'
    )
    .eq('user_id', user.id)
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  const { data: webhookEvents } = await admin
    .from('subscription_events')
    .select('event_type, plan, stripe_event_id, payload, created_at')
    .ilike('email', email)
    .ilike('event_type', 'webhook.sync.%')
    .order('created_at', { ascending: false })
    .limit(1);

  const latestWebhook = webhookEvents?.[0] || null;
  const payload = (latestWebhook?.payload || {}) as {
    success?: boolean;
    reason?: string | null;
    eventType?: string;
  };

  const stripeConfigured = Boolean(process.env.STRIPE_SECRET_KEY?.trim());
  const webhookConfigured = Boolean(process.env.STRIPE_WEBHOOK_SECRET?.trim());
  const checkoutConfigured = (['pro', 'business', 'operations', 'growth', 'enterprise'] as EverittosPlan[]).some(
    (tier) => isPaidCheckoutPlan(tier) && Boolean(stripePriceIdForPlan(tier))
  );

  const profileCustomerId = isValidStripeCustomerId(profile?.stripe_customer_id) ? profile?.stripe_customer_id : null;
  const subscriptionCustomerId = isValidStripeCustomerId(subscription?.stripe_customer_id)
    ? subscription?.stripe_customer_id
    : null;
  const subscriptionId = isValidStripeSubscriptionId(subscription?.stripe_subscription_id)
    ? subscription?.stripe_subscription_id
    : null;

  const issues: string[] = [];
  if (!stripeConfigured) issues.push('missing_stripe_secret_key');
  if (!webhookConfigured) issues.push('missing_stripe_webhook_secret');
  if (!checkoutConfigured) issues.push('missing_stripe_price_id');
  if (!profileCustomerId) issues.push('missing_stripe_customer_id');
  if (plan !== 'free' && !subscriptionId) issues.push('missing_stripe_subscription_id');
  if (latestWebhook && payload.success === false) issues.push(`webhook_sync_failed:${payload.reason || 'unknown'}`);

  return NextResponse.json({
    profile: {
      plan,
      subscriptionStatus: profile?.subscription_status || 'free',
      stripeCustomerId: profileCustomerId
    },
    subscription: subscription
      ? {
          plan: normalizePlan(subscription.plan),
          status: subscription.status,
          stripeCustomerId: subscriptionCustomerId,
          stripeSubscriptionId: subscriptionId,
          stripePriceId: subscription.stripe_price_id,
          currentPeriodEnd: subscription.current_period_end,
          lastPaymentStatus: subscription.last_payment_status,
          updatedAt: subscription.updated_at
        }
      : null,
    latestWebhookSync: latestWebhook
      ? {
          eventType: latestWebhook.event_type,
          stripeEventId: latestWebhook.stripe_event_id,
          plan: latestWebhook.plan,
          success: payload.success ?? latestWebhook.event_type.startsWith('webhook.sync.ok:'),
          reason: payload.reason || null,
          sourceEvent: payload.eventType || null,
          syncedAt: latestWebhook.created_at
        }
      : null,
    stripe: {
      configured: stripeConfigured,
      webhookConfigured,
      checkoutConfigured
    },
    issues,
    healthy: issues.length === 0
  });
}
