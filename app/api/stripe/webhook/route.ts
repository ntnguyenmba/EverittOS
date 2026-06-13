import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { createAdminSupabase } from '@/lib/supabase-admin';
import { normalizePlan, type EverittosPlan } from '@/lib/everittos-plans';
import { extractSubscriptionDiscount, type StoredCouponDiscount } from '@/lib/stripe-promo';

export const runtime = 'nodejs';

type AdminClient = NonNullable<ReturnType<typeof createAdminSupabase>>;

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
  const product =
    typeof price.product === 'string'
      ? null
      : 'deleted' in price.product && price.product.deleted
        ? null
        : price.product;
  return (
    normalizeStripePlan(price.metadata?.plan) ||
    normalizeStripePlan(product?.metadata?.plan) ||
    planFromAmount(price.unit_amount)
  );
}

async function planFromSession(stripe: Stripe, session: Stripe.Checkout.Session): Promise<EverittosPlan | null> {
  const direct =
    normalizeStripePlan(session.metadata?.plan) ||
    normalizeStripePlan(session.client_reference_id) ||
    planFromAmount(session.amount_subtotal) ||
    planFromAmount(session.amount_total);
  if (direct) return direct;

  try {
    const lineItems = await stripe.checkout.sessions.listLineItems(session.id, {
      limit: 5,
      expand: ['data.price.product']
    });

    for (const item of lineItems.data) {
      const plan = planFromPrice(item.price);
      if (plan) return plan;
    }
  } catch (error) {
    console.warn('[stripe-webhook] Could not read checkout line items', error);
  }

  return null;
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

async function customerEmail(stripe: Stripe, customer: string | Stripe.Customer | Stripe.DeletedCustomer | null): Promise<string | null> {
  if (!customer) return null;
  if (typeof customer !== 'string') {
    if ('deleted' in customer && customer.deleted) return null;
    return 'email' in customer ? customer.email || null : null;
  }

  try {
    const retrieved = await stripe.customers.retrieve(customer);
    if ('deleted' in retrieved && retrieved.deleted) return null;
    return retrieved.email || null;
  } catch (error) {
    console.warn('[stripe-webhook] Could not retrieve customer email', error);
    return null;
  }
}

async function logSubscriptionEvent(
  admin: AdminClient,
  email: string,
  eventType: string,
  plan: string | null,
  stripeEventId: string,
  payload: Record<string, unknown>
) {
  await admin
    .from('subscription_events')
    .insert({ email, event_type: eventType, plan, stripe_event_id: stripeEventId, payload })
    .catch((error) => console.warn('[stripe-webhook] Subscription event log skipped', error));
}

async function updateProfilePlan(
  admin: AdminClient,
  email: string,
  plan: EverittosPlan,
  status: string,
  stripeCustomerId: string | null,
  stripeSubscriptionId?: string | null,
  currentPeriodEnd?: number | null,
  discount?: StoredCouponDiscount
) {
  const normalizedEmail = email.trim().toLowerCase();
  const { data: profile } = await admin.from('profiles').select('id').ilike('email', normalizedEmail).maybeSingle();

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
  } else {
    console.warn('[stripe-webhook] No profile found for email', normalizedEmail);
  }

  if (stripeSubscriptionId) {
    await admin.from('everittos_subscriptions').upsert(
      {
        user_id: profile?.id || null,
        email: normalizedEmail,
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

async function syncSubscription(
  stripe: Stripe,
  admin: AdminClient,
  sub: Stripe.Subscription,
  eventId: string,
  eventType: string
) {
  const plan = planFromSubscription(sub);
  const email = sub.metadata?.email || (await customerEmail(stripe, sub.customer));

  if (!email || !plan) {
    console.warn('[stripe-webhook] Subscription sync skipped', { eventType, email: Boolean(email), plan, subscriptionId: sub.id });
    return;
  }

  const active = sub.status === 'active' || sub.status === 'trialing';
  const status = active ? `everittos_${plan}` : sub.status;
  const expandedSub = await stripe.subscriptions.retrieve(sub.id, {
    expand: ['discount.coupon', 'discount.promotion_code', 'items.data.price.product']
  });
  const discount = await extractSubscriptionDiscount(stripe, expandedSub);

  await updateProfilePlan(
    admin,
    email,
    active ? plan : 'free',
    status,
    typeof sub.customer === 'string' ? sub.customer : sub.customer.id,
    sub.id,
    sub.current_period_end,
    discount
  );
  await logSubscriptionEvent(admin, email, eventType, active ? plan : 'free', eventId, { subscription_id: sub.id });
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

  if (!signature) return NextResponse.json({ error: 'Missing stripe-signature' }, { status: 400 });

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, signature, secret);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Invalid signature';
    return NextResponse.json({ error: message }, { status: 400 });
  }

  const admin = createAdminSupabase();
  if (!admin) return NextResponse.json({ error: 'SUPABASE_SERVICE_ROLE_KEY is not configured.' }, { status: 503 });

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object as Stripe.Checkout.Session;
    const email = session.customer_details?.email || session.customer_email || (await customerEmail(stripe, session.customer));
    const plan = await planFromSession(stripe, session);

    if (email && plan) {
      const customerId = typeof session.customer === 'string' ? session.customer : session.customer?.id || null;
      const subId = typeof session.subscription === 'string' ? session.subscription : session.subscription?.id || null;
      let periodEnd: number | null = null;
      let discount: StoredCouponDiscount | undefined;

      if (subId) {
        try {
          const sub = await stripe.subscriptions.retrieve(subId, {
            expand: ['discount.coupon', 'discount.promotion_code', 'items.data.price.product']
          });
          periodEnd = sub.current_period_end;
          discount = await extractSubscriptionDiscount(stripe, sub);
        } catch (error) {
          console.warn('[stripe-webhook] Could not enrich checkout subscription', error);
        }
      }

      await updateProfilePlan(admin, email, plan, `everittos_${plan}`, customerId, subId, periodEnd, discount);
      await logSubscriptionEvent(admin, email, 'checkout.session.completed', plan, event.id, { session_id: session.id });
    } else {
      console.warn('[stripe-webhook] Checkout sync skipped', { email: Boolean(email), plan, sessionId: session.id });
    }
  }

  if (event.type === 'customer.subscription.created' || event.type === 'customer.subscription.updated') {
    await syncSubscription(stripe, admin, event.data.object as Stripe.Subscription, event.id, event.type);
  }

  if (event.type === 'customer.subscription.deleted') {
    const sub = event.data.object as Stripe.Subscription;
    const email = sub.metadata?.email || (await customerEmail(stripe, sub.customer));
    if (email) {
      await updateProfilePlan(admin, email, 'free', 'free', typeof sub.customer === 'string' ? sub.customer : sub.customer.id, sub.id);
      await admin.from('profiles').update({ subscription_status: 'canceled', plan: 'free' }).ilike('email', email.trim().toLowerCase());
      await admin
        .from('everittos_subscriptions')
        .update({ status: 'canceled', cancelled_at: new Date().toISOString() })
        .eq('stripe_subscription_id', sub.id);
      await logSubscriptionEvent(admin, email, 'subscription.deleted', 'free', event.id, { subscription_id: sub.id });
    }
  }

  if (event.type === 'invoice.payment_failed') {
    const invoice = event.data.object as Stripe.Invoice;
    const email = invoice.customer_email || (await customerEmail(stripe, invoice.customer as string | null));
    if (email) {
      await admin.from('profiles').update({ subscription_status: 'past_due' }).ilike('email', email.trim().toLowerCase());
      await admin.from('everittos_subscriptions').update({ last_payment_status: 'past_due' }).ilike('email', email.trim().toLowerCase());
      await logSubscriptionEvent(admin, email, 'invoice.payment_failed', null, event.id, { invoice_id: invoice.id });
    }
  }

  return NextResponse.json({ received: true });
}
