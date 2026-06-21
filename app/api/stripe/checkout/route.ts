import { NextResponse } from 'next/server';
import type Stripe from 'stripe';
import { appOrigin, appUrl, rawAppUrlEnvValues } from '@/lib/app-url';
import { resolveStripePriceId, stripePriceEnvKey, type PaidPlanKey } from '@/lib/billing-config';
import { maskStripeId } from '@/lib/billing-env';
import { checkoutOwnerDiagnostic } from '@/lib/checkout-errors';
import { normalizePlan } from '@/lib/everittos-plans';
import { canManageBilling, normalizeRole } from '@/lib/roles';
import { createServerSupabase } from '@/lib/supabase-server';
import { NO_REFUND_STRIPE_SUBMIT_MESSAGE } from '@/lib/no-refund-policy';
import { isPaidCheckoutPlan } from '@/lib/stripe-prices';
import { getStripeClient, getStripeSecretKey } from '@/lib/stripe-server';
import { checkoutPromotionParams } from '@/lib/stripe-checkout-params';
import { isValidStripeCustomerId } from '@/lib/stripe-ids';
import { fetchOrganizationContextForUser } from '@/lib/organization-server';
import { stripeKeyMode, stripeKeyModeLabel } from '@/lib/stripe-mode';
import {
  formatStripeError,
  isStripeCheckoutSessionUrl,
  safeCheckoutUrlHostname,
  validateCheckoutSessionInputs,
  validateStripeSubscriptionPriceForPlan
} from '@/lib/stripe-checkout-validation';
import { logStripeBilling } from '@/lib/stripe-billing-logs';

export const runtime = 'nodejs';

type CheckoutErrorCode =
  | 'stripe_not_configured'
  | 'unauthorized'
  | 'forbidden'
  | 'invalid_plan'
  | 'missing_email'
  | 'checkout_not_configured'
  | 'stripe_checkout_failed'
  | 'missing_checkout_url'
  | 'checkout_route_crashed'
  | string;

function jsonError(input: {
  status: number;
  code: CheckoutErrorCode;
  plan?: PaidPlanKey | null;
  message: string;
  priceEnvKey?: string | null;
  priceId?: string | null;
  stripeCode?: string | null;
  extra?: Record<string, unknown>;
}) {
  return NextResponse.json(
    {
      error: input.message,
      ownerDiagnostic: input.message,
      code: input.code,
      plan: input.plan || null,
      priceEnvKey: input.priceEnvKey || null,
      priceIdPreview: maskStripeId(input.priceId),
      stripeCode: input.stripeCode || null,
      ...(input.extra || {})
    },
    { status: input.status }
  );
}

function routeCrashResponse(error: unknown) {
  const message = error instanceof Error ? error.message : 'Unknown checkout route error';
  console.error('CHECKOUT_ROUTE_CRASHED', {
    message,
    stack: error instanceof Error ? error.stack : null
  });

  return jsonError({
    status: 500,
    code: 'checkout_route_crashed',
    message: `Checkout route crashed before creating Stripe Checkout: ${message}`
  });
}

export async function POST(request: Request) {
  try {
    return await handleCheckout(request);
  } catch (error) {
    return routeCrashResponse(error);
  }
}

async function handleCheckout(request: Request) {
  const stripe = getStripeClient();
  const secretKey = getStripeSecretKey();
  const stripeMode = stripeKeyModeLabel(stripeKeyMode(secretKey));

  if (!stripe) {
    const message = checkoutOwnerDiagnostic({ plan: 'enterprise', code: 'stripe_not_configured' });
    return jsonError({ status: 503, code: 'stripe_not_configured', message });
  }

  const supabase = await createServerSupabase();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    return jsonError({ status: 401, code: 'unauthorized', message: 'Sign in to start checkout.' });
  }

  const body = (await request.json().catch(() => ({}))) as {
    plan?: string;
    refundPolicyAcknowledged?: boolean;
  };

  const plan = normalizePlan(body.plan);
  const refundPolicyAcknowledged = body.refundPolicyAcknowledged === true;

  if (!isPaidCheckoutPlan(plan)) {
    return jsonError({ status: 400, code: 'invalid_plan', message: 'Select a paid plan to checkout.' });
  }

  const priceEnvKey = stripePriceEnvKey(plan);
  const priceId = resolveStripePriceId(plan);
  const priceIdPreview = maskStripeId(priceId);

  logStripeBilling('checkout:request_received', {
    userId: user.id,
    planRequested: plan,
    refundPolicyAcknowledged,
    stripeMode,
    priceEnvKey,
    priceIdFound: Boolean(priceId),
    priceIdPreview
  });

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('role, email, stripe_customer_id, organization_id')
    .eq('id', user.id)
    .maybeSingle();

  if (profileError) {
    return jsonError({
      status: 500,
      code: 'checkout_route_crashed',
      plan,
      priceEnvKey,
      priceId,
      message: `Could not load billing profile: ${profileError.message}`
    });
  }

  const role = normalizeRole(profile?.role || 'owner');
  if (!canManageBilling(role)) {
    return jsonError({
      status: 403,
      code: 'forbidden',
      plan,
      priceEnvKey,
      priceId,
      message: 'Only workspace owners and admins can start checkout.'
    });
  }

  const email = (profile?.email || user.email || '').trim().toLowerCase();
  if (!email) {
    return jsonError({ status: 400, code: 'missing_email', plan, priceEnvKey, priceId, message: 'Account email is required for checkout.' });
  }

  if (!priceId) {
    const message = checkoutOwnerDiagnostic({ plan, code: 'checkout_not_configured', priceEnvKey });
    return jsonError({ status: 503, code: 'checkout_not_configured', plan, priceEnvKey, priceId, message });
  }

  const priceValidation = await validateStripeSubscriptionPriceForPlan(stripe, priceId, plan, { secretKey });
  if (!priceValidation.ok) {
    const message = checkoutOwnerDiagnostic({
      plan,
      code: priceValidation.code,
      priceEnvKey,
      priceIdPreview: priceValidation.pricePreview,
      detail: priceValidation.message,
      stripeCode: priceValidation.stripeCode
    });
    return jsonError({
      status: 422,
      code: priceValidation.code,
      plan,
      priceEnvKey,
      priceId,
      stripeCode: priceValidation.stripeCode,
      message
    });
  }

  let workspaceId = profile?.organization_id || '';
  let ownerUserId = user.id;

  try {
    const orgContext = await fetchOrganizationContextForUser(supabase, user.id);
    workspaceId = workspaceId || orgContext?.organizationId || '';
    ownerUserId = orgContext?.ownerUserId || user.id;
  } catch (error) {
    console.warn('CHECKOUT_ORG_CONTEXT_SKIPPED', {
      userId: user.id,
      message: error instanceof Error ? error.message : 'Unknown organization context error'
    });
  }

  const returnPath = '/settings/billing?checkout=success&session_id={CHECKOUT_SESSION_ID}';
  const successUrl = appUrl(returnPath);
  const cancelUrl = appUrl('/settings/billing?checkout=cancelled');
  const appOriginValue = appOrigin();

  const checkoutStringValidation = validateCheckoutSessionInputs({
    plan,
    priceEnvKey,
    priceId,
    rawPriceEnv: process.env[priceEnvKey],
    successUrl,
    cancelUrl,
    appOrigin: appOriginValue,
    rawAppUrlEnvs: rawAppUrlEnvValues()
  });

  if (!checkoutStringValidation.ok) {
    const message = checkoutOwnerDiagnostic({
      plan,
      code: checkoutStringValidation.code,
      priceEnvKey,
      priceIdPreview,
      detail: checkoutStringValidation.message
    });
    return jsonError({ status: 422, code: checkoutStringValidation.code, plan, priceEnvKey, priceId, message });
  }

  const metadata = {
    plan,
    planKey: plan,
    plan_key: plan,
    tier: plan,
    selected_plan: plan,
    user_id: user.id,
    userId: user.id,
    owner_user_id: ownerUserId,
    ownerUserId,
    email,
    workspace_id: workspaceId,
    workspaceId: workspaceId || '',
    organization_id: workspaceId,
    organizationId: workspaceId || '',
    price_id: priceId,
    billing_source: 'everittos_checkout',
    return_path: returnPath,
    app_url: appOriginValue,
    no_refund_policy: 'true',
    ...(refundPolicyAcknowledged ? { refund_policy_acknowledged: 'true' } : {})
  };

  const sessionParams: Stripe.Checkout.SessionCreateParams = {
    mode: 'subscription',
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: successUrl,
    cancel_url: cancelUrl,
    client_reference_id: `${ownerUserId}:${workspaceId || 'solo'}:${plan}`,
    metadata,
    subscription_data: { metadata },
    custom_text: {
      submit: { message: NO_REFUND_STRIPE_SUBMIT_MESSAGE }
    },
    ...checkoutPromotionParams()
  };

  if (isValidStripeCustomerId(profile?.stripe_customer_id)) {
    sessionParams.customer = profile?.stripe_customer_id;
  } else {
    sessionParams.customer_email = email;
  }

  try {
    logStripeBilling('checkout:session_create_attempt', {
      userId: user.id,
      plan,
      priceEnvKey,
      priceIdPreview,
      workspaceId: workspaceId || null,
      stripeMode,
      checkoutHost: safeCheckoutUrlHostname(successUrl)
    });

    const session = await stripe.checkout.sessions.create(sessionParams);

    if (!session.url || !isStripeCheckoutSessionUrl(session.url)) {
      return jsonError({
        status: 502,
        code: 'missing_checkout_url',
        plan,
        priceEnvKey,
        priceId,
        message: 'Stripe checkout session was created but did not return a checkout.stripe.com URL.',
        extra: { sessionId: session.id }
      });
    }

    logStripeBilling('checkout:session_created', {
      userId: user.id,
      plan,
      sessionId: session.id,
      priceIdPreview,
      workspaceId: workspaceId || null,
      stripeMode,
      checkoutHost: safeCheckoutUrlHostname(session.url)
    });

    return NextResponse.json({
      url: session.url,
      method: 'session',
      sessionId: session.id,
      plan,
      priceIdPreview
    });
  } catch (error) {
    const formatted = formatStripeError(error);
    const message = checkoutOwnerDiagnostic({
      plan,
      code: 'stripe_checkout_failed',
      priceEnvKey,
      priceIdPreview,
      detail: formatted.message,
      stripeCode: formatted.code
    });

    console.error('CHECKOUT_ERROR', {
      plan,
      stripePriceId: priceIdPreview,
      error: formatted.message,
      code: formatted.code,
      type: formatted.type,
      statusCode: formatted.statusCode
    });

    return jsonError({
      status: formatted.statusCode && formatted.statusCode >= 400 && formatted.statusCode < 600 ? formatted.statusCode : 502,
      code: 'stripe_checkout_failed',
      plan,
      priceEnvKey,
      priceId,
      stripeCode: formatted.code,
      message
    });
  }
}
