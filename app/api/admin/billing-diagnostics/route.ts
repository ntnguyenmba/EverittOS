import { NextResponse } from 'next/server';
import { createAdminSupabase } from '@/lib/supabase-admin';
import { createServerSupabase } from '@/lib/supabase-server';
import { billingPlanStripeDiagnostics, stripeEnvironmentDiagnostics } from '@/lib/billing-diagnostics';
import { billingRuntimeDiagnostics } from '@/lib/billing-runtime';
import { normalizePlan } from '@/lib/everittos-plans';
import { isPlatformAdminEmail } from '@/lib/platform-admin';
import { resolveOrganizationPlan } from '@/lib/organization-plan';
import { getStripeClient } from '@/lib/stripe-server';
import { isValidStripeCustomerId, isValidStripeSubscriptionId } from '@/lib/stripe-ids';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const supabase = await createServerSupabase();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user?.email || !isPlatformAdminEmail(user.email)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const admin = createAdminSupabase();
  if (!admin) {
    return NextResponse.json({ error: 'Admin client unavailable' }, { status: 503 });
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('id, email, role, plan, subscription_status, stripe_customer_id, organization_id')
    .eq('id', user.id)
    .maybeSingle();

  const orgPlan = await resolveOrganizationPlan(supabase, user.id);
  const billingUserId = orgPlan.ownerUserId || user.id;
  const envDiagnostics = stripeEnvironmentDiagnostics();
  const runtimeDiagnostics = billingRuntimeDiagnostics();
  const stripe = getStripeClient();
  const planDiagnostics = stripe ? await billingPlanStripeDiagnostics(stripe) : [];

  const { data: ownerProfile } = await admin
    .from('profiles')
    .select('id, email, plan, subscription_status, stripe_customer_id')
    .eq('id', billingUserId)
    .maybeSingle();

  const { data: organization } = orgPlan.organizationId
    ? await admin.from('organizations').select('id, name, owner_user_id, plan').eq('id', orgPlan.organizationId).maybeSingle()
    : { data: null };

  const { data: subscription } = await admin
    .from('everittos_subscriptions')
    .select(
      'plan, status, stripe_customer_id, stripe_subscription_id, stripe_price_id, current_period_end, updated_at, organization_id, user_id'
    )
    .eq('user_id', billingUserId)
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  const { data: latestWebhookClaim } = await admin
    .from('subscription_events')
    .select('event_type, stripe_event_id, created_at, payload')
    .ilike('event_type', 'webhook.claimed:%')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  const { data: latestWebhookSync } = await admin
    .from('subscription_events')
    .select('event_type, plan, stripe_event_id, payload, created_at, email')
    .ilike('event_type', 'webhook.sync.%')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  const { data: latestManualSync } = await admin
    .from('subscription_events')
    .select('event_type, plan, stripe_event_id, payload, created_at')
    .in('event_type', ['manual.subscription.refresh', 'manual.subscription.sync_current_user'])
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  const syncPayload = (latestWebhookSync?.payload || {}) as {
    success?: boolean;
    reason?: string | null;
    writes?: unknown;
  };

  return NextResponse.json({
    currentUser: {
      id: user.id,
      email: user.email,
      role: profile?.role || null
    },
    workspace: organization
      ? {
          id: organization.id,
          name: organization.name,
          ownerUserId: organization.owner_user_id,
          organizationPlanColumn: organization.plan ? normalizePlan(organization.plan) : null
        }
      : null,
    effectivePlan: orgPlan.plan,
    ownerProfile: ownerProfile
      ? {
          id: ownerProfile.id,
          email: ownerProfile.email,
          plan: normalizePlan(ownerProfile.plan),
          subscriptionStatus: ownerProfile.subscription_status,
          stripeCustomerId: isValidStripeCustomerId(ownerProfile.stripe_customer_id)
            ? ownerProfile.stripe_customer_id
            : null
        }
      : null,
    viewerProfile: {
      plan: normalizePlan(profile?.plan),
      subscriptionStatus: profile?.subscription_status || 'free',
      stripeCustomerId: isValidStripeCustomerId(profile?.stripe_customer_id) ? profile.stripe_customer_id : null
    },
    subscriptionRow: subscription
      ? {
          plan: normalizePlan(subscription.plan),
          status: subscription.status,
          stripeCustomerId: isValidStripeCustomerId(subscription.stripe_customer_id)
            ? subscription.stripe_customer_id
            : null,
          stripeSubscriptionId: isValidStripeSubscriptionId(subscription.stripe_subscription_id)
            ? subscription.stripe_subscription_id
            : null,
          stripePriceId: subscription.stripe_price_id,
          updatedAt: subscription.updated_at
        }
      : null,
    lastWebhook: latestWebhookClaim
      ? {
          eventType: latestWebhookClaim.event_type,
          stripeEventId: latestWebhookClaim.stripe_event_id,
          receivedAt: latestWebhookClaim.created_at
        }
      : null,
    lastWebhookSync: latestWebhookSync
      ? {
          eventType: latestWebhookSync.event_type,
          stripeEventId: latestWebhookSync.stripe_event_id,
          plan: latestWebhookSync.plan,
          success: syncPayload.success ?? latestWebhookSync.event_type.startsWith('webhook.sync.ok:'),
          reason: syncPayload.reason || null,
          writes: syncPayload.writes || null,
          syncedAt: latestWebhookSync.created_at
        }
      : null,
    lastManualSync: latestManualSync
      ? {
          eventType: latestManualSync.event_type,
          plan: latestManualSync.plan,
          payload: latestManualSync.payload,
          syncedAt: latestManualSync.created_at
        }
      : null,
    stripeEnvironment: envDiagnostics,
    runtime: runtimeDiagnostics,
    planPriceDiagnostics: planDiagnostics,
    webhookEndpoint: 'https://app.everittventures.com/api/stripe/webhook'
  });
}
