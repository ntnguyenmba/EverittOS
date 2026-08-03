import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { createAdminSupabase } from '@/lib/supabase-admin';
import { createServerSupabase } from '@/lib/supabase-server';
import { canManageBilling } from '@/lib/roles';
import { logBillingSync, syncActiveStripeSubscriptionForUser } from '@/lib/stripe-billing-sync';
import { logStripeBilling } from '@/lib/stripe-billing-logs';
import { logBillingActivation } from '@/lib/billing-activation-logs';
import { fetchOrganizationContextForUser, resolveWorkspaceRoleForUser } from '@/lib/organization-server';
import { isPaidPlanActive } from '@/lib/workspace-subscription';

export const runtime = 'nodejs';

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function refreshSubscription(request: Request) {
  const stripeKey = process.env.STRIPE_SECRET_KEY;
  if (!stripeKey) {
    return NextResponse.json({ error: 'Stripe is not configured.' }, { status: 503 });
  }

  const supabase = await createServerSupabase();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = (await request.json().catch(() => ({}))) as { sessionId?: string; session_id?: string };
  const sessionId = (body.sessionId || body.session_id || '').trim();

  const { data: profile } = await supabase
    .from('profiles')
    .select('id, email, role, stripe_customer_id, organization_id')
    .eq('id', user.id)
    .maybeSingle();

  const role = await resolveWorkspaceRoleForUser(supabase, user.id, profile?.role);
  if (!canManageBilling(role)) {
    return NextResponse.json({ error: 'Only workspace owners and admins can refresh billing.' }, { status: 403 });
  }

  const admin = createAdminSupabase();
  if (!admin) {
    return NextResponse.json({ error: 'SUPABASE_SERVICE_ROLE_KEY is not configured.' }, { status: 503 });
  }

  const email = (profile?.email || user.email).trim().toLowerCase();
  const orgContext = await fetchOrganizationContextForUser(supabase, user.id);
  const workspaceId = profile?.organization_id || orgContext?.organizationId || null;
  const stripe = new Stripe(stripeKey);

  console.log('REFRESH_SUBSCRIPTION_REQUEST', {
    userId: user.id,
    sessionId: sessionId || null,
    workspaceId,
    email,
    profileStripeCustomerId: profile?.stripe_customer_id || null
  });

  logStripeBilling('sync:completed', {
    phase: 'refresh_subscription_requested',
    userId: user.id,
    sessionId: sessionId || null,
    workspaceId,
    email
  });

  logBillingSync('refresh_subscription_requested', {
    userId: user.id,
    sessionId: sessionId || null,
    email,
    workspaceId
  });

  let result = await syncActiveStripeSubscriptionForUser(admin, stripe, {
    userId: user.id,
    email,
    workspaceId,
    sessionId: sessionId || null
  });

  // Stripe can return the browser to EverittOS a moment before the new
  // subscription is available through all retrieval paths. Retry here on the
  // server so the UI does not depend on a client-side retry surviving a URL change.
  if (!result.synced && result.reason === 'no_stripe_subscription' && sessionId) {
    for (let attempt = 1; attempt <= 5; attempt += 1) {
      await wait(1000);
      result = await syncActiveStripeSubscriptionForUser(admin, stripe, {
        userId: user.id,
        email,
        workspaceId,
        sessionId
      });
      if (result.synced || result.reason !== 'no_stripe_subscription') break;
    }
  }

  if (!result.synced && result.reason === 'no_stripe_subscription') {
    logBillingActivation('CHECKOUT_RETURN_SYNC_FAILED', {
      userId: user.id,
      sessionId: sessionId || null,
      reason: result.reason,
      email
    });
    return NextResponse.json(
      {
        error:
          'No Stripe subscription was found for this billing account. Confirm the paid Stripe customer email matches the workspace owner login email.',
        plan: 'free',
        status: 'free',
        synced: false,
        reason: result.reason
      },
      { status: 404 }
    );
  }

  if (!result.synced) {
    logBillingActivation('CHECKOUT_RETURN_SYNC_FAILED', {
      userId: user.id,
      sessionId: sessionId || null,
      reason: result.reason || 'sync_failed',
      plan: result.plan,
      status: result.status,
      email,
      writes: result.writes,
      error: result.error
    });
    return NextResponse.json(
      {
        error: result.error || 'Stripe subscription found but activation sync failed.',
        reason: result.reason,
        plan: result.plan,
        status: result.status,
        synced: false,
        writes: result.writes || [],
        matchedStripeCustomerId: result.stripeCustomerId,
        matchedSubscriptionId: result.stripeSubscriptionId,
        matchedPriceId: result.stripePriceId
      },
      { status: 422 }
    );
  }

  await admin.from('subscription_events').insert({
    email,
    event_type: 'manual.subscription.refresh',
    plan: result.plan,
    stripe_event_id: `manual_refresh_${user.id}_${Date.now()}`,
    payload: {
      sessionId: sessionId || null,
      stripeCustomerId: result.stripeCustomerId,
      stripeSubscriptionId: result.stripeSubscriptionId,
      stripePriceId: result.stripePriceId,
      status: result.status,
      writes: result.writes
    }
  });

  logBillingActivation('CHECKOUT_RETURN_SYNC', {
    userId: user.id,
    sessionId: sessionId || null,
    plan: result.plan,
    status: result.status,
    stripeCustomerId: result.stripeCustomerId,
    stripeSubscriptionId: result.stripeSubscriptionId,
    stripePriceId: result.stripePriceId,
    email,
    writes: result.writes
  });

  return NextResponse.json({
    plan: result.plan,
    status: result.status,
    synced: true,
    active: isPaidPlanActive(result.plan, result.status),
    stripeCustomerId: result.stripeCustomerId,
    stripeSubscriptionId: result.stripeSubscriptionId,
    stripePriceId: result.stripePriceId,
    currentPeriodEnd: result.currentPeriodEnd,
    writes: result.writes || []
  });
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const sessionId = url.searchParams.get('session_id');
  if (sessionId) {
    return refreshSubscription(
      new Request(request.url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId })
      })
    );
  }
  return refreshSubscription(request);
}

export async function POST(request: Request) {
  return refreshSubscription(request);
}
