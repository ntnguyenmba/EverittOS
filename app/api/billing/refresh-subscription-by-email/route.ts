import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { createAdminSupabase } from '@/lib/supabase-admin';
import { createServerSupabase } from '@/lib/supabase-server';
import { normalizePlan, type EverittosPlan } from '@/lib/everittos-plans';
import { canManageBilling, normalizeRole } from '@/lib/roles';
import { extractSubscriptionDiscount } from '@/lib/stripe-promo';

export const runtime = 'nodejs';

const PAID_PLANS = ['pro', 'business', 'operations', 'growth', 'enterprise'] as const;
type PaidPlan = (typeof PAID_PLANS)[number];

function normalizePaidPlan(value: string | null | undefined): PaidPlan | null {
  const raw = (value || '').trim().toLowerCase();
  if (!raw) return null;
  const normalized = normalizePlan(raw);
  if (PAID_PLANS.includes(normalized as PaidPlan)) return normalized as PaidPlan;
  return null;
}

function planFromAmount(amount: number | null | undefined): PaidPlan | null {
  const cents = amount || 0;
  if (cents === 900 || cents === 9) return 'pro';
  if (cents === 3900 || cents === 39) return 'business';
  if (cents === 14900 || cents === 149) return 'operations';
  if (cents === 39900 || cents === 399) return 'growth';
  if (cents === 79900 || cents === 799) return 'enterprise';
  return null;
}

function planFromPrice(price: Stripe.Price | null | undefined): PaidPlan | null {
  if (!price) return null;
  const product =
    typeof price.product === 'string'
      ? null
      : 'deleted' in price.product && price.product.deleted
        ? null
        : price.product;

  return normalizePaidPlan(price.metadata?.plan) || normalizePaidPlan(product?.metadata?.plan) || planFromAmount(price.unit_amount);
}

function planFromSubscription(sub: Stripe.Subscription): PaidPlan | null {
  const direct = normalizePaidPlan(sub.metadata?.plan);
  if (direct) return direct;

  for (const item of sub.items.data) {
    const plan = planFromPrice(item.price);
    if (plan) return plan;
  }

  return null;
}

function planFromSession(session: Stripe.Checkout.Session, lineItems: Stripe.ApiList<Stripe.LineItem> | null): PaidPlan | null {
  const direct =
    normalizePaidPlan(session.metadata?.plan) ||
    normalizePaidPlan(session.client_reference_id) ||
    planFromAmount(session.amount_subtotal) ||
    planFromAmount(session.amount_total);
  if (direct) return direct;

  for (const item of lineItems?.data || []) {
    const plan = planFromPrice(item.price);
    if (plan) return plan;
  }

  return null;
}

async function getBestSubscription(stripe: Stripe, customerId: string) {
  const subscriptions = await stripe.subscriptions.list({
    customer: customerId,
    status: 'all',
    limit: 20,
    expand: ['data.discount.coupon', 'data.discount.promotion_code', 'data.items.data.price.product']
  });

  return (
    subscriptions.data.find((sub) => sub.status === 'active' || sub.status === 'trialing') ||
    subscriptions.data.find((sub) => sub.status === 'past_due' || sub.status === 'unpaid') ||
    subscriptions.data[0] ||
    null
  );
}

async function getLatestCompletedCheckoutPlan(stripe: Stripe, customerId: string) {
  const sessions = await stripe.checkout.sessions.list({ customer: customerId, limit: 10 });
  for (const session of sessions.data) {
    if (session.status !== 'complete') continue;
    const lineItems = await stripe.checkout.sessions.listLineItems(session.id, {
      limit: 5,
      expand: ['data.price.product']
    });
    const plan = planFromSession(session, lineItems);
    if (plan) {
      return { session, plan };
    }
  }

  return null;
}

async function findStripeCustomerIds(stripe: Stripe, email: string, existingCustomerId?: string | null) {
  const ids = new Set<string>();
  if (existingCustomerId) ids.add(existingCustomerId);

  const customers = await stripe.customers.list({ email, limit: 20 });
  for (const customer of customers.data) {
    if (!customer.deleted) ids.add(customer.id);
  }

  return Array.from(ids);
}

async function refreshByEmail(request: Request) {
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

  const { searchParams } = new URL(request.url);
  const checkoutEmail = (searchParams.get('email') || '').trim().toLowerCase();
  if (!checkoutEmail || !checkoutEmail.includes('@')) {
    return NextResponse.json({ error: 'Add ?email=the-checkout-email-you-used.' }, { status: 400 });
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('id, email, role, stripe_customer_id')
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
  const customerIds = await findStripeCustomerIds(stripe, checkoutEmail, profile?.stripe_customer_id);
  if (customerIds.length === 0) {
    return NextResponse.json({ error: `No Stripe customer found for ${checkoutEmail}.` }, { status: 404 });
  }

  let selectedCustomerId: string | null = null;
  let selectedSubscription: Stripe.Subscription | null = null;
  let selectedPlan: PaidPlan | null = null;
  let completedCheckout: { session: Stripe.Checkout.Session; plan: PaidPlan } | null = null;

  for (const customerId of customerIds) {
    const subscription = await getBestSubscription(stripe, customerId);
    if (subscription) {
      const plan = planFromSubscription(subscription);
      if (plan) {
        selectedCustomerId = customerId;
        selectedSubscription = subscription;
        selectedPlan = plan;
        break;
      }
    }

    const checkout = await getLatestCompletedCheckoutPlan(stripe, customerId);
    if (checkout) {
      selectedCustomerId = customerId;
      completedCheckout = checkout;
      selectedPlan = checkout.plan;
      break;
    }
  }

  if (!selectedCustomerId || !selectedPlan) {
    return NextResponse.json(
      { error: `Stripe customer was found for ${checkoutEmail}, but no matching paid plan or subscription was found.` },
      { status: 404 }
    );
  }

  const active = selectedSubscription?.status === 'active' || selectedSubscription?.status === 'trialing' || Boolean(completedCheckout);
  const plan: EverittosPlan = active ? selectedPlan : 'free';
  const status = active ? `everittos_${selectedPlan}` : selectedSubscription?.status || 'free';
  const currentPeriodEnd = selectedSubscription?.current_period_end
    ? new Date(selectedSubscription.current_period_end * 1000).toISOString()
    : null;
  const discount = selectedSubscription ? await extractSubscriptionDiscount(stripe, selectedSubscription) : undefined;

  await admin
    .from('profiles')
    .update({
      plan,
      subscription_status: status,
      stripe_customer_id: selectedCustomerId,
      ...(discount || {})
    })
    .eq('id', user.id);

  if (selectedSubscription) {
    await admin.from('everittos_subscriptions').upsert(
      {
        user_id: user.id,
        email: (profile?.email || user.email).trim().toLowerCase(),
        plan,
        stripe_customer_id: selectedCustomerId,
        stripe_subscription_id: selectedSubscription.id,
        status: active ? 'active' : selectedSubscription.status,
        current_period_end: currentPeriodEnd,
        updated_at: new Date().toISOString(),
        ...(discount || {})
      },
      { onConflict: 'stripe_subscription_id' }
    );
  }

  await admin.from('subscription_events').insert({
    email: (profile?.email || user.email).trim().toLowerCase(),
    event_type: 'manual.subscription.refresh_by_checkout_email',
    plan,
    stripe_event_id: `manual_${selectedSubscription?.id || completedCheckout?.session.id || selectedCustomerId}_${Date.now()}`,
    payload: {
      checkout_email: checkoutEmail,
      customer_id: selectedCustomerId,
      subscription_id: selectedSubscription?.id || null,
      checkout_session_id: completedCheckout?.session.id || null,
      status
    }
  });

  return NextResponse.json({
    ok: true,
    plan,
    status,
    checkoutEmail,
    stripeCustomerId: selectedCustomerId,
    stripeSubscriptionId: selectedSubscription?.id || null,
    checkoutSessionId: completedCheckout?.session.id || null,
    currentPeriodEnd
  });
}

export async function GET(request: Request) {
  return refreshByEmail(request);
}

export async function POST(request: Request) {
  return refreshByEmail(request);
}
