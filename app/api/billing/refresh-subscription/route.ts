import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { createAdminSupabase } from '@/lib/supabase-admin';
import { createServerSupabase } from '@/lib/supabase-server';
import { canManageBilling, normalizeRole } from '@/lib/roles';
import { logBillingSync, syncActiveStripeSubscriptionForUser } from '@/lib/stripe-billing-sync';
import { logStripeBilling } from '@/lib/stripe-billing-logs';
import { logBillingActivation } from '@/lib/billing-activation-logs';
import { fetchOrganizationContextForUser } from '@/lib/organization-server';
import { isPaidPlanActive } from '@/lib/workspace-subscription';

export const runtime = 'nodejs';

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

  if (!canManageBilling(normalizeRole(profile?.role))) {
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

  const result = await syncActiveStripeSubscriptionForUser(admin, stripe, {
    userId: user.id,
    email,
    workspaceId,
    sessionId: sessionId || null
  });

  if (!result.synced && result.reason === 'no_stripe_subscription') {
    logBillingActivation('CHECKOUT_RETURN_SYNC_FAILED', {
      userId: user.id,
      sessionId: sessionId || null,
      reason: result.reason,
      email
    });
    return NextResponse.json(
      {
        error: 'No Stripe subscription was found for this account email.',
        plan: 'free',
        status: 'free',
        synced: false
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
      email
    });
    return NextResponse.json(
      {
        error: 'Stripe subscription found but activation sync failed.',
        reason: result.reason,
        plan: result.plan,
        status: result.status,
        synced: false
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
      status: result.status
    }
  });

  logBillingActivation('CHECKOUT_RETURN_SYNC', {
    userId: user.id,
    sessionId: sessionId || null,
    plan: result.plan,
    status: result.status,
    stripeCustomerId: result.stripeCustomerId,
    stripeSubscriptionId: result.stripeSubscriptionId,
    email
  });

  return NextResponse.json({
    plan: result.plan,
    status: result.status,
    synced: true,
    active: isPaidPlanActive(result.plan, result.status),
    stripeCustomerId: result.stripeCustomerId,
    stripeSubscriptionId: result.stripeSubscriptionId,
    currentPeriodEnd: result.currentPeriodEnd
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
