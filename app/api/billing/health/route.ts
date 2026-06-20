import { NextResponse } from 'next/server';
import { createAdminSupabase } from '@/lib/supabase-admin';
import { createServerSupabase } from '@/lib/supabase-server';
import { billingPlanStripeDiagnostics, stripeEnvironmentDiagnostics } from '@/lib/billing-diagnostics';
import { billingRuntimeDiagnostics } from '@/lib/billing-runtime';
import { normalizePlan } from '@/lib/everittos-plans';
import { isValidStripeCustomerId, isValidStripeSubscriptionId } from '@/lib/stripe-ids';
import { canManageBilling, normalizeRole } from '@/lib/roles';
import { resolveOrganizationPlan } from '@/lib/organization-plan';
import { getStripeClient } from '@/lib/stripe-server';

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
  const orgPlan = await resolveOrganizationPlan(supabase, user.id);
  const billingUserId = orgPlan.ownerUserId || user.id;
  const envDiagnostics = stripeEnvironmentDiagnostics();
  const runtimeDiagnostics = billingRuntimeDiagnostics();
  const stripe = getStripeClient();
  const planDiagnostics = await billingPlanStripeDiagnostics(stripe);
  const checkoutConfigured = planDiagnostics.some((row) => row.checkoutAvailable);

  const { data: subscription } = await admin
    .from('everittos_subscriptions')
    .select(
      'plan, status, stripe_customer_id, stripe_subscription_id, stripe_price_id, current_period_end, updated_at, last_payment_status, email, user_id, organization_id'
    )
    .eq('user_id', billingUserId)
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  const { data: webhookReceived } = await admin
    .from('subscription_events')
    .select('event_type, stripe_event_id, created_at, payload')
    .ilike('event_type', 'webhook.claimed:%')
    .order('created_at', { ascending: false })
    .limit(1);

  const { data: webhookEvents } = await admin
    .from('subscription_events')
    .select('event_type, plan, stripe_event_id, payload, created_at')
    .ilike('email', email)
    .ilike('event_type', 'webhook.sync.%')
    .order('created_at', { ascending: false })
    .limit(1);

  const { data: checkoutFailures } = await admin
    .from('subscription_events')
    .select('event_type, plan, stripe_event_id, payload, created_at, email')
    .eq('event_type', 'checkout.failed')
    .order('created_at', { ascending: false })
    .limit(10);

  const latestWebhook = webhookEvents?.[0] || null;
  const latestWebhookReceived = webhookReceived?.[0] || null;
  const payload = (latestWebhook?.payload || {}) as {
    success?: boolean;
    reason?: string | null;
    eventType?: string;
  };

  const latestCheckoutFailure =
    (checkoutFailures || []).find((row) => row.email === email || (row.payload as { userId?: string })?.userId === user.id) ||
    null;
  const checkoutFailurePayload = (latestCheckoutFailure?.payload || {}) as {
    error?: string;
    ownerDiagnostic?: string;
    code?: string;
    priceId?: string;
    plan?: string;
  };

  const profileCustomerId = isValidStripeCustomerId(profile?.stripe_customer_id) ? profile?.stripe_customer_id : null;
  const subscriptionCustomerId = isValidStripeCustomerId(subscription?.stripe_customer_id)
    ? subscription?.stripe_customer_id
    : null;
  const subscriptionId = isValidStripeSubscriptionId(subscription?.stripe_subscription_id)
    ? subscription?.stripe_subscription_id
    : null;

  const issues: string[] = [];
  if (!envDiagnostics.stripeSecretKeyConfigured) issues.push('missing_stripe_secret_key');
  if (!envDiagnostics.stripeWebhookSecretConfigured) issues.push('missing_stripe_webhook_secret');
  if (!checkoutConfigured) issues.push('missing_stripe_price_ids');
  for (const row of planDiagnostics) {
    if (row.stripeValidated && row.validationCode && row.validationCode !== 'ok' && row.validationCode !== 'missing_env') {
      issues.push(`plan_price_invalid:${row.plan}:${row.validationCode}`);
    }
  }
  if (!profileCustomerId && !subscriptionCustomerId) issues.push('missing_stripe_customer_id');
  if (plan !== 'free' && !subscriptionId) issues.push('missing_stripe_subscription_id');
  if (orgPlan.plan !== plan && orgPlan.plan !== 'free') {
    issues.push('org_plan_mismatch');
  }
  if (latestWebhook && payload.success === false) issues.push(`webhook_sync_failed:${payload.reason || 'unknown'}`);
  if (latestCheckoutFailure) issues.push(`checkout_failed:${checkoutFailurePayload.code || 'unknown'}`);

  return NextResponse.json({
    profile: {
      plan,
      subscriptionStatus: profile?.subscription_status || 'free',
      stripeCustomerId: profileCustomerId || subscriptionCustomerId,
      billingEmail: email
    },
    organization: {
      organizationId: orgPlan.organizationId,
      ownerUserId: orgPlan.ownerUserId,
      effectivePlan: orgPlan.plan
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
          updatedAt: subscription.updated_at,
          billingEmail: subscription.email
        }
      : null,
    latestWebhookReceived: latestWebhookReceived
      ? {
          eventType: latestWebhookReceived.event_type,
          stripeEventId: latestWebhookReceived.stripe_event_id,
          receivedAt: latestWebhookReceived.created_at
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
    latestCheckoutError: latestCheckoutFailure
      ? {
          plan: latestCheckoutFailure.plan,
          error: checkoutFailurePayload.error || null,
          ownerDiagnostic: checkoutFailurePayload.ownerDiagnostic || checkoutFailurePayload.error || null,
          code: checkoutFailurePayload.code || null,
          priceId: checkoutFailurePayload.priceId || null,
          at: latestCheckoutFailure.created_at
        }
      : null,
    activationErrors: (checkoutFailures || [])
      .filter((row) => row.event_type !== 'checkout.failed')
      .map((row) => ({
        eventType: row.event_type,
        stripeEventId: row.stripe_event_id,
        plan: row.plan,
        reason: (row.payload as { reason?: string })?.reason || null,
        at: row.created_at
      })),
    diagnostics: {
      environment: envDiagnostics,
      runtime: runtimeDiagnostics,
      plans: planDiagnostics
    },
    stripe: {
      configured: envDiagnostics.stripeSecretKeyConfigured,
      publishableKeyConfigured: envDiagnostics.stripePublishableKeyConfigured,
      webhookConfigured: envDiagnostics.stripeWebhookSecretConfigured,
      checkoutConfigured,
      keyMode: envDiagnostics.stripeKeyModeLabel
    },
    issues,
    healthy: issues.length === 0
  });
}
