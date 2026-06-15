import type Stripe from 'stripe';
import type { createAdminSupabase } from '@/lib/supabase-admin';
import type { EverittosPlan } from '@/lib/everittos-plans';
import type { StoredCouponDiscount } from '@/lib/stripe-promo';
import { coalesceStripeCustomerId, isValidStripeCustomerId, isValidStripeSubscriptionId } from '@/lib/stripe-ids';
import { planFromSubscription, primaryStripePriceId } from '@/lib/stripe-plan-mapping';

type AdminClient = NonNullable<ReturnType<typeof createAdminSupabase>>;

export type BillingSyncInput = {
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

export function logBillingSync(message: string, data: Record<string, unknown>) {
  console.log(`[stripe-billing] ${message}`, JSON.stringify(data));
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

export async function resolveBillingProfile(
  admin: AdminClient,
  input: { userId?: string | null; email: string }
): Promise<{ id: string; email: string; stripe_customer_id?: string | null } | null> {
  const normalizedEmail = input.email.trim().toLowerCase();

  if (input.userId) {
    const { data: byId } = await admin
      .from('profiles')
      .select('id, email, stripe_customer_id')
      .eq('id', input.userId)
      .maybeSingle();
    if (byId?.id) {
      return {
        id: byId.id,
        email: (byId.email || normalizedEmail).trim().toLowerCase(),
        stripe_customer_id: byId.stripe_customer_id
      };
    }
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

  return null;
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
    console.warn('[stripe-billing] Could not retrieve customer email', error);
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
    userId?: string | null;
    email?: string | null;
    workspaceId?: string | null;
  }
): Promise<{ userId: string | null; email: string | null; workspaceId: string | null; stripeCustomerId: string | null }> {
  const email =
    context.email?.trim().toLowerCase() ||
    sub.metadata?.email?.trim().toLowerCase() ||
    (await resolveStripeCustomerEmail(stripe, sub.customer));

  const stripeCustomerId = stripeCustomerIdFromSubscription(sub);

  return {
    userId: context.userId || sub.metadata?.user_id?.trim() || sub.metadata?.userId?.trim() || null,
    email,
    workspaceId:
      context.workspaceId ||
      sub.metadata?.workspace_id?.trim() ||
      sub.metadata?.organization_id?.trim() ||
      null,
    stripeCustomerId
  };
}

export async function syncBillingToSupabase(admin: AdminClient, input: BillingSyncInput): Promise<boolean> {
  const profile = await resolveBillingProfile(admin, {
    userId: input.userId,
    email: input.email
  });

  if (!profile) {
    logBillingSync('profile_not_found', {
      email: input.email,
      userId: input.userId || null,
      workspaceId: input.workspaceId || null
    });
    return false;
  }

  const normalizedEmail = profile.email;
  const stripeCustomerId = coalesceStripeCustomerId(input.stripeCustomerId, profile.stripe_customer_id);
  const stripeSubscriptionId = isValidStripeSubscriptionId(input.stripeSubscriptionId)
    ? input.stripeSubscriptionId
    : null;

  if (input.stripeCustomerId && !isValidStripeCustomerId(input.stripeCustomerId)) {
    logBillingSync('invalid_stripe_customer_id_ignored', {
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
    logBillingSync('profile_update_failed', {
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
      logBillingSync('subscription_upsert_failed', {
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
    userId?: string | null;
    email?: string | null;
    workspaceId?: string | null;
    stripeSessionId?: string | null;
  }
): Promise<boolean> {
  const detectedPlan = planFromSubscription(sub);
  const syncContext = await resolveSubscriptionSyncContext(stripe, sub, context);

  if (!syncContext.email || !detectedPlan) {
    logBillingSync('subscription_sync_skipped', {
      subscriptionId: sub.id,
      email: Boolean(syncContext.email),
      plan: detectedPlan,
      workspaceId: syncContext.workspaceId,
      customerId: syncContext.stripeCustomerId
    });
    return false;
  }

  const active = sub.status === 'active' || sub.status === 'trialing';
  const retainsPaidPlan =
    active ||
    sub.status === 'past_due' ||
    sub.status === 'unpaid' ||
    sub.status === 'paused' ||
    (sub.status === 'canceled' && sub.current_period_end * 1000 > Date.now());
  const plan = retainsPaidPlan ? detectedPlan : 'free';
  const status = active
    ? everittosStatusForSubscription(plan, sub.status, sub.cancel_at_period_end)
    : sub.status;
  const expandedSub = await stripe.subscriptions.retrieve(sub.id, {
    expand: ['discount.coupon', 'discount.promotion_code', 'items.data.price.product']
  });
  const { extractSubscriptionDiscount } = await import('@/lib/stripe-promo');
  const discount = await extractSubscriptionDiscount(stripe, expandedSub);

  return syncBillingToSupabase(admin, {
    userId: syncContext.userId,
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
