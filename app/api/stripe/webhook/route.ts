import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { createAdminSupabase } from '@/lib/supabase-admin';
import {
  claimStripeWebhookEvent,
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
import { logStripeBilling } from '@/lib/stripe-billing-logs';
import { logBillingActivation } from '@/lib/billing-activation-logs';
import { logBillingPipeline } from '@/lib/billing-pipeline-log';
import { isValidStripeCustomerId } from '@/lib/stripe-ids';
import {
  planFromSession,
  planFromSubscription,
  primaryStripePriceId,
  stripePriceIdFromSession
} from '@/lib/stripe-plan-mapping';

export const runtime = 'nodejs';

type AdminClient = NonNullable<ReturnType<typeof createAdminSupabase>>;
type ReRootPlan = 'monthly' | 'yearly' | 'report' | 'free';

async function customerEmail(
  stripe: Stripe,
  customer: string | Stripe.Customer | Stripe.DeletedCustomer | null
): Promise<string | null> {
  return resolveStripeCustomerEmail(stripe, customer);
}

function metadataUserId(metadata: Stripe.Metadata | null | undefined): string | null {
  return (
    metadata?.user_id?.trim() ||
    metadata?.userId?.trim() ||
    metadata?.profile_id?.trim() ||
    null
  );
}

function metadataOwnerUserId(metadata: Stripe.Metadata | null | undefined): string | null {
  return metadata?.owner_user_id?.trim() || metadata?.ownerUserId?.trim() || null;
}

function metadataWorkspaceId(metadata: Stripe.Metadata | null | undefined): string | null {
  return metadata?.workspace_id?.trim() || metadata?.organization_id?.trim() || null;
}

function isReRootMetadata(metadata: Stripe.Metadata | null | undefined): boolean {
  return metadata?.app?.trim().toLowerCase() === 'reroot';
}

function normalizeReRootPlan(value: string | null | undefined): ReRootPlan | null {
  const plan = value?.trim().toLowerCase();
  if (plan === 'monthly' || plan === 'premium') return 'monthly';
  if (plan === 'yearly' || plan === 'annual') return 'yearly';
  if (plan === 'report' || plan === 'plan') return 'report';
  if (plan === 'free') return 'free';
  return null;
}

async function updateReRootProfile(
  admin: AdminClient,
  input: {
    userId?: string | null;
    email?: string | null;
    plan: ReRootPlan;
    eventId: string;
    eventType: string;
    stripeCustomerId?: string | null;
    stripeSubscriptionId?: string | null;
  }
): Promise<boolean> {
  const userId = input.userId?.trim() || null;
  const email = input.email?.trim().toLowerCase() || null;
  const payload = { plan: input.plan };

  let error: { message?: string } | null = null;
  let matched = false;

  if (userId) {
    const result = await admin.from('profiles').update(payload).eq('id', userId).select('id').maybeSingle();
    error = result.error;
    matched = Boolean(result.data?.id);
  }

  if (!matched && email) {
    const result = await admin
      .from('profiles')
      .update(payload)
      .ilike('email', email)
      .select('id')
      .maybeSingle();
    error = result.error;
    matched = Boolean(result.data?.id);
  }

  if (error) {
    logBillingSyncIssue('reroot_profile_update_failed', {
      eventId: input.eventId,
      eventType: input.eventType,
      userId,
      email,
      plan: input.plan,
      error: error.message || 'unknown'
    });
    throw new Error(error.message || 'ReRoot profile update failed');
  }

  if (!matched) {
    logBillingSyncIssue('reroot_profile_not_found', {
      eventId: input.eventId,
      eventType: input.eventType,
      userId,
      email,
      plan: input.plan
    });
  }

  if (email) {
    await recordBillingWebhookResult(admin, {
      email,
      stripeEventId: input.eventId,
      eventType: input.eventType,
      plan: input.plan,
      success: matched,
      reason: matched ? undefined : 'reroot_profile_not_found',
      details: {
        app: 'reroot',
        user_id: userId,
        customer_id: input.stripeCustomerId || null,
        subscription_id: input.stripeSubscriptionId || null
      }
    });
  }

  logStripeBilling(matched ? 'webhook:reroot_synced' : 'webhook:reroot_profile_missing', {
    eventId: input.eventId,
    eventType: input.eventType,
    userId,
    email,
    plan: input.plan,
    stripeCustomerId: input.stripeCustomerId || null,
    stripeSubscriptionId: input.stripeSubscriptionId || null
  }, matched ? 'info' : 'warn');

  return matched;
}

async function handleReRootCheckout(
  stripe: Stripe,
  admin: AdminClient,
  session: Stripe.Checkout.Session,
  eventId: string,
  eventType: string
): Promise<void> {
  const plan = normalizeReRootPlan(session.metadata?.plan);
  if (!plan || plan === 'free') {
    throw new Error('Invalid ReRoot plan metadata');
  }

  const customerId = typeof session.customer === 'string' ? session.customer : session.customer?.id || null;
  const subscriptionId =
    typeof session.subscription === 'string' ? session.subscription : session.subscription?.id || null;
  const email =
    session.metadata?.customer_email?.trim().toLowerCase() ||
    session.metadata?.email?.trim().toLowerCase() ||
    session.customer_details?.email?.trim().toLowerCase() ||
    session.customer_email?.trim().toLowerCase() ||
    (await customerEmail(stripe, session.customer));

  await updateReRootProfile(admin, {
    userId: metadataUserId(session.metadata),
    email,
    plan,
    eventId,
    eventType,
    stripeCustomerId: customerId,
    stripeSubscriptionId: subscriptionId
  });
}

async function handleReRootSubscription(
  stripe: Stripe,
  admin: AdminClient,
  sub: Stripe.Subscription,
  eventId: string,
  eventType: string
): Promise<void> {
  const metadataPlan = normalizeReRootPlan(sub.metadata?.plan);
  const grantsAccess = subscriptionGrantsPaidAccess(sub);
  const plan: ReRootPlan = grantsAccess ? metadataPlan || 'monthly' : 'free';
  const customerId = typeof sub.customer === 'string' ? sub.customer : sub.customer?.id || null;
  const email =
    sub.metadata?.customer_email?.trim().toLowerCase() ||
    sub.metadata?.email?.trim().toLowerCase() ||
    (await customerEmail(stripe, sub.customer));

  await updateReRootProfile(admin, {
    userId: metadataUserId(sub.metadata),
    email,
    plan,
    eventId,
    eventType,
    stripeCustomerId: customerId,
    stripeSubscriptionId: sub.id
  });
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
    if (isValidStripeCustomerId(fromSub)) customerId = fromSub;
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
  const profileId = session.metadata?.profile_id?.trim() || sessionUserId;
  const workspaceId = metadataWorkspaceId(session.metadata);
  const ownerUserId = metadataOwnerUserId(session.metadata);
  const { customerId, subId } = await resolveCheckoutSessionIds(stripe, session);
  const email =
    session.metadata?.customer_email?.trim().toLowerCase() ||
    session.metadata?.email?.trim().toLowerCase() ||
    session.customer_details?.email?.trim().toLowerCase() ||
    session.customer_email?.trim().toLowerCase() ||
    (await customerEmail(stripe, session.customer)) ||
    (customerId ? await customerEmail(stripe, customerId) : null);
  const plan = await planFromSession(stripe, session);

  logBillingPipeline('checkout_completed', {
    eventType,
    sessionId: session.id,
    userId: sessionUserId,
    profileId,
    workspaceId,
    organizationId: workspaceId,
    stripeCustomerId: customerId,
    stripeSubscriptionId: subId,
    plan,
    priceId: stripePriceIdFromSession(session),
    email: email || null,
    metadata: session.metadata
  });

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
    const syncResult = await syncStripeSubscriptionRecord(admin, stripe, sub, {
      sessionUserId,
      profileId,
      ownerUserId,
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
      success: syncResult.ok,
      reason: syncResult.ok ? undefined : syncResult.error || 'subscription_sync_failed',
      details: {
        session_id: session.id,
        subscription_id: subId,
        customer_id: customerId,
        writes: syncResult.writes
      }
    });
    return;
  }

  const stripePriceId = stripePriceIdFromSession(session);
  const subscriptionStatus = everittosStatusForSubscription(plan, 'active', false);
  const syncResult = await syncBillingToSupabase(admin, {
    sessionUserId,
    profileId,
    ownerUserId,
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
    success: syncResult.ok,
    reason: syncResult.ok ? undefined : syncResult.error || 'profile_sync_failed',
    details: { session_id: session.id, customer_id: customerId, writes: syncResult.writes }
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
  const profileId = sub.metadata?.profile_id?.trim() || subscriptionUserId;
  const workspaceId = metadataWorkspaceId(sub.metadata);
  const ownerUserId = metadataOwnerUserId(sub.metadata);
  const stripeCustomerId = typeof sub.customer === 'string' ? sub.customer : sub.customer?.id || null;
  const email =
    sub.metadata?.customer_email?.trim().toLowerCase() ||
    sub.metadata?.email?.trim().toLowerCase() ||
    (await customerEmail(stripe, sub.customer));

  logBillingPipeline('subscription_found', {
    eventType,
    subscriptionId: sub.id,
    stripeCustomerId,
    workspaceId,
    subscriptionUserId,
    profileId,
    plan: planFromSubscription(sub),
    status: sub.status
  });

  logBillingSync(eventType, {
    subscriptionId: sub.id,
    customerId: stripeCustomerId,
    workspaceId,
    subscriptionUserId,
    plan: planFromSubscription(sub),
    status: sub.status
  });

  if (!email) {
    logBillingSyncIssue('missing_email', { subscriptionId: sub.id, subscriptionUserId, eventType });
    return;
  }

  const syncResult = await syncStripeSubscriptionRecord(admin, stripe, sub, {
    subscriptionUserId,
    profileId,
    ownerUserId,
    email,
    workspaceId
  });

  await recordBillingWebhookResult(admin, {
    email,
    stripeEventId: eventId,
    eventType,
    plan: planFromSubscription(sub),
    success: syncResult.ok,
    reason: syncResult.ok ? undefined : syncResult.error || 'subscription_sync_failed',
    details: { subscription_id: sub.id, customer_id: stripeCustomerId, writes: syncResult.writes }
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
  const ownerUserId = metadataOwnerUserId(sub.metadata);
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
  const syncResult = await syncBillingToSupabase(admin, {
    sessionUserId,
    subscriptionUserId,
    profileId: sub.metadata?.profile_id?.trim() || sessionUserId,
    ownerUserId,
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
    success: syncResult.ok,
    reason: syncResult.ok ? undefined : syncResult.error || 'delete_sync_failed',
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

    if (isReRootMetadata(sub.metadata)) {
      await handleReRootSubscription(stripe, admin, sub, eventId, eventType);
      return;
    }

    if (!subscriptionGrantsPaidAccess(sub) && invoice.amount_paid === 0 && invoice.total === 0) {
      logBillingSyncIssue('zero_invoice_inactive_subscription', {
        subscriptionId: subId,
        status: sub.status,
        invoiceId: invoice.id
      });
    }

    const syncResult = await syncStripeSubscriptionRecord(admin, stripe, sub, {
      subscriptionUserId: metadataUserId(sub.metadata),
      profileId: sub.metadata?.profile_id?.trim() || metadataUserId(sub.metadata),
      ownerUserId: metadataOwnerUserId(sub.metadata),
      email:
        sub.metadata?.customer_email?.trim().toLowerCase() ||
        sub.metadata?.email?.trim().toLowerCase() ||
        email,
      workspaceId: metadataWorkspaceId(sub.metadata)
    });

    await recordBillingWebhookResult(admin, {
      email,
      stripeEventId: eventId,
      eventType,
      plan: planFromSubscription(sub),
      success: syncResult.ok,
      reason: syncResult.ok ? undefined : syncResult.error || 'invoice_subscription_sync_failed',
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
    if (subId) {
      const sub = await stripe.subscriptions.retrieve(subId);
      if (isReRootMetadata(sub.metadata)) {
        await handleReRootSubscription(stripe, admin, sub, eventId, eventType);
        return;
      }
    }

    const profile = await resolveBillingProfile(admin, { email });
    if (profile) {
      await admin.from('profiles').update({ subscription_status: 'past_due' }).eq('id', profile.id);
    }
    await admin
      .from('everittos_subscriptions')
      .update({ last_payment_status: 'past_due' })
      .ilike('email', email);
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

  if (!signature) {
    logStripeBilling('webhook:missing_signature', {}, 'warn');
    return NextResponse.json({ error: 'Missing stripe-signature' }, { status: 400 });
  }

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, signature, secret);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Invalid signature';
    logStripeBilling('webhook:signature_invalid', { error: message }, 'warn');
    return NextResponse.json({ error: message }, { status: 400 });
  }

  logStripeBilling('webhook:received', {
    eventId: event.id,
    eventType: event.type,
    webhookEndpoint: 'https://app.everittventures.com/api/stripe/webhook'
  });
  logBillingActivation('WEBHOOK_RECEIVED', { eventId: event.id, eventType: event.type });
  logBillingPipeline('webhook_received', { eventId: event.id, eventType: event.type });

  const admin = createAdminSupabase();
  if (!admin) return NextResponse.json({ error: 'SUPABASE_SERVICE_ROLE_KEY is not configured.' }, { status: 503 });

  logStripeBilling('webhook:validated', { eventId: event.id, eventType: event.type });
  logBillingPipeline('webhook_verified', { eventId: event.id, eventType: event.type });

  const claim = await claimStripeWebhookEvent(admin, event.id, event.type);
  if (claim === 'duplicate') {
    logStripeBilling('webhook:duplicate_skipped', { eventId: event.id, eventType: event.type });
    return NextResponse.json({ received: true, duplicate: true });
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed':
      case 'checkout.session.async_payment_succeeded': {
        const session = event.data.object as Stripe.Checkout.Session;
        if (isReRootMetadata(session.metadata)) {
          logStripeBilling('webhook:reroot_checkout', { eventId: event.id, eventType: event.type });
          await handleReRootCheckout(stripe, admin, session, event.id, event.type);
        } else {
          logStripeBilling('webhook:checkout_completed', { eventId: event.id, eventType: event.type });
          await handleCheckoutCompleted(stripe, admin, session, event.id, event.type);
        }
        break;
      }
      case 'customer.subscription.created':
      case 'customer.subscription.updated': {
        const sub = event.data.object as Stripe.Subscription;
        if (isReRootMetadata(sub.metadata)) {
          logStripeBilling('webhook:reroot_subscription', { eventId: event.id, eventType: event.type });
          await handleReRootSubscription(stripe, admin, sub, event.id, event.type);
        } else {
          logStripeBilling('webhook:subscription_event', { eventId: event.id, eventType: event.type });
          await handleSubscriptionEvent(stripe, admin, sub, event.id, event.type);
        }
        break;
      }
      case 'customer.subscription.deleted': {
        const sub = event.data.object as Stripe.Subscription;
        if (isReRootMetadata(sub.metadata)) {
          logStripeBilling('webhook:reroot_subscription_deleted', { eventId: event.id });
          await handleReRootSubscription(stripe, admin, sub, event.id, event.type);
        } else {
          logStripeBilling('webhook:subscription_deleted', { eventId: event.id });
          await handleSubscriptionDeleted(stripe, admin, sub, event.id);
        }
        break;
      }
      case 'invoice.paid':
      case 'invoice.payment_succeeded':
      case 'invoice.payment_failed':
        logStripeBilling('webhook:invoice_event', { eventId: event.id, eventType: event.type });
        await handleInvoiceEvent(
          admin,
          stripe,
          event.data.object as Stripe.Invoice,
          event.id,
          event.type,
          event.type !== 'invoice.payment_failed'
        );
        break;
      default:
        logStripeBilling('webhook:unhandled_type', { eventId: event.id, eventType: event.type });
        break;
    }
  } catch (error) {
    logStripeBilling(
      'webhook:handler_error',
      {
        eventId: event.id,
        eventType: event.type,
        error: error instanceof Error ? error.message : 'unknown'
      },
      'error'
    );
    return NextResponse.json({ error: 'Webhook handler failed.' }, { status: 500 });
  }

  logStripeBilling('webhook:processed', { eventId: event.id, eventType: event.type });
  return NextResponse.json({ received: true });
}
