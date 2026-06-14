import type Stripe from 'stripe';
import type { createAdminSupabase } from '@/lib/supabase-admin';
import type { EverittosPlan } from '@/lib/everittos-plans';
import type { StoredCouponDiscount } from '@/lib/stripe-promo';
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
): Promise<{ id: string; email: string } | null> {
  const normalizedEmail = input.email.trim().toLowerCase();

  if (input.userId) {
    const { data: byId } = await admin
      .from('profiles')
      .select('id, email')
      .eq('id', input.userId)
      .maybeSingle();
    if (byId?.id) {
      return { id: byId.id, email: (byId.email || normalizedEmail).trim().toLowerCase() };
    }
  }

  const { data: byEmail } = await admin
    .from('profiles')
    .select('id, email')
    .ilike('email', normalizedEmail)
    .maybeSingle();

  if (byEmail?.id) {
    return { id: byEmail.id, email: (byEmail.email || normalizedEmail).trim().toLowerCase() };
  }

  return null;
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

  await admin
    .from('profiles')
    .update({
      plan: input.plan,
      subscription_status: input.subscriptionStatus,
      stripe_customer_id: input.stripeCustomerId ?? null,
      ...(input.discount || {})
    })
    .eq('id', profile.id);

  if (input.stripeSubscriptionId || input.stripeSessionId) {
    const subscriptionRow: Record<string, unknown> = {
      user_id: profile.id,
      email: normalizedEmail,
      plan: input.plan,
      stripe_customer_id: input.stripeCustomerId ?? null,
      stripe_subscription_id: input.stripeSubscriptionId ?? null,
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

    const conflictTarget = input.stripeSubscriptionId ? 'stripe_subscription_id' : 'stripe_session_id';
    await admin.from('everittos_subscriptions').upsert(subscriptionRow, { onConflict: conflictTarget });
  }

  logBillingSync('synced', {
    userId: profile.id,
    workspaceId: input.workspaceId || null,
    plan: input.plan,
    status: input.subscriptionStatus,
    stripeCustomerId: input.stripeCustomerId || null,
    stripeSubscriptionId: input.stripeSubscriptionId || null,
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
  const email =
    context.email?.trim().toLowerCase() ||
    sub.metadata?.email?.trim().toLowerCase() ||
    null;

  if (!email || !detectedPlan) {
    logBillingSync('subscription_sync_skipped', {
      subscriptionId: sub.id,
      email: Boolean(email),
      plan: detectedPlan,
      workspaceId: context.workspaceId || sub.metadata?.workspace_id || sub.metadata?.organization_id || null
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
    userId: context.userId || sub.metadata?.user_id || sub.metadata?.userId || null,
    email,
    workspaceId:
      context.workspaceId ||
      sub.metadata?.workspace_id ||
      sub.metadata?.organization_id ||
      null,
    plan,
    subscriptionStatus: status,
    stripeCustomerId: typeof sub.customer === 'string' ? sub.customer : sub.customer?.id || null,
    stripeSubscriptionId: sub.id,
    stripePriceId: primaryStripePriceId(sub),
    stripeSessionId: context.stripeSessionId || null,
    currentPeriodEnd: sub.current_period_end,
    cancelAtPeriodEnd: sub.cancel_at_period_end,
    discount
  });
}
