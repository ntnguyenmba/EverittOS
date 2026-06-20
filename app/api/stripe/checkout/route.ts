import { NextResponse } from 'next/server';
import type Stripe from 'stripe';
import { appUrl } from '@/lib/app-url';
import { normalizePlan, type EverittosPlan } from '@/lib/everittos-plans';
import { canManageBilling, normalizeRole } from '@/lib/roles';
import { createAdminSupabase } from '@/lib/supabase-admin';
import { createServerSupabase } from '@/lib/supabase-server';
import { NO_REFUND_STRIPE_SUBMIT_MESSAGE } from '@/lib/no-refund-policy';
import { isPaidCheckoutPlan, stripePriceIdForPlan } from '@/lib/stripe-prices';
import { getStripeClient } from '@/lib/stripe-server';
import { logPromoCodeFailure } from '@/lib/promo-code-logging';
import { checkoutPromotionParams } from '@/lib/stripe-checkout-params';
import { validatePromotionCodeForPlan } from '@/lib/stripe-promo';
import { isValidStripeCustomerId } from '@/lib/stripe-ids';
import { syncStripeSubscriptionRecord } from '@/lib/stripe-billing-sync';
import { logStripeBilling } from '@/lib/stripe-billing-logs';
import { planFromSubscription } from '@/lib/stripe-plan-mapping';

export const runtime = 'nodejs';

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
  stripe: NonNullable<ReturnType<typeof getStripeClient>>;
  userId: string;
  email: string;
  organizationId: string | null;
  subscription: Stripe.Subscription;
}) {
  const admin = createAdminSupabase();
  if (!admin) return;

  await syncStripeSubscriptionRecord(admin, input.stripe, input.subscription, {
    sessionUserId: input.userId,
    email: input.email,
    workspaceId: input.organizationId
  });
}

export async function POST(request: Request) {
  const stripe = getStripeClient();
  if (!stripe) {
    logStripeBilling('checkout:not_configured', { reason: 'stripe_client_missing' }, 'warn');
    return NextResponse.json({ error: 'Stripe is not configured.' }, { status: 503 });
  }

  const supabase = await createServerSupabase();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    logStripeBilling('checkout:unauthenticated', {});
    return NextResponse.json({ error: 'Sign in to start checkout.' }, { status: 401 });
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, email, stripe_customer_id, organization_id')
    .eq('id', user.id)
    .maybeSingle();

  const role = normalizeRole(profile?.role || 'owner');
  if (!canManageBilling(role)) {
    logStripeBilling('checkout:forbidden', { userId: user.id, role });
    return NextResponse.json({ error: 'Only workspace owners and admins can start checkout.', role }, { status: 403 });
  }

  const body = (await request.json().catch(() => ({}))) as {
    plan?: string;
    promoCode?: string;
    refundPolicyAcknowledged?: boolean;
  };
  const plan = normalizePlan(body.plan);
  const promoCode = (body.promoCode || '').trim();
  const refundPolicyAcknowledged = body.refundPolicyAcknowledged === true;
  const email = (profile?.email || user.email || '').trim().toLowerCase();

  if (!isPaidCheckoutPlan(plan)) {
    logStripeBilling('checkout:invalid_plan', { userId: user.id, plan });
    return NextResponse.json({ error: 'Select a paid plan to checkout.' }, { status: 400 });
  }

  if (!email) {
    logStripeBilling('checkout:missing_email', { userId: user.id, plan });
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
        stripe,
        userId: user.id,
        email,
        organizationId: profile?.organization_id || null,
        subscription: existingSubscription
      });

      logStripeBilling('checkout:already_subscribed', {
        userId: user.id,
        customerId,
        subscriptionId: existingSubscription.id,
        plan: existingPlan,
        status: existingSubscription.status
      });

      return NextResponse.json(
        {
          error: 'You already have an active subscription. Use Manage billing to upgrade, downgrade, or cancel.',
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
    logStripeBilling('checkout:not_configured', { userId: user.id, plan, reason: 'missing_price_id' }, 'warn');
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
      logStripeBilling('checkout:promo_invalid', {
        userId: user.id,
        plan,
        errorCode: validation.errorCode
      });
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
  const normalizedPromo = promoCode ? promoCode.toUpperCase() : '';
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
    no_refund_policy: 'true',
    ...(refundPolicyAcknowledged ? { refund_policy_acknowledged: 'true' } : {}),
    ...(normalizedPromo
      ? {
          promotion_code: normalizedPromo,
          promoCode: normalizedPromo,
          promo_code: normalizedPromo
        }
      : {})
  };

  const sessionParams: Stripe.Checkout.SessionCreateParams = {
    mode: 'subscription',
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: appUrl('/settings/billing?checkout=success&session_id={CHECKOUT_SESSION_ID}'),
    cancel_url: appUrl('/settings/billing?checkout=cancelled'),
    client_reference_id: plan,
    metadata,
    customer_creation: 'always',
    subscription_data: { metadata },
    custom_text: {
      submit: { message: NO_REFUND_STRIPE_SUBMIT_MESSAGE }
    }
  };

  if (customerId) {
    sessionParams.customer = customerId;
    delete sessionParams.customer_creation;
  } else {
    sessionParams.customer_email = email;
  }

  Object.assign(sessionParams, checkoutPromotionParams(promotionCodeId));

  try {
    const session = await stripe.checkout.sessions.create(sessionParams);

    logStripeBilling('checkout:session_created', {
      userId: user.id,
      plan,
      sessionId: session.id,
      customerId: customerId,
      priceId
    });

    return NextResponse.json({
      url: session.url,
      sessionId: session.id,
      preview
    });
  } catch (error) {
    logStripeBilling(
      'checkout:session_create_failed',
      {
        userId: user.id,
        plan,
        error: error instanceof Error ? error.message : 'unknown'
      },
      'error'
    );
    return NextResponse.json({ error: 'Unable to start checkout. Please try again.' }, { status: 500 });
  }
}
