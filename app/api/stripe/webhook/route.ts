import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { createAdminSupabase } from '@/lib/supabase-admin';
import {
  everittosStatusForSubscription,
  logBillingSync,
  logBillingSyncIssue,
  recordBillingWebhookResult,
  resolveBillingProfile,
  resolveStripeCustomerEmail,
  subscriptionGrantsPaidAccess,
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
  eventId: string,
  eventType: string
) {
  const sessionUserId = metadataUserId(session.metadata);
  const workspaceId = metadataWorkspaceId(session.metadata);
  const { customerId, subId } = await resolveCheckoutSessionIds(stripe, session);
  const email =
    session.metadata?.email?.trim().toLowerCase() ||
    session.customer_details?.email?.trim().toLowerCase() ||
    session.customer_email?.trim().toLowerCase() ||
    (await customerEmail(stripe, session.customer)) ||
    (customerId ? await customerEmail(stripe, customerId) : null);

  const plan = await planFromSession(stripe, session);

  logBillingSync(eventType, {
    sessionId: session.id,
    customerId,
    subscriptionId: subId,
    workspaceId,
    sessionUserId,
    plan,
    email: email || null,
    paymentStatus: session.payment_status,
    amountTotal: session.amount_total
  });

  if (!email || !plan) {
    logBillingSyncIssue(!email ? 'missing_email' : 'missing_plan', {
      sessionId: session.id,
      customerId,
      subscriptionId: subId,
      sessionUserId
    });
    if (email) {
      await recordBillingWebhookResult(admin, {
        email,
        stripeEventId: eventId,
        eventType,
        plan,
        success: false,
        reason: !plan ? 'missing_plan' : 'missing_email'
      });
    }
    return;
  }

  if (subId) {
    const sub = await stripe.subscriptions.retrieve(subId, {
      expand: ['discount.coupon', 'discount.promotion_code', 'items.data.price.product']
    });
    const synced = await syncStripeSubscriptionRecord(admin, stripe, sub, {
      sessionUserId,
      email,
      workspaceId,
      stripeSessionId: session.id
    });
    const resolvedPlan = planFromSubscription(sub);
    await recordBillingWebhookResult(admin, {
      email,
      stripeEventId: eventId,
      eventType,
      plan: resolvedPlan,
      success: synced,
      reason: synced ? undefined : 'subscription_sync_failed',
      details: {
        session_id: session.id,
        subscription_id: subId,
        customer_id: customerId
      }
    });
    return;
  }

  const stripePriceId = stripePriceIdFromSession(session);
  const subscriptionStatus = everittosStatusForSubscription(plan, 'active', false);
  const synced = await syncBillingToSupabase(admin, {
    sessionUserId,
    email,
    workspaceId,
    plan,
    subscriptionStatus,
    stripeCustomerId: customerId,
    stripeSubscriptionId: null,
    stripePriceId,
    stripeSessionId: session.id,
    currentPeriodEnd: null,
    cancelAtPeriodEnd: false
  });

  await recordBillingWebhookResult(admin, {
    email,
    stripeEventId: eventId,
    eventType,
    plan,
    success: synced,
    reason: synced ? undefined : 'profile_sync_failed',
    details: { session_id: session.id, customer_id: customerId }
  });
}

async function handleSubscriptionEvent(
  stripe: Stripe,
  admin: AdminClient,
  sub: Stripe.Subscription,
  eventId: string,
  eventType: string
) {
  const subscriptionUserId = metadataUserId(sub.metadata);
  const workspaceId = metadataWorkspaceId(sub.metadata);
  const email = sub.metadata?.email?.trim().toLowerCase() || (await customerEmail(stripe, sub.customer));

  logBillingSync(eventType, {
    subscriptionId: sub.id,
    customerId: typeof sub.customer === 'string' ? sub.customer : sub.customer?.id || null,
    workspaceId,
    subscriptionUserId,
    plan: planFromSubscription(sub),
    status: sub.status
  });

  if (!email) {
    logBillingSyncIssue('missing_email', {
      subscriptionId: sub.id,
      subscriptionUserId,
      eventType
    });
    return;
  }

  const synced = await syncStripeSubscriptionRecord(admin, stripe, sub, {
    subscriptionUserId,
    email,
    workspaceId
  });

  await recordBillingWebhookResult(admin, {
    email,
    stripeEventId: eventId,
    eventType,
    plan: planFromSubscription(sub),
    success: synced,
    reason: synced ? undefined : 'subscription_sync_failed',
    details: { subscription_id: sub.id }
  });
}

async function handleSubscriptionDeleted(
  stripe: Stripe,
  admin: AdminClient,
  sub: Stripe.Subscription,
  eventId: string
) {
  const sessionUserId = metadataUserId(sub.metadata);
  const subscriptionUserId = metadataUserId(sub.metadata);
  const workspaceId = metadataWorkspaceId(sub.metadata);
  const email = sub.metadata?.email?.trim().toLowerCase() || (await customerEmail(stripe, sub.customer));

  logBillingSync('customer.subscription.deleted', {
    subscriptionId: sub.id,
    customerId: typeof sub.customer === 'string' ? sub.customer : sub.customer?.id || null,
    workspaceId,
    subscriptionUserId,
    email: email || null
  });

  if (!email) {
    logBillingSyncIssue('missing_email', { subscriptionId: sub.id, eventType: 'customer.subscription.deleted' });
    return;
  }

  const customerId = typeof sub.customer === 'string' ? sub.customer : sub.customer?.id || null;
  const synced = await syncBillingToSupabase(admin, {
    sessionUserId,
    subscriptionUserId,
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

  await recordBillingWebhookResult(admin, {
    email,
    stripeEventId: eventId,
    eventType: 'customer.subscription.deleted',
    plan: 'free',
    success: synced,
    reason: synced ? undefined : 'delete_sync_failed',
    details: { subscription_id: sub.id }
  });
}

async function handleInvoiceEvent(
  admin: AdminClient,
  stripe: Stripe,
  invoice: Stripe.Invoice,
  eventId: string,
  eventType: string,
  succeeded: boolean
) {
  const subId = typeof invoice.subscription === 'string' ? invoice.subscription : invoice.subscription?.id || null;
  const email =
    invoice.customer_email?.trim().toLowerCase() ||
    (await customerEmail(stripe, invoice.customer as string | null)) ||
    null;

  logBillingSync(eventType, {
    invoiceId: invoice.id,
    subscriptionId: subId,
    customerId: typeof invoice.customer === 'string' ? invoice.customer : invoice.customer?.id || null,
    email: email || null,
    amountPaid: invoice.amount_paid,
    total: invoice.total,
    status: invoice.status
  });

  if (!email) {
    logBillingSyncIssue('missing_email', { invoiceId: invoice.id, eventType });
    return;
  }

  if (subId && succeeded) {
    const sub = await stripe.subscriptions.retrieve(subId, {
      expand: ['discount.coupon', 'discount.promotion_code', 'items.data.price.product']
    });

    if (!subscriptionGrantsPaidAccess(sub) && invoice.amount_paid === 0 && invoice.total === 0) {
      logBillingSyncIssue('zero_invoice_inactive_subscription', {
        subscriptionId: subId,
        status: sub.status,
        invoiceId: invoice.id
      });
    }

    const synced = await syncStripeSubscriptionRecord(admin, stripe, sub, {
      subscriptionUserId: metadataUserId(sub.metadata),
      email: sub.metadata?.email?.trim().toLowerCase() || email
    });

    await recordBillingWebhookResult(admin, {
      email,
      stripeEventId: eventId,
      eventType,
      plan: planFromSubscription(sub),
      success: synced,
      reason: synced ? undefined : 'invoice_subscription_sync_failed',
      details: {
        invoice_id: invoice.id,
        subscription_id: subId,
        amount_paid: invoice.amount_paid,
        total: invoice.total
      }
    });
    return;
  }

  if (!succeeded) {
    const profile = await resolveBillingProfile(admin, { email });
    if (profile) {
      await admin.from('profiles').update({ subscription_status: 'past_due' }).eq('id', profile.id);
    }
    await admin
      .from('everittos_subscriptions')
      .update({ last_payment_status: 'past_due' })
      .ilike('email', email.trim().toLowerCase());
    await recordBillingWebhookResult(admin, {
      email,
      stripeEventId: eventId,
      eventType,
      plan: null,
      success: false,
      reason: 'payment_failed',
      details: { invoice_id: invoice.id }
    });
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
        await handleCheckoutCompleted(stripe, admin, event.data.object as Stripe.Checkout.Session, event.id, event.type);
        break;
      case 'customer.subscription.created':
      case 'customer.subscription.updated':
        await handleSubscriptionEvent(
          stripe,
          admin,
          event.data.object as Stripe.Subscription,
          event.id,
          event.type
        );
        break;
      case 'customer.subscription.deleted':
        await handleSubscriptionDeleted(stripe, admin, event.data.object as Stripe.Subscription, event.id);
        break;
      case 'invoice.paid':
      case 'invoice.payment_succeeded':
        await handleInvoiceEvent(admin, stripe, event.data.object as Stripe.Invoice, event.id, event.type, true);
        break;
      case 'invoice.payment_failed':
        await handleInvoiceEvent(admin, stripe, event.data.object as Stripe.Invoice, event.id, event.type, false);
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
