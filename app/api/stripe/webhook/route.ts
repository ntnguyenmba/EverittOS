import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { createAdminSupabase } from '@/lib/supabase-admin';
import { normalizePlan, type EverittosPlan } from '@/lib/everittos-plans';
import { extractSubscriptionDiscount, type StoredCouponDiscount } from '@/lib/stripe-promo';

export const runtime = 'nodejs';

function planFromSession(session: Stripe.Checkout.Session): EverittosPlan | null {
  const meta = (session.metadata?.plan || session.client_reference_id || '').toLowerCase();
  if (meta === 'starter') return 'operations';
  const allowed = ['pro', 'business', 'operations', 'growth', 'enterprise'] as const;
  if (allowed.includes(meta as (typeof allowed)[number])) return meta as EverittosPlan;

  const amount = session.amount_total || 0;
  if (amount === 900 || amount === 9) return 'pro';
  if (amount === 3900 || amount === 39) return 'business';
  if (amount === 14900 || amount === 149) return 'operations';
  if (amount === 39900 || amount === 399) return 'growth';
  if (amount === 79900 || amount === 799) return 'enterprise';

  return null;
}

function planFromSubscription(sub: Stripe.Subscription): EverittosPlan | null {
  const meta = (sub.metadata?.plan || '').toLowerCase();
  if (meta === 'starter') return 'operations';
  const allowed = ['pro', 'business', 'operations', 'growth', 'enterprise'] as const;
  if (allowed.includes(meta as (typeof allowed)[number])) return meta as EverittosPlan;
  return null;
}

async function logSubscriptionEvent(
  admin: NonNullable<ReturnType<typeof createAdminSupabase>>,
  email: string,
  eventType: string,
  plan: string | null,
  stripeEventId: string,
  payload: Record<string, unknown>
) {
  await admin.from('subscription_events').insert({
    email,
    event_type: eventType,
    plan,
    stripe_event_id: stripeEventId,
    payload
  });
}

async function updateProfilePlan(
  admin: NonNullable<ReturnType<typeof createAdminSupabase>>,
  email: string,
  plan: EverittosPlan,
  status: string,
  stripeCustomerId: string | null,
  stripeSubscriptionId?: string | null,
  currentPeriodEnd?: number | null,
  discount?: StoredCouponDiscount
) {
  const { data: profile } = await admin.from('profiles').select('id').eq('email', email).maybeSingle();

  if (profile?.id) {
    await admin
      .from('profiles')
      .update({
        plan,
        subscription_status: status,
        stripe_customer_id: stripeCustomerId,
        ...(discount || {})
      })
      .eq('id', profile.id);
  }

  if (stripeSubscriptionId) {
    await admin.from('everittos_subscriptions').upsert(
      {
        user_id: profile?.id || null,
        email,
        plan,
        stripe_customer_id: stripeCustomerId,
        stripe_subscription_id: stripeSubscriptionId,
        status: status.startsWith('everittos_') ? 'active' : status,
        current_period_end: currentPeriodEnd ? new Date(currentPeriodEnd * 1000).toISOString() : null,
        updated_at: new Date().toISOString(),
        ...(discount || {})
      },
      { onConflict: 'stripe_subscription_id' }
    );
  }
}

export async function POST(request: Request) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  const stripeKey = process.env.STRIPE_SECRET_KEY;

  if (!secret || !stripeKey) {
    return NextResponse.json(
      { error: 'Stripe webhook is not configured. Set STRIPE_SECRET_KEY and STRIPE_WEBHOOK_SECRET.' },
      { status: 503 }
    );
  }

  const stripe = new Stripe(stripeKey);
  const body = await request.text();
  const signature = request.headers.get('stripe-signature');

  if (!signature) {
    return NextResponse.json({ error: 'Missing stripe-signature' }, { status: 400 });
  }

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, signature, secret);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Invalid signature';
    return NextResponse.json({ error: message }, { status: 400 });
  }

  const admin = createAdminSupabase();
  if (!admin) {
    return NextResponse.json({ error: 'SUPABASE_SERVICE_ROLE_KEY is not configured.' }, { status: 503 });
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object as Stripe.Checkout.Session;
    const email = session.customer_details?.email || session.customer_email;
    const plan = planFromSession(session);

    if (email && plan) {
      const customerId = typeof session.customer === 'string' ? session.customer : session.customer?.id || null;
      const subId = typeof session.subscription === 'string' ? session.subscription : session.subscription?.id || null;
      let periodEnd: number | null = null;
      let discount: StoredCouponDiscount | undefined;
      if (subId) {
        try {
          const sub = await stripe.subscriptions.retrieve(subId, {
            expand: ['discount.coupon', 'discount.promotion_code']
          });
          periodEnd = sub.current_period_end;
          discount = await extractSubscriptionDiscount(stripe, sub);
        } catch {
          /* ignore */
        }
      }
      await updateProfilePlan(admin, email, plan, `everittos_${plan}`, customerId, subId, periodEnd, discount);
      const { data: profile } = await admin.from('profiles').select('id').eq('email', email).maybeSingle();
      await admin.from('everittos_subscriptions').upsert(
        {
          user_id: profile?.id || null,
          email,
          plan,
          stripe_customer_id: customerId,
          stripe_session_id: session.id,
          stripe_subscription_id: subId,
          status: 'active',
          current_period_end: periodEnd ? new Date(periodEnd * 1000).toISOString() : null,
          updated_at: new Date().toISOString(),
          ...(discount || {})
        },
        { onConflict: 'stripe_session_id' }
      );
    }
  }

  if (event.type === 'customer.subscription.updated') {
    const sub = event.data.object as Stripe.Subscription;
    const email = sub.metadata?.email;
    const plan = planFromSubscription(sub);
    if (email && plan) {
      const status = sub.status === 'active' || sub.status === 'trialing' ? `everittos_${plan}` : sub.status;
      const expandedSub = await stripe.subscriptions.retrieve(sub.id, {
        expand: ['discount.coupon', 'discount.promotion_code']
      });
      const discount = await extractSubscriptionDiscount(stripe, expandedSub);
      await updateProfilePlan(
        admin,
        email,
        sub.status === 'active' || sub.status === 'trialing' ? plan : 'free',
        status,
        typeof sub.customer === 'string' ? sub.customer : null,
        sub.id,
        sub.current_period_end,
        discount
      );
    }
  }

  if (event.type === 'customer.subscription.deleted') {
    const sub = event.data.object as Stripe.Subscription;
    let email = sub.metadata?.email || null;
    if (!email && typeof sub.customer === 'string') {
      try {
        const customer = await stripe.customers.retrieve(sub.customer);
        if (!customer.deleted && 'email' in customer) email = customer.email || null;
      } catch {
        /* ignore */
      }
    }
    if (email) {
      await updateProfilePlan(admin, email, 'free', 'free', typeof sub.customer === 'string' ? sub.customer : null, sub.id);
      await admin.from('profiles').update({ subscription_status: 'canceled', plan: 'free' }).eq('email', email);
      await admin
        .from('everittos_subscriptions')
        .update({ status: 'canceled', cancelled_at: new Date().toISOString() })
        .eq('stripe_subscription_id', sub.id);
      await logSubscriptionEvent(admin, email, 'subscription.deleted', 'free', event.id, { subscription_id: sub.id });
    }
  }

  if (event.type === 'invoice.payment_failed') {
    const invoice = event.data.object as Stripe.Invoice;
    const email = invoice.customer_email;
    if (email) {
      await admin.from('profiles').update({ subscription_status: 'past_due' }).eq('email', email);
      await admin.from('everittos_subscriptions').update({ last_payment_status: 'past_due' }).eq('email', email);
      await logSubscriptionEvent(admin, email, 'invoice.payment_failed', null, event.id, { invoice_id: invoice.id });
    }
  }

  return NextResponse.json({ received: true });
}
