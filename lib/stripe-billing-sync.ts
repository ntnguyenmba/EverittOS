import type Stripe from 'stripe';
import type { createAdminSupabase } from '@/lib/supabase-admin';
import type { EverittosPlan } from '@/lib/everittos-plans';
import type { StoredCouponDiscount } from '@/lib/stripe-promo';
import { coalesceStripeCustomerId, isValidStripeCustomerId, isValidStripeSubscriptionId } from '@/lib/stripe-ids';
import { planFromSubscription, primaryStripePriceId } from '@/lib/stripe-plan-mapping';
import { logBillingSyncEvent, logBillingSyncIssueEvent } from '@/lib/stripe-billing-logs';

type AdminClient = NonNullable<ReturnType<typeof createAdminSupabase>>;

export type BillingSyncInput = {
  /** Checkout session metadata user_id */
  sessionUserId?: string | null;
  /** Subscription metadata user_id */
  subscriptionUserId?: string | null;
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
    email?: string | null;
    workspaceId?: string | null;
  }
): Promise<{
  sessionUserId: string | null;
  subscriptionUserId: string | null;
  email: string | null;
  workspaceId: string | null;
  stripeCustomerId: string | null;
}> {
  const subscriptionUserId = sub.metadata?.user_id?.trim() || sub.metadata?.userId?.trim() || null;
  const email =
    context.email?.trim().toLowerCase() ||
    sub.metadata?.email?.trim().toLowerCase() ||
    (await resolveStripeCustomerEmail(stripe, sub.customer));

  return {
    sessionUserId: context.sessionUserId?.trim() || null,
    subscriptionUserId: context.subscriptionUserId?.trim() || subscriptionUserId,
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

  const profile = await resolveBillingUser(admin, {
    sessionUserId,
    subscriptionUserId: input.subscriptionUserId,
    email: input.email
  });

  if (!profile) {
    return false;
  }

  const normalizedEmail = profile.email;
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
    workspaceId: input.workspaceId || null,
    plan: input.plan,
    status: input.subscriptionStatus,
    stripeCustomerId,
    stripeSubscriptionId,
    stripeSessionId: input.stripeSessionId || null
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
