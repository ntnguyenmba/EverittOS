import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { createAdminSupabase } from '@/lib/supabase-admin';
import { createServerSupabase } from '@/lib/supabase-server';
import { canManageBilling } from '@/lib/roles';
import { resolveWorkspaceRoleForUser } from '@/lib/organization-server';
import { logBillingActivation } from '@/lib/billing-activation-logs';
import {
  pickBestStripeSubscription,
  syncActiveStripeSubscriptionForUser,
  syncStripeSubscriptionRecord
} from '@/lib/stripe-billing-sync';
import { planFromSubscription, primaryStripePriceId } from '@/lib/stripe-plan-mapping';
import { isPaidPlanActive } from '@/lib/workspace-subscription';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST() {
  const stripeKey = process.env.STRIPE_SECRET_KEY;
  const admin = createAdminSupabase();

  if (!stripeKey || !admin) {
    return NextResponse.json({ error: 'Stripe or Supabase admin is not configured.' }, { status: 503 });
  }

  const supabase = await createServerSupabase();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user?.email) {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, email, organization_id, stripe_customer_id')
    .eq('id', user.id)
    .maybeSingle();

  const role = await resolveWorkspaceRoleForUser(supabase, user.id, profile?.role);
  if (!canManageBilling(role)) {
    return NextResponse.json({ error: 'Only workspace owners and admins can sync billing.' }, { status: 403 });
  }

  const email = (profile?.email || user.email).trim().toLowerCase();
  const workspaceId = profile?.organization_id || null;
  const stripe = new Stripe(stripeKey);

  console.log('SYNC_CURRENT_USER_REQUEST', { userId: user.id, email, workspaceId });

  let result;
  try {
    result = await syncActiveStripeSubscriptionForUser(admin, stripe, {
      userId: user.id,
      email,
      workspaceId
    });
  } catch (error) {
    // Stripe list endpoints reject deeply nested expansions. Recover by listing
    // subscriptions without expansions, then let the single-subscription sync
    // retrieve the detail it needs at a supported expansion depth.
    const message = error instanceof Error ? error.message : String(error);
    if (!message.includes('expand more than 4 levels')) throw error;

    const customerIds = new Set<string>();
    if (profile?.stripe_customer_id) customerIds.add(profile.stripe_customer_id);
    const customers = await stripe.customers.list({ email, limit: 10 });
    for (const customer of customers.data) {
      if (!customer.deleted) customerIds.add(customer.id);
    }

    let best: Stripe.Subscription | null = null;
    for (const customerId of customerIds) {
      const subscriptions = await stripe.subscriptions.list({ customer: customerId, status: 'all', limit: 20 });
      const candidate = pickBestStripeSubscription(subscriptions.data);
      if (candidate && (!best || candidate.created > best.created)) best = candidate;
    }

    if (!best) {
      result = {
        synced: false,
        plan: 'free' as const,
        status: 'free',
        stripeCustomerId: null,
        stripeSubscriptionId: null,
        stripePriceId: null,
        currentPeriodEnd: null,
        reason: 'no_stripe_subscription'
      };
    } else {
      const syncResult = await syncStripeSubscriptionRecord(admin, stripe, best, {
        sessionUserId: user.id,
        profileId: user.id,
        email,
        workspaceId
      });
      const plan = planFromSubscription(best) || 'free';
      result = {
        synced: syncResult.ok,
        plan,
        status: best.status,
        stripeCustomerId: typeof best.customer === 'string' ? best.customer : best.customer?.id || null,
        stripeSubscriptionId: best.id,
        stripePriceId: primaryStripePriceId(best),
        currentPeriodEnd: best.current_period_end ? new Date(best.current_period_end * 1000).toISOString() : null,
        reason: syncResult.ok ? undefined : syncResult.error || 'subscription_sync_failed',
        writes: syncResult.writes,
        error: syncResult.error
      };
    }
  }

  if (!result.synced) {
    logBillingActivation('CHECKOUT_RETURN_SYNC_FAILED', {
      userId: user.id,
      reason: result.reason || 'sync_failed',
      email,
      writes: result.writes,
      error: result.error
    });
    return NextResponse.json({
      updated: false,
      synced: false,
      message:
        result.reason === 'no_stripe_subscription'
          ? 'No active Stripe subscription found for this billing account.'
          : result.error || 'Stripe subscription found but could not sync to EverittOS.',
      reason: result.reason,
      error: result.error,
      writes: result.writes || [],
      matchedStripeCustomerId: result.stripeCustomerId,
      matchedSubscriptionId: result.stripeSubscriptionId,
      matchedPriceId: result.stripePriceId
    });
  }

  await admin.from('subscription_events').insert({
    email,
    event_type: 'manual.subscription.sync_current_user',
    plan: result.plan,
    stripe_event_id: `manual_sync_${user.id}_${Date.now()}`,
    payload: {
      stripeCustomerId: result.stripeCustomerId,
      stripeSubscriptionId: result.stripeSubscriptionId,
      stripePriceId: result.stripePriceId,
      status: result.status,
      writes: result.writes
    }
  });

  logBillingActivation('CHECKOUT_RETURN_SYNC', {
    userId: user.id,
    plan: result.plan,
    status: result.status,
    stripeCustomerId: result.stripeCustomerId,
    stripeSubscriptionId: result.stripeSubscriptionId,
    stripePriceId: result.stripePriceId,
    email,
    writes: result.writes
  });

  return NextResponse.json({
    updated: true,
    synced: true,
    plan: result.plan,
    status: result.status,
    active: isPaidPlanActive(result.plan, result.status),
    stripeCustomerId: result.stripeCustomerId,
    stripeSubscriptionId: result.stripeSubscriptionId,
    stripePriceId: result.stripePriceId,
    currentPeriodEnd: result.currentPeriodEnd,
    writes: result.writes || []
  });
}
