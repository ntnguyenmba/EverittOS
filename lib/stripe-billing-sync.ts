import type Stripe from 'stripe';
import type { createAdminSupabase } from '@/lib/supabase-admin';
import type { EverittosPlan } from '@/lib/everittos-plans';
import type { StoredCouponDiscount } from '@/lib/stripe-promo';
import { coalesceStripeCustomerId, isValidStripeCustomerId, isValidStripeSubscriptionId } from '@/lib/stripe-ids';
import { planFromSubscription, primaryStripePriceId } from '@/lib/stripe-plan-mapping';
import {
  logBillingSyncEvent,
  logBillingSyncIssueEvent,
  logStripeBilling
} from '@/lib/stripe-billing-logs';

type AdminClient = NonNullable<ReturnType<typeof createAdminSupabase>>;

export type BillingSyncInput = {
  /** Checkout session metadata user_id */
  sessionUserId?: string | null;
  /** Subscription metadata user_id */
  subscriptionUserId?: string | null;
  /** Organization owner user id from checkout/subscription metadata */
  ownerUserId?: string | null;
  /** @deprecated Use sessionUserId */
  userId?: string | null;
  email: string;
  workspaceId?: string | null;
  plan: EverittosPlan;
  subscriptionStatus: string;
  stripeCustomerId?: string | null;
  stripeSubscriptionId?: string | null;
  stripePriceId?: string | null;
  stripeSessionId?: string | null;
  currentPeriodEnd?: number | null;
  cancelAtPeriodEnd?: boolean;
  discount?: StoredCouponDiscount;
  lastPaymentStatus?: string | null;
};

export type BillingProfileRow = {
  id: string;
  email: string;
  stripe_customer_id?: string | null;
};

export type BillingTargetResolution = {
  profile: BillingProfileRow;
  payerUserId: string | null;
  workspaceId: string | null;
  ownerUserId: string | null;
};

/** Pick the best subscription to sync when multiple exist for a customer. */
export function pickBestStripeSubscription(
  subscriptions: Stripe.Subscription[]
): Stripe.Subscription | null {
  if (!subscriptions.length) return null;

  const ranked = subscriptions
    .map((sub) => {
      const plan = planFromSubscription(sub);
      const grantsAccess = subscriptionGrantsPaidAccess(sub);
      const score =
        (grantsAccess ? 100 : 0) +
        (sub.status === 'active' ? 40 : sub.status === 'trialing' ? 35 : sub.status === 'past_due' ? 20 : 0) +
        sub.created;
      return { sub, plan, grantsAccess, score };
    })
    .filter((row) => row.plan && row.grantsAccess)
    .sort((a, b) => b.score - a.score);

  if (ranked.length) return ranked[0].sub;

  return (
    subscriptions.find((sub) => sub.status === 'active' || sub.status === 'trialing') ||
    subscriptions.find((sub) => sub.status === 'past_due' || sub.status === 'unpaid') ||
    subscriptions[0] ||
    null
  );
}

export async function claimStripeWebhookEvent(
  admin: AdminClient,
  eventId: string,
  eventType: string
): Promise<'claimed' | 'duplicate'> {
  const { data: existing } = await admin
    .from('subscription_events')
    .select('id')
    .eq('stripe_event_id', eventId)
    .ilike('event_type', 'webhook.claimed:%')
    .maybeSingle();

  if (existing?.id) {
    return 'duplicate';
  }

  const { error } = await admin.from('subscription_events').insert({
    email: 'stripe-webhook@system',
    event_type: `webhook.claimed:${eventType}`,
    plan: null,
    stripe_event_id: eventId,
    payload: { eventType, claimedAt: new Date().toISOString() }
  });

  if (error) {
    if (error.code === '23505') return 'duplicate';
    logBillingSyncIssue('webhook_claim_insert_failed', { eventId, eventType, error: error.message });
  }

  return 'claimed';
}

export async function resolveOrganizationOwnerProfile(
  admin: AdminClient,
  workspaceId: string | null | undefined
): Promise<BillingProfileRow | null> {
  const orgId = workspaceId?.trim();
  if (!orgId) return null;

  const { data: org } = await admin.from('organizations').select('owner_user_id').eq('id', orgId).maybeSingle();
  if (!org?.owner_user_id) return null;

  const { data } = await admin
    .from('profiles')
    .select('id, email, stripe_customer_id')
    .eq('id', org.owner_user_id)
    .maybeSingle();

  if (!data?.id) return null;

  return {
    id: data.id,
    email: (data.email || '').trim().toLowerCase(),
    stripe_customer_id: data.stripe_customer_id
  };
}

/** Workspace billing always unlocks the organization owner profile. */
export async function resolveBillingTargetProfile(
  admin: AdminClient,
  input: {
    sessionUserId?: string | null;
    subscriptionUserId?: string | null;
    ownerUserId?: string | null;
    email?: string | null;
    workspaceId?: string | null;
  }
): Promise<BillingTargetResolution | null> {
  const workspaceId = input.workspaceId?.trim() || null;
  const payer = await resolveBillingUser(admin, {
    sessionUserId: input.sessionUserId,
    subscriptionUserId: input.subscriptionUserId,
    email: input.email
  });

  let owner = await resolveOrganizationOwnerProfile(admin, workspaceId);

  if (!owner && input.ownerUserId?.trim()) {
    const { data } = await admin
      .from('profiles')
      .select('id, email, stripe_customer_id')
      .eq('id', input.ownerUserId.trim())
      .maybeSingle();
    if (data?.id) {
      owner = {
        id: data.id,
        email: (data.email || '').trim().toLowerCase(),
        stripe_customer_id: data.stripe_customer_id
      };
    }
  }

  if (owner) {
    logStripeBilling('webhook:workspace_found', {
      workspaceId,
      ownerUserId: owner.id,
      payerUserId: payer?.id || null
    });
    return {
      profile: owner,
      payerUserId: payer?.id || input.sessionUserId?.trim() || input.subscriptionUserId?.trim() || null,
      workspaceId,
      ownerUserId: owner.id
    };
  }

  if (workspaceId) {
    logStripeBilling('webhook:workspace_missing', { workspaceId }, 'warn');
  }

  if (!payer) return null;

  return {
    profile: payer,
    payerUserId: payer.id,
    workspaceId,
    ownerUserId: payer.id
  };
}

export function logBillingSync(message: string, data: Record<string, unknown>) {
  logBillingSyncEvent(message, data);
}

export function logBillingSyncIssue(issue: string, data: Record<string, unknown>) {
  logBillingSyncIssueEvent(issue, data);
}

export function everittosStatusForSubscription(
  plan: EverittosPlan,
  stripeStatus: Stripe.Subscription.Status,
  cancelAtPeriodEnd?: boolean
): string {
  if (plan === 'free') return 'free';
  if (stripeStatus === 'active' || stripeStatus === 'trialing') {
    return cancelAtPeriodEnd ? 'canceled' : `everittos_${plan}`;
  }
  return stripeStatus;
}

export function effectivePlanFromStripe(
  stripeStatus: Stripe.Subscription.Status,
  detectedPlan: EverittosPlan | null,
  currentPeriodEnd?: number | null
): EverittosPlan {
  if (!detectedPlan) return 'free';

  if (stripeStatus === 'active' || stripeStatus === 'trialing') {
    return detectedPlan;
  }

  if (stripeStatus === 'canceled' && currentPeriodEnd && currentPeriodEnd * 1000 > Date.now()) {
    return detectedPlan;
  }

  return 'free';
}

export function subscriptionGrantsPaidAccess(sub: Stripe.Subscription): boolean {
  if (sub.status === 'active' || sub.status === 'trialing') return true;
  if (sub.status === 'past_due' || sub.status === 'unpaid' || sub.status === 'paused') return true;
  if (sub.status === 'canceled' && sub.current_period_end * 1000 > Date.now()) return true;
  return false;
}

/** Match EverittOS user: session metadata user_id → subscription metadata user_id → customer email. */
export async function resolveBillingUser(
  admin: AdminClient,
  input: {
    sessionUserId?: string | null;
    subscriptionUserId?: string | null;
    email?: string | null;
  }
): Promise<BillingProfileRow | null> {
  const userIdCandidates = [input.sessionUserId?.trim(), input.subscriptionUserId?.trim()].filter(Boolean) as string[];

  for (const userId of userIdCandidates) {
    const { data } = await admin
      .from('profiles')
      .select('id, email, stripe_customer_id')
      .eq('id', userId)
      .maybeSingle();
    if (data?.id) {
      return {
        id: data.id,
        email: (data.email || '').trim().toLowerCase(),
        stripe_customer_id: data.stripe_customer_id
      };
    }
  }

  const normalizedEmail = input.email?.trim().toLowerCase();
  if (!normalizedEmail) {
    logBillingSyncIssue('missing_user_match_inputs', {
      sessionUserId: input.sessionUserId || null,
      subscriptionUserId: input.subscriptionUserId || null,
      email: null
    });
    return null;
  }

  const { data: byEmail } = await admin
    .from('profiles')
    .select('id, email, stripe_customer_id')
    .ilike('email', normalizedEmail)
    .maybeSingle();

  if (byEmail?.id) {
    return {
      id: byEmail.id,
      email: (byEmail.email || normalizedEmail).trim().toLowerCase(),
      stripe_customer_id: byEmail.stripe_customer_id
    };
  }

  logBillingSyncIssue('profile_not_found', {
    sessionUserId: input.sessionUserId || null,
    subscriptionUserId: input.subscriptionUserId || null,
    email: normalizedEmail
  });
  return null;
}

/** @deprecated Use resolveBillingUser */
export async function resolveBillingProfile(
  admin: AdminClient,
  input: { userId?: string | null; email: string }
): Promise<BillingProfileRow | null> {
  return resolveBillingUser(admin, {
    sessionUserId: input.userId,
    email: input.email
  });
}

export async function resolveStripeCustomerEmail(
  stripe: Stripe,
  customer: string | Stripe.Customer | Stripe.DeletedCustomer | null | undefined
): Promise<string | null> {
  if (!customer) return null;

  if (typeof customer !== 'string') {
    if ('deleted' in customer && customer.deleted) return null;
    return customer.email?.trim().toLowerCase() || null;
  }

  try {
    const retrieved = await stripe.customers.retrieve(customer);
    if ('deleted' in retrieved && retrieved.deleted) return null;
    return retrieved.email?.trim().toLowerCase() || null;
  } catch (error) {
    logBillingSyncIssue('customer_email_lookup_failed', {
      customerId: customer,
      error: error instanceof Error ? error.message : 'unknown'
    });
    return null;
  }
}

export function stripeCustomerIdFromSubscription(sub: Stripe.Subscription): string | null {
  const customer = sub.customer;
  if (!customer) return null;
  if (typeof customer === 'string') return isValidStripeCustomerId(customer) ? customer : null;
  if ('deleted' in customer && customer.deleted) return null;
  return isValidStripeCustomerId(customer.id) ? customer.id : null;
}

export async function resolveSubscriptionSyncContext(
  stripe: Stripe,
  sub: Stripe.Subscription,
  context: {
    sessionUserId?: string | null;
    subscriptionUserId?: string | null;
    ownerUserId?: string | null;
    email?: string | null;
    workspaceId?: string | null;
  }
): Promise<{
  sessionUserId: string | null;
  subscriptionUserId: string | null;
  ownerUserId: string | null;
  email: string | null;
  workspaceId: string | null;
  stripeCustomerId: string | null;
}> {
  const subscriptionUserId = sub.metadata?.user_id?.trim() || sub.metadata?.userId?.trim() || null;
  const ownerUserId = sub.metadata?.owner_user_id?.trim() || sub.metadata?.ownerUserId?.trim() || null;
  const email =
    context.email?.trim().toLowerCase() ||
    sub.metadata?.email?.trim().toLowerCase() ||
    (await resolveStripeCustomerEmail(stripe, sub.customer));

  return {
    sessionUserId: context.sessionUserId?.trim() || null,
    subscriptionUserId: context.subscriptionUserId?.trim() || subscriptionUserId,
    ownerUserId,
    email,
    workspaceId:
      context.workspaceId ||
      sub.metadata?.workspace_id?.trim() ||
      sub.metadata?.organization_id?.trim() ||
      null,
    stripeCustomerId: stripeCustomerIdFromSubscription(sub)
  };
}

export async function recordBillingWebhookResult(
  admin: AdminClient,
  input: {
    email: string;
    stripeEventId: string;
    eventType: string;
    plan: string | null;
    success: boolean;
    reason?: string;
    details?: Record<string, unknown>;
  }
): Promise<void> {
  const { error } = await admin.from('subscription_events').insert({
    email: input.email.trim().toLowerCase(),
    event_type: input.success ? `webhook.sync.ok:${input.eventType}` : `webhook.sync.failed:${input.eventType}`,
    plan: input.plan,
    stripe_event_id: input.stripeEventId,
    payload: {
      success: input.success,
      reason: input.reason || null,
      eventType: input.eventType,
      ...(input.details || {})
    }
  });
  if (error) {
    logBillingSyncIssue('webhook_result_log_failed', { error: error.message, eventType: input.eventType });
  }
}

export async function syncBillingToSupabase(admin: AdminClient, input: BillingSyncInput): Promise<boolean> {
  const sessionUserId = input.sessionUserId ?? input.userId ?? null;
  const billingEmail = input.email.trim().toLowerCase();

  const target = await resolveBillingTargetProfile(admin, {
    sessionUserId,
    subscriptionUserId: input.subscriptionUserId,
    ownerUserId: input.ownerUserId,
    email: billingEmail,
    workspaceId: input.workspaceId
  });

  if (!target) {
    logStripeBilling(
      'webhook:activation_failed',
      {
        reason: 'profile_not_found',
        sessionUserId,
        subscriptionUserId: input.subscriptionUserId,
        workspaceId: input.workspaceId || null,
        email: billingEmail
      },
      'error'
    );
    return false;
  }

  const profile = target.profile;
  const normalizedEmail = billingEmail || profile.email;
  const stripeCustomerId = coalesceStripeCustomerId(input.stripeCustomerId, profile.stripe_customer_id);
  const stripeSubscriptionId = isValidStripeSubscriptionId(input.stripeSubscriptionId)
    ? input.stripeSubscriptionId
    : null;

  if (!stripeCustomerId) {
    logBillingSyncIssue('missing_customer_id', {
      userId: profile.id,
      incomingCustomerId: input.stripeCustomerId || null
    });
  }

  if (!stripeSubscriptionId && !input.stripeSessionId) {
    logBillingSyncIssue('missing_subscription_reference', {
      userId: profile.id,
      plan: input.plan
    });
  }

  if (input.stripeCustomerId && !isValidStripeCustomerId(input.stripeCustomerId)) {
    logBillingSyncIssue('invalid_stripe_customer_id_ignored', {
      userId: profile.id,
      value: input.stripeCustomerId
    });
  }

  const profileUpdate: Record<string, unknown> = {
    plan: input.plan,
    subscription_status: input.subscriptionStatus,
    ...(input.discount || {})
  };

  if (normalizedEmail && normalizedEmail !== profile.email) {
    profileUpdate.email = normalizedEmail;
  }

  if (stripeCustomerId) {
    profileUpdate.stripe_customer_id = stripeCustomerId;
  }

  const { error: profileError } = await admin.from('profiles').update(profileUpdate).eq('id', profile.id);
  if (profileError) {
    logBillingSyncIssue('profile_update_failed', {
      userId: profile.id,
      error: profileError.message,
      code: profileError.code
    });
    return false;
  }

  if (stripeSubscriptionId || input.stripeSessionId) {
    const subscriptionRow: Record<string, unknown> = {
      user_id: profile.id,
      email: normalizedEmail,
      plan: input.plan,
      stripe_customer_id: stripeCustomerId,
      stripe_subscription_id: stripeSubscriptionId,
      stripe_price_id: input.stripePriceId ?? null,
      stripe_session_id: input.stripeSessionId ?? null,
      status: input.subscriptionStatus.startsWith('everittos_') ? 'active' : input.subscriptionStatus,
      current_period_end: input.currentPeriodEnd
        ? new Date(input.currentPeriodEnd * 1000).toISOString()
        : null,
      cancel_at_period_end: input.cancelAtPeriodEnd ?? false,
      updated_at: new Date().toISOString(),
      ...(input.discount || {})
    };

    if (input.lastPaymentStatus) {
      subscriptionRow.last_payment_status = input.lastPaymentStatus;
    }

    if (input.workspaceId) {
      subscriptionRow.organization_id = input.workspaceId;
    }

    const conflictTarget = stripeSubscriptionId ? 'stripe_subscription_id' : 'stripe_session_id';
    const { error: subscriptionError } = await admin
      .from('everittos_subscriptions')
      .upsert(subscriptionRow, { onConflict: conflictTarget });

    if (subscriptionError) {
      logBillingSyncIssue('subscription_upsert_failed', {
        userId: profile.id,
        error: subscriptionError.message,
        code: subscriptionError.code,
        conflictTarget
      });
      return false;
    }
  }

  logBillingSync('synced', {
    userId: profile.id,
    payerUserId: target.payerUserId,
    ownerUserId: target.ownerUserId,
    workspaceId: target.workspaceId,
    plan: input.plan,
    status: input.subscriptionStatus,
    billingEmail: normalizedEmail,
    stripeCustomerId,
    stripeSubscriptionId,
    stripeSessionId: input.stripeSessionId || null
  });

  logStripeBilling('webhook:plan_updated', {
    userId: profile.id,
    workspaceId: target.workspaceId,
    plan: input.plan,
    status: input.subscriptionStatus,
    stripeCustomerId,
    stripeSubscriptionId
  });

  logStripeBilling('webhook:activation_completed', {
    userId: profile.id,
    workspaceId: target.workspaceId,
    plan: input.plan,
    stripeSubscriptionId
  });

  return true;
}

export async function syncStripeSubscriptionRecord(
  admin: AdminClient,
  stripe: Stripe,
  sub: Stripe.Subscription,
  context: {
    sessionUserId?: string | null;
    subscriptionUserId?: string | null;
    ownerUserId?: string | null;
    /** @deprecated Use sessionUserId */
    userId?: string | null;
    email?: string | null;
    workspaceId?: string | null;
    stripeSessionId?: string | null;
  }
): Promise<boolean> {
  const detectedPlan = planFromSubscription(sub);
  const syncContext = await resolveSubscriptionSyncContext(stripe, sub, {
    sessionUserId: context.sessionUserId ?? context.userId,
    subscriptionUserId: context.subscriptionUserId,
    ownerUserId: context.ownerUserId,
    email: context.email,
    workspaceId: context.workspaceId
  });

  if (!detectedPlan) {
    logBillingSyncIssue('missing_plan', {
      subscriptionId: sub.id,
      customerId: syncContext.stripeCustomerId,
      priceId: primaryStripePriceId(sub)
    });
    return false;
  }

  if (!syncContext.email) {
    logBillingSyncIssue('missing_email', {
      subscriptionId: sub.id,
      customerId: syncContext.stripeCustomerId,
      sessionUserId: syncContext.sessionUserId,
      subscriptionUserId: syncContext.subscriptionUserId
    });
    return false;
  }

  if (!syncContext.stripeCustomerId) {
    logBillingSyncIssue('missing_customer', {
      subscriptionId: sub.id,
      email: syncContext.email
    });
  }

  const retainsPaidPlan = subscriptionGrantsPaidAccess(sub);
  const plan = retainsPaidPlan ? detectedPlan : 'free';
  const active = sub.status === 'active' || sub.status === 'trialing';
  const status = active
    ? everittosStatusForSubscription(plan, sub.status, sub.cancel_at_period_end)
    : sub.status;
  const expandedSub = await stripe.subscriptions.retrieve(sub.id, {
    expand: ['discount.coupon', 'discount.promotion_code', 'items.data.price.product']
  });
  const { extractSubscriptionDiscount } = await import('@/lib/stripe-promo');
  const discount = await extractSubscriptionDiscount(stripe, expandedSub);

  return syncBillingToSupabase(admin, {
    sessionUserId: syncContext.sessionUserId,
    subscriptionUserId: syncContext.subscriptionUserId,
    ownerUserId: syncContext.ownerUserId,
    email: syncContext.email,
    workspaceId: syncContext.workspaceId,
    plan,
    subscriptionStatus: status,
    stripeCustomerId: syncContext.stripeCustomerId,
    stripeSubscriptionId: sub.id,
    stripePriceId: primaryStripePriceId(sub),
    stripeSessionId: context.stripeSessionId || null,
    currentPeriodEnd: sub.current_period_end,
    cancelAtPeriodEnd: sub.cancel_at_period_end,
    discount
  });
}

/** Pull the active Stripe subscription for a user and sync Supabase (manual recovery). */
export async function syncActiveStripeSubscriptionForUser(
  admin: AdminClient,
  stripe: Stripe,
  input: {
    userId: string;
    email: string;
    workspaceId?: string | null;
    sessionId?: string | null;
  }
): Promise<{
  synced: boolean;
  plan: EverittosPlan;
  status: string;
  stripeCustomerId: string | null;
  stripeSubscriptionId: string | null;
  currentPeriodEnd: string | null;
  reason?: string;
}> {
  const email = input.email.trim().toLowerCase();

  if (input.sessionId) {
    const session = await stripe.checkout.sessions.retrieve(input.sessionId, {
      expand: ['subscription', 'line_items.data.price.product']
    });
    const subId = typeof session.subscription === 'string' ? session.subscription : session.subscription?.id || null;
    if (subId) {
      const sub = await stripe.subscriptions.retrieve(subId, {
        expand: ['discount.coupon', 'discount.promotion_code', 'items.data.price.product']
      });
      const synced = await syncStripeSubscriptionRecord(admin, stripe, sub, {
        sessionUserId: input.userId,
        email: session.metadata?.email?.trim().toLowerCase() || email,
        workspaceId: session.metadata?.workspace_id || session.metadata?.organization_id || input.workspaceId || null,
        stripeSessionId: session.id
      });
      const detectedPlan = planFromSubscription(sub) || 'free';
      const status = everittosStatusForSubscription(detectedPlan, sub.status, sub.cancel_at_period_end);
      return {
        synced,
        plan: synced ? detectedPlan : 'free',
        status,
        stripeCustomerId: typeof session.customer === 'string' ? session.customer : session.customer?.id || null,
        stripeSubscriptionId: subId,
        currentPeriodEnd: sub.current_period_end
          ? new Date(sub.current_period_end * 1000).toISOString()
          : null,
        reason: synced ? undefined : 'session_subscription_sync_failed'
      };
    }
  }

  const customers = await stripe.customers.list({ email, limit: 10 });
  let best: { customerId: string; subscription: Stripe.Subscription } | null = null;

  for (const customer of customers.data) {
    if (customer.deleted) continue;
    const subs = await stripe.subscriptions.list({
      customer: customer.id,
      status: 'all',
      limit: 20,
      expand: ['data.items.data.price.product', 'data.discount.coupon', 'data.discount.promotion_code']
    });
    const picked = pickBestStripeSubscription(subs.data);
    if (!picked) continue;
    if (!best || picked.created > best.subscription.created) {
      best = { customerId: customer.id, subscription: picked };
    }
  }

  if (!best) {
    return {
      synced: false,
      plan: 'free',
      status: 'free',
      stripeCustomerId: null,
      stripeSubscriptionId: null,
      currentPeriodEnd: null,
      reason: 'no_stripe_subscription'
    };
  }

  const synced = await syncStripeSubscriptionRecord(admin, stripe, best.subscription, {
    sessionUserId: input.userId,
    email,
    workspaceId: input.workspaceId || null
  });

  const detectedPlan = planFromSubscription(best.subscription) || 'free';
  const retainsPaid = subscriptionGrantsPaidAccess(best.subscription);
  const plan = retainsPaid ? detectedPlan : 'free';
  const status = retainsPaid
    ? everittosStatusForSubscription(plan, best.subscription.status, best.subscription.cancel_at_period_end)
    : best.subscription.status;

  return {
    synced,
    plan,
    status,
    stripeCustomerId: best.customerId,
    stripeSubscriptionId: best.subscription.id,
    currentPeriodEnd: best.subscription.current_period_end
      ? new Date(best.subscription.current_period_end * 1000).toISOString()
      : null,
    reason: synced ? undefined : 'subscription_sync_failed'
  };
}
