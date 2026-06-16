import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { createAdminSupabase } from '@/lib/supabase-admin';
import { createServerSupabase } from '@/lib/supabase-server';
import { normalizePlan, type EverittosPlan } from '@/lib/everittos-plans';
import { extractSubscriptionDiscount } from '@/lib/stripe-promo';
import { getStripeClient } from '@/lib/stripe-server';
import { isValidStripeCustomerId } from '@/lib/stripe-ids';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const ALLOWED_PLANS = ['pro', 'business', 'growth', 'enterprise'] as const;

function normalizeStripePlan(value: string | null | undefined): EverittosPlan | null {
  const normalized = normalizePlan(value);
  if (normalized === 'free') return null;
  return ALLOWED_PLANS.includes(normalized as (typeof ALLOWED_PLANS)[number]) ? normalized : null;
}

function planFromAmount(amount: number | null | undefined): EverittosPlan | null {
  const cents = amount || 0;
  if (cents === 900 || cents === 9) return 'pro';
  if (cents === 3900 || cents === 39) return 'business';
  if (cents === 14900 || cents === 149) return 'growth';
  if (cents === 39900 || cents === 399) return 'growth';
  if (cents === 79900 || cents === 799) return 'enterprise';
  return null;
}

function productPlanMetadata(product: string | Stripe.Product | Stripe.DeletedProduct | null | undefined): string | null {
  if (!product || typeof product === 'string') return null;
  if ('deleted' in product && product.deleted) return null;
  return product.metadata?.plan || null;
}

function planFromPrice(price: Stripe.Price | null | undefined): EverittosPlan | null {
  if (!price) return null;
  return (
    normalizeStripePlan(price.metadata?.plan) ||
    normalizeStripePlan(productPlanMetadata(price.product)) ||
    planFromAmount(price.unit_amount)
  );
}

function planFromSubscription(subscription: Stripe.Subscription): EverittosPlan | null {
  const direct = normalizeStripePlan(subscription.metadata?.plan);
  if (direct) return direct;

  for (const item of subscription.items.data) {
    const plan = planFromPrice(item.price);
    if (plan) return plan;
  }

  return null;
}

async function findCustomer(stripe: Stripe, email: string, profileCustomerId?: string | null) {
  if (isValidStripeCustomerId(profileCustomerId)) {
    try {
      const customer = await stripe.customers.retrieve(profileCustomerId);
      if (!('deleted' in customer && customer.deleted)) return customer;
    } catch {
      /* fall back to email */
    }
  }

  const customers = await stripe.customers.list({ email, limit: 5 });
  return customers.data[0] || null;
}

export async function POST() {
  const stripe = getStripeClient();
  const admin = createAdminSupabase();

  if (!stripe || !admin) {
    return NextResponse.json({ error: 'Stripe or Supabase admin is not configured.' }, { status: 503 });
  }

  const supabase = await createServerSupabase();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user?.email) {
    return NextResponse.json({ error: 'Not signed in.' }, { status: 401 });
  }

  const { data: profile } = await admin
    .from('profiles')
    .select('id, email, stripe_customer_id')
    .eq('id', user.id)
    .maybeSingle();

  const email = (profile?.email || user.email).trim().toLowerCase();
  const customer = await findCustomer(stripe, email, profile?.stripe_customer_id || null);

  if (!customer || ('deleted' in customer && customer.deleted)) {
    return NextResponse.json({ error: 'No Stripe customer found for this account.' }, { status: 404 });
  }

  const subscriptions = await stripe.subscriptions.list({
    customer: customer.id,
    status: 'all',
    limit: 10,
    expand: ['data.items.data.price.product', 'data.discount.coupon', 'data.discount.promotion_code']
  });

  const activeSubscription = subscriptions.data.find((sub) => sub.status === 'active' || sub.status === 'trialing');

  if (!activeSubscription) {
    return NextResponse.json({ error: 'No active Stripe subscription found for this account.' }, { status: 404 });
  }

  const plan = planFromSubscription(activeSubscription);
  if (!plan) {
    return NextResponse.json({ error: 'Active subscription found, but no matching EverittOS plan metadata was found.' }, { status: 422 });
  }

  const discount = await extractSubscriptionDiscount(stripe, activeSubscription).catch(() => undefined);
  const status = `everittos_${plan}`;
  const currentPeriodEnd = activeSubscription.current_period_end
    ? new Date(activeSubscription.current_period_end * 1000).toISOString()
    : null;

  await admin
    .from('profiles')
    .update({
      plan,
      subscription_status: status,
      stripe_customer_id: customer.id,
      ...(discount || {})
    })
    .eq('id', user.id);

  await admin.from('everittos_subscriptions').upsert(
    {
      user_id: user.id,
      email,
      plan,
      stripe_customer_id: customer.id,
      stripe_subscription_id: activeSubscription.id,
      status: 'active',
      current_period_end: currentPeriodEnd,
      updated_at: new Date().toISOString(),
      ...(discount || {})
    },
    { onConflict: 'stripe_subscription_id' }
  );

  return NextResponse.json({ ok: true, plan, status, subscriptionId: activeSubscription.id });
}
