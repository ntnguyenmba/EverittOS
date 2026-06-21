import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { createAdminSupabase } from '@/lib/supabase-admin';
import { createServerSupabase } from '@/lib/supabase-server';
import { canManageBilling, normalizeRole } from '@/lib/roles';
import {
  everittosStatusForSubscription,
  logBillingSync,
  syncActiveStripeSubscriptionForUser
} from '@/lib/stripe-billing-sync';
import { logStripeBilling } from '@/lib/stripe-billing-logs';
import { logBillingActivation } from '@/lib/billing-activation-logs';
import { fetchOrganizationContextForUser } from '@/lib/organization-server';
import { isPaidPlanActive } from '@/lib/workspace-subscription';
import { planFromSession, planFromSubscription, primaryStripePriceId } from '@/lib/stripe-plan-mapping';
import type { EverittosPlan } from '@/lib/everittos-plans';

export const runtime = 'nodejs';

type AdminClient = NonNullable<ReturnType<typeof createAdminSupabase>>;

type ActivationResult = {
  synced: boolean;
  plan: EverittosPlan;
  status: string;
  stripeCustomerId: string | null;
  stripeSubscriptionId: string | null;
  currentPeriodEnd: string | null;
  reason?: string;
};

function resultJson(result: ActivationResult) {
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

async function activateCheckoutSessionDirectly(input: {
  admin: AdminClient;
  stripe: Stripe;
  userId: string;
  email: string;
  workspaceId: string | null;
  sessionId: string;
}): Promise<ActivationResult> {
  const { admin, stripe, userId, email, workspaceId, sessionId } = input;

  try {
    const session = await stripe.checkout.sessions.retrieve(sessionId, {
      expand: ['subscription', 'line_items.data.price.product']
    });
    const subId = typeof session.subscription === 'string' ? session.subscription : session.subscription?.id || null;

    logBillingActivation('CHECKOUT_DIRECT_RECOVERY_SESSION_READ', {
      userId,
      sessionId,
      paymentStatus: session.payment_status,
      subId,
      workspaceId: session.metadata?.workspace_id || session.metadata?.organization_id || workspaceId || null
    });

    if (!subId) {
      return {
        synced: false,
        plan: 'free',
        status: 'free',
        stripeCustomerId: null,
        stripeSubscriptionId: null,
        currentPeriodEnd: null,
        reason: 'checkout_session_missing_subscription'
      };
    }

    const sub = await stripe.subscriptions.retrieve(subId, {
      expand: ['items.data.price.product']
    });
    const detectedPlan = planFromSubscription(sub) || (await planFromSession(stripe, session));

    if (!detectedPlan || detectedPlan === 'free') {
      logBillingActivation('CHECKOUT_DIRECT_RECOVERY_PLAN_MISSING', {
        userId,
        sessionId,
        subId,
        priceId: primaryStripePriceId(sub),
        subscriptionMetadata: sub.metadata,
        sessionMetadata: session.metadata
      });
      return {
        synced: false,
        plan: 'free',
        status: sub.status,
        stripeCustomerId: null,
        stripeSubscriptionId: subId,
        currentPeriodEnd: sub.current_period_end ? new Date(sub.current_period_end * 1000).toISOString() : null,
        reason: 'checkout_plan_mapping_missing'
      };
    }

    const resolvedWorkspaceId = session.metadata?.workspace_id || session.metadata?.organization_id || workspaceId || null;
    const stripeCustomerId =
      typeof session.customer === 'string'
        ? session.customer
        : session.customer?.id || (typeof sub.customer === 'string' ? sub.customer : sub.customer?.id || null);
    const status = everittosStatusForSubscription(detectedPlan, sub.status, sub.cancel_at_period_end);
    const currentPeriodEnd = sub.current_period_end ? new Date(sub.current_period_end * 1000).toISOString() : null;

    const profileUpdate: Record<string, unknown> = {
      plan: detectedPlan,
      subscription_status: status
    };
    if (stripeCustomerId) profileUpdate.stripe_customer_id = stripeCustomerId;

    const { error: profileError } = await admin.from('profiles').update(profileUpdate).eq('id', userId);
    if (profileError) {
      logBillingActivation('CHECKOUT_DIRECT_RECOVERY_PROFILE_FAILED', {
        userId,
        sessionId,
        plan: detectedPlan,
        status,
        error: profileError.message,
        code: profileError.code
      });
      return {
        synced: false,
        plan: detectedPlan,
        status,
        stripeCustomerId,
        stripeSubscriptionId: subId,
        currentPeriodEnd,
        reason: 'profile_update_failed'
      };
    }

    if (resolvedWorkspaceId) {
      const { error: organizationError } = await admin
        .from('organizations')
        .update({ plan: detectedPlan })
        .eq('id', resolvedWorkspaceId);
      if (organizationError) {
        logBillingActivation('CHECKOUT_DIRECT_RECOVERY_ORG_FAILED', {
          userId,
          workspaceId: resolvedWorkspaceId,
          sessionId,
          plan: detectedPlan,
          error: organizationError.message,
          code: organizationError.code
        });
      }
    }

    const { error: subscriptionError } = await admin.from('everittos_subscriptions').upsert(
      {
        user_id: userId,
        organization_id: resolvedWorkspaceId,
        email,
        plan: detectedPlan,
        stripe_customer_id: stripeCustomerId,
        stripe_subscription_id: subId,
        stripe_price_id: primaryStripePriceId(sub),
        stripe_session_id: sessionId,
        status: status.startsWith('everittos_') ? 'active' : status,
        current_period_end: currentPeriodEnd,
        cancel_at_period_end: sub.cancel_at_period_end,
        updated_at: new Date().toISOString()
      },
      { onConflict: 'stripe_subscription_id' }
    );

    if (subscriptionError) {
      logBillingActivation('CHECKOUT_DIRECT_RECOVERY_SUBSCRIPTION_ROW_FAILED', {
        userId,
        sessionId,
        subId,
        plan: detectedPlan,
        error: subscriptionError.message,
        code: subscriptionError.code
      });
    }

    await admin.from('subscription_events').insert({
      email,
      event_type: 'manual.subscription.direct_recovery',
      plan: detectedPlan,
      stripe_event_id: `manual_direct_recovery_${userId}_${Date.now()}`,
      payload: {
        sessionId,
        stripeCustomerId,
        stripeSubscriptionId: subId,
        status,
        subscriptionRowStored: !subscriptionError
      }
    });

    logBillingActivation('CHECKOUT_DIRECT_RECOVERY_SUCCESS', {
      userId,
      sessionId,
      workspaceId: resolvedWorkspaceId,
      plan: detectedPlan,
      status,
      stripeCustomerId,
      stripeSubscriptionId: subId
    });

    return {
      synced: true,
      plan: detectedPlan,
      status,
      stripeCustomerId,
      stripeSubscriptionId: subId,
      currentPeriodEnd
    };
  } catch (error) {
    logBillingActivation('CHECKOUT_DIRECT_RECOVERY_CRASHED', {
      userId,
      sessionId,
      message: error instanceof Error ? error.message : 'Unknown direct recovery error'
    });
    return {
      synced: false,
      plan: 'free',
      status: 'free',
      stripeCustomerId: null,
      stripeSubscriptionId: null,
      currentPeriodEnd: null,
      reason: 'direct_recovery_crashed'
    };
  }
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

  let result: ActivationResult = await syncActiveStripeSubscriptionForUser(admin, stripe, {
    userId: user.id,
    email,
    workspaceId,
    sessionId: sessionId || null
  });

  if (!result.synced && sessionId) {
    logBillingActivation('CHECKOUT_RETURN_SYNC_DIRECT_RECOVERY_STARTED', {
      userId: user.id,
      sessionId,
      priorReason: result.reason || 'sync_failed',
      priorPlan: result.plan,
      priorStatus: result.status
    });
    result = await activateCheckoutSessionDirectly({ admin, stripe, userId: user.id, email, workspaceId, sessionId });
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

  return resultJson(result);
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
