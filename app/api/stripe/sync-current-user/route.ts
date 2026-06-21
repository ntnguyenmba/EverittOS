import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { createAdminSupabase } from '@/lib/supabase-admin';
import { createServerSupabase } from '@/lib/supabase-server';
import { canManageBilling, normalizeRole } from '@/lib/roles';
import { logBillingActivation } from '@/lib/billing-activation-logs';
import { syncActiveStripeSubscriptionForUser } from '@/lib/stripe-billing-sync';
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
    .select('role, email, organization_id')
    .eq('id', user.id)
    .maybeSingle();

  if (!canManageBilling(normalizeRole(profile?.role))) {
    return NextResponse.json({ error: 'Only workspace owners and admins can sync billing.' }, { status: 403 });
  }

  const email = (profile?.email || user.email).trim().toLowerCase();
  const stripe = new Stripe(stripeKey);

  console.log('SYNC_CURRENT_USER_REQUEST', { userId: user.id, email, workspaceId: profile?.organization_id || null });

  const result = await syncActiveStripeSubscriptionForUser(admin, stripe, {
    userId: user.id,
    email,
    workspaceId: profile?.organization_id || null
  });

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
