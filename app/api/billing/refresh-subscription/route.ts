import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { createAdminSupabase } from '@/lib/supabase-admin';
import { createServerSupabase } from '@/lib/supabase-server';
import { normalizePlan, type EverittosPlan } from '@/lib/everittos-plans';
import { canManageBilling, normalizeRole } from '@/lib/roles';
import {
  everittosStatusForSubscription,
  logBillingSync,
  syncBillingToSupabase,
  syncStripeSubscriptionRecord
} from '@/lib/stripe-billing-sync';
import { planFromSession, planFromSubscription, primaryStripePriceId } from '@/lib/stripe-plan-mapping';
import { extractSubscriptionDiscount } from '@/lib/stripe-promo';
import { isPaidPlanActive } from '@/lib/workspace-subscription';

export const runtime = 'nodejs';

async function findCustomerId(stripe: Stripe, email: string, existingCustomerId?: string | null) {
  if (existingCustomerId) return existingCustomerId;

  const customers = await stripe.customers.list({ email, limit: 10 });
  const activeCustomer = customers.data.find((customer) => !customer.deleted);
  return activeCustomer?.id || null;
}

async function refreshFromCheckoutSession(
  stripe: Stripe,
  admin: NonNullable<ReturnType<typeof createAdminSupabase>>,
  userId: string,
  sessionId: string
) {
  const session = await stripe.checkout.sessions.retrieve(sessionId, {
    expand: ['subscription', 'line_items.data.price.product']
  });

  const sessionUserId = session.metadata?.user_id || session.metadata?.userId;
  if (sessionUserId && sessionUserId !== userId) {
    return NextResponse.json({ error: 'Checkout session does not belong to this account.' }, { status: 403 });
  }

  const email = (session.customer_details?.email || session.customer_email || session.metadata?.email || '').trim().toLowerCase();
  const plan = await planFromSession(stripe, session);
  const subId = typeof session.subscription === 'string' ? session.subscription : session.subscription?.id || null;

  logBillingSync('refresh_from_session', {
    sessionId,
    userId,
    subscriptionId: subId,
    plan
  });

  if (subId) {
    const sub = await stripe.subscriptions.retrieve(subId, {
      expand: ['discount.coupon', 'discount.promotion_code', 'items.data.price.product']
    });
    await syncStripeSubscriptionRecord(admin, stripe, sub, {
      userId,
      email: email || null,
      workspaceId: session.metadata?.workspace_id || session.metadata?.organization_id || null,
      stripeSessionId: session.id
    });

    const detectedPlan = planFromSubscription(sub);
    const active = sub.status === 'active' || sub.status === 'trialing';
    const effectivePlan = active && detectedPlan ? detectedPlan : normalizePlan(plan || 'free');
    const status = everittosStatusForSubscription(effectivePlan, sub.status, sub.cancel_at_period_end);

    return NextResponse.json({
      plan: effectivePlan,
      status,
      synced: true,
      stripeCustomerId: typeof session.customer === 'string' ? session.customer : session.customer?.id || null,
      stripeSubscriptionId: subId,
      currentPeriodEnd: sub.current_period_end
        ? new Date(sub.current_period_end * 1000).toISOString()
        : null
    });
  }

  if (!email || !plan) {
    return NextResponse.json({ error: 'Checkout session is missing plan details.' }, { status: 422 });
  }

  const customerId = typeof session.customer === 'string' ? session.customer : session.customer?.id || null;
  await syncBillingToSupabase(admin, {
    userId,
    email,
    workspaceId: session.metadata?.workspace_id || session.metadata?.organization_id || null,
    plan,
    subscriptionStatus: `everittos_${plan}`,
    stripeCustomerId: customerId,
    stripeSessionId: session.id,
    stripePriceId: session.metadata?.price_id || null
  });

  return NextResponse.json({
    plan,
    status: `everittos_${plan}`,
    synced: true,
    stripeCustomerId: customerId
  });
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

  const stripe = new Stripe(stripeKey);

  if (sessionId) {
    return refreshFromCheckoutSession(stripe, admin, user.id, sessionId);
  }

  const email = (profile?.email || user.email).trim().toLowerCase();
  const customerId = await findCustomerId(stripe, email, profile?.stripe_customer_id);

  if (!customerId) {
    return NextResponse.json({ error: 'No Stripe customer was found for this account email.' }, { status: 404 });
  }

  const subscriptions = await stripe.subscriptions.list({
    customer: customerId,
    status: 'all',
    limit: 10,
    expand: ['data.discount.coupon', 'data.discount.promotion_code', 'data.items.data.price.product']
  });

  const subscription =
    subscriptions.data.find((sub) => sub.status === 'active' || sub.status === 'trialing') ||
    subscriptions.data.find((sub) => sub.status === 'past_due' || sub.status === 'unpaid') ||
    subscriptions.data[0] ||
    null;

  if (!subscription) {
    await admin
      .from('profiles')
      .update({ plan: 'free', subscription_status: 'free', stripe_customer_id: customerId })
      .eq('id', user.id);

    return NextResponse.json({ plan: 'free', status: 'free', stripeCustomerId: customerId, synced: true });
  }

  await syncStripeSubscriptionRecord(admin, stripe, subscription, {
    userId: user.id,
    email,
    workspaceId: profile?.organization_id || null
  });

  const detectedPlan = planFromSubscription(subscription);
  const active = subscription.status === 'active' || subscription.status === 'trialing';
  const plan: EverittosPlan = active && detectedPlan ? detectedPlan : detectedPlan || 'free';
  const status = everittosStatusForSubscription(plan, subscription.status, subscription.cancel_at_period_end);
  const discount = await extractSubscriptionDiscount(stripe, subscription);
  const currentPeriodEnd = subscription.current_period_end
    ? new Date(subscription.current_period_end * 1000).toISOString()
    : null;

  await admin.from('subscription_events').insert({
    email,
    event_type: 'manual.subscription.refresh',
    plan,
    stripe_event_id: `manual_${subscription.id}_${Date.now()}`,
    payload: { subscription_id: subscription.id, customer_id: customerId, status: subscription.status }
  });

  return NextResponse.json({
    plan,
    status,
    synced: true,
    active: isPaidPlanActive(plan, status),
    stripeCustomerId: customerId,
    stripeSubscriptionId: subscription.id,
    stripePriceId: primaryStripePriceId(subscription),
    currentPeriodEnd,
    cancelAtPeriodEnd: subscription.cancel_at_period_end,
    discountApplied: Boolean(discount)
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
