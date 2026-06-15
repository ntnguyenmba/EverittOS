import { NextResponse } from 'next/server';
import type Stripe from 'stripe';
import { appUrl } from '@/lib/app-url';
import { normalizePlan, type EverittosPlan } from '@/lib/everittos-plans';
import { canManageBilling, normalizeRole } from '@/lib/roles';
import { createAdminSupabase } from '@/lib/supabase-admin';
import { createServerSupabase } from '@/lib/supabase-server';
import { isPaidCheckoutPlan, stripePriceIdForPlan } from '@/lib/stripe-prices';
import { getStripeClient } from '@/lib/stripe-server';
import { logPromoCodeFailure } from '@/lib/promo-code-logging';
import { checkoutPromotionParams } from '@/lib/stripe-checkout-params';
import { validatePromotionCodeForPlan } from '@/lib/stripe-promo';
import { isValidStripeCustomerId } from '@/lib/stripe-ids';

export const runtime = 'nodejs';

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

  const fromPrice = normalizePlan(price.metadata?.plan);
  if (fromPrice !== 'free') return fromPrice;

  const fromProduct = normalizePlan(product?.metadata?.plan);
  if (fromProduct !== 'free') return fromProduct;

  return planFromAmount(price.unit_amount);
}

function planFromSubscription(sub: Stripe.Subscription): EverittosPlan | null {
  const direct = normalizePlan(sub.metadata?.plan || sub.metadata?.planKey);
  if (direct !== 'free') return direct;

  for (const item of sub.items.data) {
    const plan = planFromPrice(item.price);
    if (plan && plan !== 'free') return plan;
  }

  return null;
}

async function activeSubscriptionForCustomer(stripe: NonNullable<ReturnType<typeof getStripeClient>>, customerId: string) {
  const subscriptions = await stripe.subscriptions.list({
    customer: customerId,
    status: 'all',
    limit: 20,
    expand: ['data.items.data.price.product']
  });

  return (
    subscriptions.data.find((subscription) => subscription.status === 'active' || subscription.status === 'trialing') ||
    subscriptions.data.find((subscription) => subscription.status === 'past_due' || subscription.status === 'unpaid') ||
    null
  );
}

async function findExistingCustomer(stripe: NonNullable<ReturnType<typeof getStripeClient>>, email: string) {
  const customers = await stripe.customers.list({ email, limit: 10 });
  return customers.data.find((customer) => !customer.deleted) || null;
}

async function syncExistingSubscription(input: {
  userId: string;
  email: string;
  customerId: string;
  subscription: Stripe.Subscription;
  plan: EverittosPlan;
}) {
  const admin = createAdminSupabase();
  if (!admin) return;

  const status = input.subscription.status === 'active' || input.subscription.status === 'trialing' ? `everittos_${input.plan}` : input.subscription.status;
  const periodEnd = input.subscription.current_period_end
    ? new Date(input.subscription.current_period_end * 1000).toISOString()
    : null;

  await admin
    .from('profiles')
    .update({
      plan: input.plan,
      subscription_status: status,
      stripe_customer_id: input.customerId
    })
    .eq('id', input.userId);

  await admin.from('everittos_subscriptions').upsert(
    {
      user_id: input.userId,
      email: input.email,
      plan: input.plan,
      stripe_customer_id: input.customerId,
      stripe_subscription_id: input.subscription.id,
      stripe_price_id: input.subscription.items.data[0]?.price?.id || null,
      status: input.subscription.status === 'active' || input.subscription.status === 'trialing' ? 'active' : input.subscription.status,
      current_period_end: periodEnd,
      cancel_at_period_end: input.subscription.cancel_at_period_end,
      updated_at: new Date().toISOString()
    },
    { onConflict: 'stripe_subscription_id' }
  );
}

export async function POST(request: Request) {
  const stripe = getStripeClient();
  if (!stripe) {
    return NextResponse.json({ error: 'Stripe is not configured.' }, { status: 503 });
  }

  const supabase = await createServerSupabase();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Sign in to start checkout.' }, { status: 401 });
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, email, stripe_customer_id, organization_id')
    .eq('id', user.id)
    .maybeSingle();

  const role = normalizeRole(profile?.role || 'owner');
  if (!canManageBilling(role)) {
    return NextResponse.json({ error: 'Only workspace owners and admins can start checkout.', role }, { status: 403 });
  }

  const body = (await request.json().catch(() => ({}))) as { plan?: string; promoCode?: string };
  const plan = normalizePlan(body.plan);
  const promoCode = (body.promoCode || '').trim();
  const email = (profile?.email || user.email || '').trim().toLowerCase();

  if (!isPaidCheckoutPlan(plan)) {
    return NextResponse.json({ error: 'Select a paid plan to checkout.' }, { status: 400 });
  }

  if (!email) {
    return NextResponse.json({ error: 'Account email is required for checkout.' }, { status: 400 });
  }

  const storedCustomerId = profile?.stripe_customer_id;
  let customerId = isValidStripeCustomerId(storedCustomerId) ? storedCustomerId : null;
  let customer: Stripe.Customer | null = null;

  if (customerId) {
    try {
      const retrievedCustomer = await stripe.customers.retrieve(customerId);
      if (!('deleted' in retrievedCustomer && retrievedCustomer.deleted)) {
        customer = retrievedCustomer;
      }
    } catch {
      customerId = null;
    }
  }

  if (!customerId) {
    customer = await findExistingCustomer(stripe, email);
    customerId = customer?.id || null;
  }

  if (customerId) {
    const existingSubscription = await activeSubscriptionForCustomer(stripe, customerId);
    if (existingSubscription) {
      const existingPlan = planFromSubscription(existingSubscription) || plan;
      await syncExistingSubscription({
        userId: user.id,
        email,
        customerId,
        subscription: existingSubscription,
        plan: existingPlan
      });

      return NextResponse.json(
        {
          error: 'You already have an active subscription. We refreshed your billing status instead of creating another checkout.',
          code: 'already_subscribed',
          plan: existingPlan,
          status: existingSubscription.status,
          redirect: '/settings/billing'
        },
        { status: 409 }
      );
    }
  }

  const priceId = stripePriceIdForPlan(plan);
  if (!priceId) {
    return NextResponse.json(
      {
        error: 'Stripe checkout is not fully configured. Set STRIPE_PRICE_* environment variables.',
        code: 'checkout_not_configured'
      },
      { status: 503 }
    );
  }

  let promotionCodeId: string | undefined;
  let preview = null;

  if (promoCode) {
    const validation = await validatePromotionCodeForPlan(stripe, promoCode, plan);
    if (!validation.valid) {
      await logPromoCodeFailure({
        userId: user.id,
        organizationId: profile?.organization_id || null,
        stage: 'checkout',
        code: promoCode,
        plan,
        errorCode: validation.errorCode,
        error: validation.error
      });
      return NextResponse.json(validation, { status: 400 });
    }
    promotionCodeId = validation.promotionCodeId;
    preview = {
      code: validation.code,
      couponName: validation.couponName,
      durationLabel: validation.durationLabel,
      originalPriceLabel: validation.originalPriceLabel,
      discountedPriceLabel: validation.discountedPriceLabel,
      discountAmountLabel: validation.discountAmountLabel
    };
  }

  const workspaceId = profile?.organization_id || '';
  const metadata = {
    plan,
    planKey: plan,
    selected_plan: plan,
    user_id: user.id,
    userId: user.id,
    email,
    workspace_id: workspaceId,
    organization_id: workspaceId,
    price_id: priceId,
    ...(promoCode ? { promotion_code: promoCode.toUpperCase(), promoCode: promoCode.toUpperCase() } : {})
  };

  const sessionParams: Stripe.Checkout.SessionCreateParams = {
    mode: 'subscription',
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: appUrl('/settings/billing?checkout=success&session_id={CHECKOUT_SESSION_ID}'),
    cancel_url: appUrl('/settings/billing?checkout=cancelled'),
    client_reference_id: plan,
    metadata,
    customer_creation: 'always',
    subscription_data: { metadata }
  };

  if (customerId) {
    sessionParams.customer = customerId;
    delete sessionParams.customer_creation;
  } else {
    sessionParams.customer_email = email;
  }

  Object.assign(sessionParams, checkoutPromotionParams(promotionCodeId));

  const session = await stripe.checkout.sessions.create(sessionParams);

  return NextResponse.json({
    url: session.url,
    sessionId: session.id,
    preview
  });
}
