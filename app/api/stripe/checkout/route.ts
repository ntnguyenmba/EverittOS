import { NextResponse } from 'next/server';
import type Stripe from 'stripe';
import { appUrl } from '@/lib/app-url';
import { normalizePlan } from '@/lib/everittos-plans';
import { canManageBilling, normalizeRole } from '@/lib/roles';
import { createServerSupabase } from '@/lib/supabase-server';
import { isPaidCheckoutPlan, stripePriceIdForPlan } from '@/lib/stripe-prices';
import { getStripeClient } from '@/lib/stripe-server';
import { logPromoCodeFailure } from '@/lib/promo-code-logging';
import { checkoutPromotionParams } from '@/lib/stripe-checkout-params';
import { validatePromotionCodeForPlan } from '@/lib/stripe-promo';

export const runtime = 'nodejs';

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

  const metadata = {
    plan,
    planKey: plan,
    user_id: user.id,
    userId: user.id,
    email,
    organization_id: profile?.organization_id || '',
    ...(promoCode ? { promotion_code: promoCode.toUpperCase(), promoCode: promoCode.toUpperCase() } : {})
  };

  const sessionParams: Stripe.Checkout.SessionCreateParams = {
    mode: 'subscription',
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: appUrl('/settings/billing?checkout=success'),
    cancel_url: appUrl('/settings/billing?checkout=cancelled'),
    client_reference_id: plan,
    metadata,
    customer_creation: 'always',
    subscription_data: { metadata }
  };

  if (profile?.stripe_customer_id) {
    sessionParams.customer = profile.stripe_customer_id;
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
