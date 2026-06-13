import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { createAdminSupabase } from '@/lib/supabase-admin';
import { createServerSupabase } from '@/lib/supabase-server';
import { normalizePlan, type EverittosPlan } from '@/lib/everittos-plans';
import { extractSubscriptionDiscount } from '@/lib/stripe-promo';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const ALLOWED_PLANS = ['pro', 'business', 'operations', 'growth', 'enterprise'] as const;

function normalizeStripePlan(value: string | null | undefined): EverittosPlan | null {
  const raw = (value || '').trim().toLowerCase();
  if (!raw) return null;
  const normalized = normalizePlan(raw);
  if (normalized === 'free') return null;
  if (ALLOWED_PLANS.includes(normalized as (typeof ALLOWED_PLANS)[number])) return normalized;
  return null;
}

function planFromAmount(amount: number | null | undefined): EverittosPlan | null {
  const cents = amount || 0;
  if (cents === 900 || cents === 9) return 'pro';
  if (cents === 3900 || cents === 39) return 'business';
  if (cents === 14900 || cents === 149) return 'operations';
  if (cents === 39900 || cents === 399) return 'growth';
  if (cents === 79900 || cents === 799) return 'enterprise';
  return null;
}

function planFromPrice(price: Stripe.Price | null | undefined): EverittosPlan | null {
  if (!price) return null;
  const product = typeof price.product === 'string' ? null : price.product;
  return (
    normalizeStripePlan(price.metadata?.plan) ||
    normalizeStripePlan(product?.metadata?.plan) ||
    planFromAmount(price.unit_amount)
  );
}

function planFromSubscription(sub: Stripe.Subscription): EverittosPlan | null {
  const direct = normalizeStripePlan(sub.metadata?.plan);
  if (direct) return direct;

  for (const item of sub.items.data) {
    const plan = planFromPrice(item.price);
    if (plan) return plan;
  }

  return null;
}

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

  const email = user.email.trim().toLowerCase();
  const stripe = new Stripe(stripeKey);
  const customers = await stripe.customers.list({ email, limit: 10 });

  let best: {
    customerId: string;
    subscription: Stripe.Subscription;
    plan: EverittosPlan;
  } | null = null;

  for (const customer of customers.data) {
    const subs = await stripe.subscriptions.list({
      customer: customer.id,
      status: 'all',
      limit: 10,
      expand: ['data.items.data.price.product', 'data.discount.coupon', 'data.discount.promotion_code']
    });

    for (const sub of subs.data) {
      if (!['active', 'trialing', 'past_due'].includes(sub.status)) continue;
      const plan = planFromSubscription(sub);
      if (!plan) continue;
      if (!best || sub.created > best.subscription.created) {
        best = { customerId: customer.id, subscription: sub, plan };
      }
    }
  }

  if (!best) {
    return NextResponse.json({ updated: false, message: 'No active Stripe subscription found for this login email.' });
  }

  const active = best.subscription.status === 'active' || best.subscription.status === 'trialing';
  const plan = active ? best.plan : 'free';
  const status = active ? `everittos_${best.plan}` : best.subscription.status;
  const discount = await extractSubscriptionDiscount(stripe, best.subscription);

  await admin
    .from('profiles')
    .update({
      plan,
      subscription_status: status,
      stripe_customer_id: best.customerId,
      ...discount
    })
    .eq('id', user.id);

  await admin.from('everittos_subscriptions').upsert(
    {
      user_id: user.id,
      email,
      plan,
      stripe_customer_id: best.customerId,
      stripe_subscription_id: best.subscription.id,
      status: active ? 'active' : best.subscription.status,
      current_period_end: best.subscription.current_period_end
        ? new Date(best.subscription.current_period_end * 1000).toISOString()
        : null,
      updated_at: new Date().toISOString(),
      ...discount
    },
    { onConflict: 'stripe_subscription_id' }
  );

  return NextResponse.json({ updated: true, plan, status });
}
