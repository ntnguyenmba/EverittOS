import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { createAdminSupabase } from '@/lib/supabase-admin';
import { createServerSupabase } from '@/lib/supabase-server';
import { type EverittosPlan } from '@/lib/everittos-plans';
import { extractSubscriptionDiscount } from '@/lib/stripe-promo';
import { planFromSubscription } from '@/lib/stripe-plan-mapping';

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
