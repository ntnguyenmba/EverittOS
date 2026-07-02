import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { createAdminSupabase } from '@/lib/supabase-admin';
import { createServerSupabase } from '@/lib/supabase-server';
import { type EverittosPlan } from '@/lib/everittos-plans';
import { canManageBilling } from '@/lib/roles';
import { resolveWorkspaceRoleForUser } from '@/lib/organization-server';
import { extractSubscriptionDiscount } from '@/lib/stripe-promo';
import { isValidStripeCustomerId } from '@/lib/stripe-ids';
import { planFromCheckoutSession, planFromSubscription } from '@/lib/stripe-plan-mapping';

export const runtime = 'nodejs';

async function getBestSubscription(stripe: Stripe, customerId: string) {
  const subscriptions = await stripe.subscriptions.list({
    customer: customerId,
    status: 'all',
    limit: 20,
    expand: ['data.discount.coupon', 'data.discount.promotion_code', 'data.items.data.price.product']
  });

  return (
    subscriptions.data.find((sub) => sub.status === 'active' || sub.status === 'trialing') ||
    subscriptions.data.find((sub) => sub.status === 'past_due' || sub.status === 'unpaid') ||
    subscriptions.data[0] ||
    null
  );
}

async function getLatestCompletedCheckoutPlan(stripe: Stripe, customerId: string) {
  const sessions = await stripe.checkout.sessions.list({ customer: customerId, limit: 10 });
  for (const session of sessions.data) {
    if (session.status !== 'complete') continue;
    const lineItems = await stripe.checkout.sessions.listLineItems(session.id, {
      limit: 5,
      expand: ['data.price.product']
    });
    const plan = planFromCheckoutSession(session, lineItems.data);
    if (plan) {
      return { session, plan };
    }
  }

  return null;
}

async function getLatestCompletedCheckoutPlanByEmail(stripe: Stripe, email: string) {
  const sessions = await stripe.checkout.sessions.list({ limit: 100 });
  for (const session of sessions.data) {
    if (session.status !== 'complete') continue;

    const sessionEmail = (session.customer_details?.email || session.customer_email || '').trim().toLowerCase();
    if (sessionEmail !== email) continue;

    const lineItems = await stripe.checkout.sessions.listLineItems(session.id, {
      limit: 5,
      expand: ['data.price.product']
    });
    const plan = planFromCheckoutSession(session, lineItems.data);
    if (plan) return { session, plan };
  }

  return null;
}

async function findStripeCustomerIds(stripe: Stripe, email: string, existingCustomerId?: string | null) {
  const ids = new Set<string>();
  if (isValidStripeCustomerId(existingCustomerId)) ids.add(existingCustomerId);

  const customers = await stripe.customers.list({ email, limit: 20 });
  for (const customer of customers.data) {
    if (!customer.deleted) ids.add(customer.id);
  }

  return Array.from(ids);
}

async function refreshByEmail(request: Request) {
  const stripeKey = process.env.STRIPE_SECRET_KEY;
  if (!stripeKey) {
    return NextResponse.json({ error: 'Stripe is not configured.' }, { status: 503 });
  }

  const supabase = await createServerSupabase();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const checkoutEmail = (searchParams.get('email') || '').trim().toLowerCase();
  if (!checkoutEmail || !checkoutEmail.includes('@')) {
    return NextResponse.json({ error: 'Add ?email=the-checkout-email-you-used.' }, { status: 400 });
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('id, email, role, stripe_customer_id')
    .eq('id', user.id)
    .maybeSingle();

  const role = await resolveWorkspaceRoleForUser(supabase, user.id, profile?.role);
  if (!canManageBilling(role)) {
    return NextResponse.json({ error: 'Only workspace owners and admins can refresh billing.', role }, { status: 403 });
  }

  const admin = createAdminSupabase();
  if (!admin) {
    return NextResponse.json({ error: 'SUPABASE_SERVICE_ROLE_KEY is not configured.' }, { status: 503 });
  }

  const stripe = new Stripe(stripeKey);
  const customerIds = await findStripeCustomerIds(stripe, checkoutEmail, profile?.stripe_customer_id);

  let selectedCustomerId: string | null = null;
  let selectedSubscription: Stripe.Subscription | null = null;
  let selectedPlan: EverittosPlan | null = null;
  let completedCheckout: { session: Stripe.Checkout.Session; plan: EverittosPlan } | null = null;

  for (const customerId of customerIds) {
    const subscription = await getBestSubscription(stripe, customerId);
    if (subscription) {
      const plan = planFromSubscription(subscription);
      if (plan) {
        selectedCustomerId = customerId;
        selectedSubscription = subscription;
        selectedPlan = plan;
        break;
      }
    }

    const checkout = await getLatestCompletedCheckoutPlan(stripe, customerId);
    if (checkout) {
      selectedCustomerId = customerId;
      completedCheckout = checkout;
      selectedPlan = checkout.plan;
      break;
    }
  }

  if (!selectedPlan) {
    const checkout = await getLatestCompletedCheckoutPlanByEmail(stripe, checkoutEmail);
    if (checkout) {
      const customerId =
        typeof checkout.session.customer === 'string' ? checkout.session.customer : checkout.session.customer?.id || null;
      selectedCustomerId = customerId;
      completedCheckout = checkout;
      selectedPlan = checkout.plan;
    }
  }

  if (!selectedPlan) {
    return NextResponse.json(
      {
        error: `No matching paid Stripe subscription or completed checkout was found for ${checkoutEmail}.`,
        customerIds
      },
      { status: 404 }
    );
  }

  const active =
    selectedSubscription?.status === 'active' ||
    selectedSubscription?.status === 'trialing' ||
    Boolean(completedCheckout);
  const plan: EverittosPlan = active ? selectedPlan : 'free';
  const status = active ? `everittos_${selectedPlan}` : selectedSubscription?.status || 'free';
  const currentPeriodEnd = selectedSubscription?.current_period_end
    ? new Date(selectedSubscription.current_period_end * 1000).toISOString()
    : null;
  const discount = selectedSubscription ? await extractSubscriptionDiscount(stripe, selectedSubscription) : undefined;

  const { error: profileUpdateError } = await admin
    .from('profiles')
    .update({
      plan,
      subscription_status: status,
      stripe_customer_id: selectedCustomerId,
      ...(discount || {})
    })
    .eq('id', user.id);

  if (profileUpdateError) {
    return NextResponse.json({ error: profileUpdateError.message, step: 'profile_update' }, { status: 500 });
  }

  if (selectedSubscription) {
    const { error: subscriptionUpsertError } = await admin.from('everittos_subscriptions').upsert(
      {
        user_id: user.id,
        email: (profile?.email || user.email).trim().toLowerCase(),
        plan,
        stripe_customer_id: selectedCustomerId,
        stripe_subscription_id: selectedSubscription.id,
        status: active ? 'active' : selectedSubscription.status,
        current_period_end: currentPeriodEnd,
        updated_at: new Date().toISOString(),
        ...(discount || {})
      },
      { onConflict: 'stripe_subscription_id' }
    );

    if (subscriptionUpsertError) {
      return NextResponse.json({ error: subscriptionUpsertError.message, step: 'subscription_upsert' }, { status: 500 });
    }
  }

  const { data: refreshedProfile } = await admin
    .from('profiles')
    .select('plan, subscription_status, stripe_customer_id')
    .eq('id', user.id)
    .maybeSingle();

  await admin.from('subscription_events').insert({
    email: (profile?.email || user.email).trim().toLowerCase(),
    event_type: 'manual.subscription.refresh_by_checkout_email',
    plan,
    stripe_event_id: `manual_${selectedSubscription?.id || completedCheckout?.session.id || selectedCustomerId || checkoutEmail}_${Date.now()}`,
    payload: {
      checkout_email: checkoutEmail,
      customer_id: selectedCustomerId,
      subscription_id: selectedSubscription?.id || null,
      checkout_session_id: completedCheckout?.session.id || null,
      status
    }
  });

  return NextResponse.json({
    ok: true,
    plan,
    status,
    checkoutEmail,
    stripeCustomerId: selectedCustomerId,
    stripeSubscriptionId: selectedSubscription?.id || null,
    checkoutSessionId: completedCheckout?.session.id || null,
    currentPeriodEnd,
    refreshedProfile
  });
}

export async function GET(request: Request) {
  return refreshByEmail(request);
}

export async function POST(request: Request) {
  return refreshByEmail(request);
}
