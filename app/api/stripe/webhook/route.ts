import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { createAdminSupabase } from '@/lib/supabase-admin';
import type { EverittosPlan } from '@/lib/everittos-plans';
import { extractSubscriptionDiscount } from '@/lib/stripe-promo';
import {
  everittosStatusForSubscription,
  logBillingSync,
  resolveBillingProfile,
  resolveStripeCustomerEmail,
  syncBillingToSupabase,
  syncStripeSubscriptionRecord
} from '@/lib/stripe-billing-sync';
import { isValidStripeCustomerId } from '@/lib/stripe-ids';
import {
  planFromSession,
  planFromSubscription,
  primaryStripePriceId,
  stripePriceIdFromSession
} from '@/lib/stripe-plan-mapping';

export const runtime = 'nodejs';

type AdminClient = NonNullable<ReturnType<typeof createAdminSupabase>>;

async function customerEmail(
  stripe: Stripe,
  customer: string | Stripe.Customer | Stripe.DeletedCustomer | null
): Promise<string | null> {
  return resolveStripeCustomerEmail(stripe, customer);
}

async function logSubscriptionEvent(
  admin: AdminClient,
  email: string,
  eventType: string,
  plan: string | null,
  stripeEventId: string,
  payload: Record<string, unknown>
) {
  const { error } = await admin
    .from('subscription_events')
    .insert({ email, event_type: eventType, plan, stripe_event_id: stripeEventId, payload });
  if (error) console.warn('[stripe-webhook] Subscription event log skipped', error);
}

function metadataUserId(metadata: Stripe.Metadata | null | undefined): string | null {
  return metadata?.user_id?.trim() || metadata?.userId?.trim() || null;
}

function metadataWorkspaceId(metadata: Stripe.Metadata | null | undefined): string | null {
  return metadata?.workspace_id?.trim() || metadata?.organization_id?.trim() || null;
}

async function resolveCheckoutSessionIds(stripe: Stripe, session: Stripe.Checkout.Session) {
  let customerId = typeof session.customer === 'string' ? session.customer : session.customer?.id || null;
  let subId = typeof session.subscription === 'string' ? session.subscription : session.subscription?.id || null;

  if (!customerId || !subId) {
    const refreshed = await stripe.checkout.sessions.retrieve(session.id, {
      expand: ['customer', 'subscription']
    });
    customerId =
      customerId ||
      (typeof refreshed.customer === 'string' ? refreshed.customer : refreshed.customer?.id || null);
    subId =
      subId ||
      (typeof refreshed.subscription === 'string' ? refreshed.subscription : refreshed.subscription?.id || null);
  }

  if (!isValidStripeCustomerId(customerId) && subId) {
    const sub = await stripe.subscriptions.retrieve(subId);
    const fromSub = typeof sub.customer === 'string' ? sub.customer : sub.customer?.id || null;
    if (isValidStripeCustomerId(fromSub)) {
      customerId = fromSub;
    }
  }

  return {
    customerId: isValidStripeCustomerId(customerId) ? customerId : null,
    subId
  };
}

async function handleCheckoutCompleted(
  stripe: Stripe,
  admin: AdminClient,
  session: Stripe.Checkout.Session,
  eventId: string
) {
  const userId = metadataUserId(session.metadata);
  const workspaceId = metadataWorkspaceId(session.metadata);
  const { customerId, subId } = await resolveCheckoutSessionIds(stripe, session);
  const email =
    session.customer_details?.email ||
    session.customer_email ||
    session.metadata?.email ||
    (await customerEmail(stripe, session.customer)) ||
    (customerId ? await customerEmail(stripe, customerId) : null);

  const plan = await planFromSession(stripe, session);

  logBillingSync('checkout.session.completed', {
    sessionId: session.id,
    customerId,
    subscriptionId: subId,
    workspaceId,
    userId,
    plan,
    email: email || null
  });

  if (!email || !plan) {
    console.warn('[stripe-webhook] Checkout sync skipped', { email: Boolean(email), plan, sessionId: session.id });
    return;
  }

  if (subId) {
    const sub = await stripe.subscriptions.retrieve(subId, {
      expand: ['discount.coupon', 'discount.promotion_code', 'items.data.price.product']
    });
    await syncStripeSubscriptionRecord(admin, stripe, sub, {
      userId,
      email,
      workspaceId,
      stripeSessionId: session.id
    });
    await logSubscriptionEvent(admin, email, 'checkout.session.completed', planFromSubscription(sub), eventId, {
      session_id: session.id,
      subscription_id: subId,
      workspace_id: workspaceId
    });
    return;
  }

  let periodEnd: number | null = null;
  let cancelAtPeriodEnd = false;
  let stripeStatus: Stripe.Subscription.Status = 'active';
  let discount: Awaited<ReturnType<typeof extractSubscriptionDiscount>> | undefined;
  const stripePriceId = stripePriceIdFromSession(session);
  const effectivePlan: EverittosPlan = plan;
  const subscriptionStatus = everittosStatusForSubscription(effectivePlan, stripeStatus, cancelAtPeriodEnd);

  await syncBillingToSupabase(admin, {
    userId,
    email,
    workspaceId,
    plan: effectivePlan,
    subscriptionStatus,
    stripeCustomerId: customerId,
    stripeSubscriptionId: null,
    stripePriceId,
    stripeSessionId: session.id,
    currentPeriodEnd: periodEnd,
    cancelAtPeriodEnd,
    discount
  });

  await logSubscriptionEvent(admin, email, 'checkout.session.completed', effectivePlan, eventId, {
    session_id: session.id,
    subscription_id: null,
    workspace_id: workspaceId
  });
}

async function handleSubscriptionDeleted(
  stripe: Stripe,
  admin: AdminClient,
  sub: Stripe.Subscription,
  eventId: string
) {
  const userId = metadataUserId(sub.metadata);
  const workspaceId = metadataWorkspaceId(sub.metadata);
  const email = sub.metadata?.email || (await customerEmail(stripe, sub.customer));

  logBillingSync('customer.subscription.deleted', {
    subscriptionId: sub.id,
    customerId: typeof sub.customer === 'string' ? sub.customer : sub.customer?.id || null,
    workspaceId,
    userId,
    email: email || null
  });

  if (!email) return;

  const customerId = typeof sub.customer === 'string' ? sub.customer : sub.customer?.id || null;

  await syncBillingToSupabase(admin, {
    userId,
    email,
    workspaceId,
    plan: 'free',
    subscriptionStatus: 'canceled',
    stripeCustomerId: customerId,
    stripeSubscriptionId: sub.id,
    stripePriceId: primaryStripePriceId(sub),
    currentPeriodEnd: sub.current_period_end,
    cancelAtPeriodEnd: false,
    lastPaymentStatus: 'canceled'
  });

  await admin
    .from('everittos_subscriptions')
    .update({ status: 'canceled', cancelled_at: new Date().toISOString() })
    .eq('stripe_subscription_id', sub.id);

  await logSubscriptionEvent(admin, email, 'subscription.deleted', 'free', eventId, { subscription_id: sub.id });
}

async function handleInvoicePayment(
  admin: AdminClient,
  stripe: Stripe,
  invoice: Stripe.Invoice,
  eventId: string,
  succeeded: boolean
) {
  const subId = typeof invoice.subscription === 'string' ? invoice.subscription : invoice.subscription?.id || null;
  const email =
    invoice.customer_email ||
    (await customerEmail(stripe, invoice.customer as string | null)) ||
    null;

  logBillingSync(succeeded ? 'invoice.payment_succeeded' : 'invoice.payment_failed', {
    invoiceId: invoice.id,
    subscriptionId: subId,
    customerId: typeof invoice.customer === 'string' ? invoice.customer : invoice.customer?.id || null,
    email: email || null
  });

  if (!email) return;

  if (subId && succeeded) {
    const sub = await stripe.subscriptions.retrieve(subId, {
      expand: ['discount.coupon', 'discount.promotion_code', 'items.data.price.product']
    });
    await syncStripeSubscriptionRecord(admin, stripe, sub, { email });
    await logSubscriptionEvent(admin, email, 'invoice.payment_succeeded', planFromSubscription(sub), eventId, {
      invoice_id: invoice.id,
      subscription_id: subId
    });
    return;
  }

  if (!succeeded) {
    const profile = await resolveBillingProfile(admin, { email });
    if (profile) {
      await admin.from('profiles').update({ subscription_status: 'past_due' }).eq('id', profile.id);
    }
    await admin.from('everittos_subscriptions').update({ last_payment_status: 'past_due' }).ilike('email', email.trim().toLowerCase());
    await logSubscriptionEvent(admin, email, 'invoice.payment_failed', null, eventId, { invoice_id: invoice.id });
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

  try {
    switch (event.type) {
      case 'checkout.session.completed':
      case 'checkout.session.async_payment_succeeded':
        await handleCheckoutCompleted(stripe, admin, event.data.object as Stripe.Checkout.Session, event.id);
        break;
      case 'customer.subscription.created':
      case 'customer.subscription.updated': {
        const sub = event.data.object as Stripe.Subscription;
        logBillingSync(event.type, {
          subscriptionId: sub.id,
          customerId: typeof sub.customer === 'string' ? sub.customer : sub.customer?.id || null,
          workspaceId: metadataWorkspaceId(sub.metadata),
          userId: metadataUserId(sub.metadata),
          plan: planFromSubscription(sub),
          status: sub.status
        });
        await syncStripeSubscriptionRecord(admin, stripe, sub, {
          userId: metadataUserId(sub.metadata),
          email: sub.metadata?.email || null,
          workspaceId: metadataWorkspaceId(sub.metadata)
        });
        const syncEmail = sub.metadata?.email || (await customerEmail(stripe, sub.customer));
        if (syncEmail) {
          await logSubscriptionEvent(admin, syncEmail, event.type, planFromSubscription(sub), event.id, {
            subscription_id: sub.id
          });
        }
        break;
      }
      case 'customer.subscription.deleted':
        await handleSubscriptionDeleted(stripe, admin, event.data.object as Stripe.Subscription, event.id);
        break;
      case 'invoice.payment_succeeded':
        await handleInvoicePayment(admin, stripe, event.data.object as Stripe.Invoice, event.id, true);
        break;
      case 'invoice.payment_failed':
        await handleInvoicePayment(admin, stripe, event.data.object as Stripe.Invoice, event.id, false);
        break;
      default:
        break;
    }
  } catch (error) {
    console.error('[stripe-webhook] Handler error', event.type, error);
    return NextResponse.json({ error: 'Webhook handler failed.' }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}
