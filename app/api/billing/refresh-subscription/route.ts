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

function planFromSubscription(sub: Stripe.Subscription): PaidPlan | null {
  const direct = normalizePaidPlan(sub.metadata?.plan);
  if (direct) return direct;

  for (const item of sub.items.data) {
    const price = item.price;
    const product =
      typeof price.product === 'string'
        ? null
        : 'deleted' in price.product && price.product.deleted
          ? null
          : price.product;
    const plan = normalizePaidPlan(price.metadata?.plan) || normalizePaidPlan(product?.metadata?.plan) || planFromAmount(price.unit_amount);
    if (plan) return plan;
  }

  return null;
}

async function findCustomerId(stripe: Stripe, email: string, existingCustomerId?: string | null) {
  if (existingCustomerId) return existingCustomerId;

  const customers = await stripe.customers.list({ email, limit: 10 });
  const activeCustomer = customers.data.find((customer) => !customer.deleted);
  return activeCustomer?.id || null;
}

async function refreshSubscription() {
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

    return NextResponse.json({ plan: 'free', status: 'free', stripeCustomerId: customerId });
  }

  const detectedPlan = planFromSubscription(subscription);
  const isActive = subscription.status === 'active' || subscription.status === 'trialing';
  const plan: EverittosPlan = isActive && detectedPlan ? detectedPlan : 'free';
  const status = isActive && detectedPlan ? `everittos_${detectedPlan}` : subscription.status;
  const discount = await extractSubscriptionDiscount(stripe, subscription);
  const currentPeriodEnd = subscription.current_period_end
    ? new Date(subscription.current_period_end * 1000).toISOString()
    : null;

  await admin
    .from('profiles')
    .update({
      plan,
      subscription_status: status,
      stripe_customer_id: customerId,
      ...(discount || {})
    })
    .eq('id', user.id);

  await admin.from('everittos_subscriptions').upsert(
    {
      user_id: user.id,
      email,
      plan,
      stripe_customer_id: customerId,
      stripe_subscription_id: subscription.id,
      status: isActive ? 'active' : subscription.status,
      current_period_end: currentPeriodEnd,
      updated_at: new Date().toISOString(),
      ...(discount || {})
    },
    { onConflict: 'stripe_subscription_id' }
  );

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
    stripeCustomerId: customerId,
    stripeSubscriptionId: subscription.id,
    currentPeriodEnd
  });
}

export async function GET() {
  return refreshSubscription();
}

export async function POST() {
  return refreshSubscription();
}
