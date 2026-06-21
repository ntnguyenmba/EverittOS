import { NextResponse } from 'next/server';
import type Stripe from 'stripe';
import { appUrl } from '@/lib/app-url';
import { billingCheckoutMethod, resolveStripePriceId, stripePriceEnvKey, type PaidPlanKey } from '@/lib/billing-config';
import { maskStripeId } from '@/lib/billing-env';
import { checkoutOwnerDiagnostic, checkoutPublicErrorMessage } from '@/lib/checkout-errors';
import { normalizePlan, type EverittosPlan } from '@/lib/everittos-plans';
import { canManageBilling, normalizeRole } from '@/lib/roles';
import { createAdminSupabase } from '@/lib/supabase-admin';
import { createServerSupabase } from '@/lib/supabase-server';
import { NO_REFUND_STRIPE_SUBMIT_MESSAGE } from '@/lib/no-refund-policy';
import { isPaidCheckoutPlan } from '@/lib/stripe-prices';
import { getStripeClient, getStripeSecretKey } from '@/lib/stripe-server';
import { checkoutPromotionParams } from '@/lib/stripe-checkout-params';
import { isValidStripeCustomerId } from '@/lib/stripe-ids';
import { syncStripeSubscriptionRecord } from '@/lib/stripe-billing-sync';
import { logStripeBilling } from '@/lib/stripe-billing-logs';
import { fetchOrganizationContextForUser } from '@/lib/organization-server';
import { planFromSubscription } from '@/lib/stripe-plan-mapping';
import { stripeKeyMode, stripeKeyModeLabel } from '@/lib/stripe-mode';
import {
  formatStripeError,
  isStripeCheckoutSessionUrl,
  validateStripeSubscriptionPriceForPlan,
  type StripePriceValidationCode
} from '@/lib/stripe-checkout-validation';

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
  ownerUserId: string;
  email: string;
  organizationId: string | null;
  subscription: Stripe.Subscription;
}) {
  const admin = createAdminSupabase();
  if (!admin) return;

  await syncStripeSubscriptionRecord(admin, input.stripe, input.subscription, {
    sessionUserId: input.userId,
    ownerUserId: input.ownerUserId,
    email: input.email,
    workspaceId: input.organizationId
  });
}

async function recordCheckoutFailure(input: {
  email: string;
  userId: string;
  plan: EverittosPlan;
  workspaceId: string | null;
  priceId: string | null;
  error: string;
  ownerDiagnostic?: string;
  code?: string | null;
}) {
  const admin = createAdminSupabase();
  if (!admin) return;

  await admin.from('subscription_events').insert({
    email: input.email,
    event_type: 'checkout.failed',
    plan: input.plan,
    stripe_event_id: `checkout_failed_${input.userId}_${Date.now()}`,
    payload: {
      userId: input.userId,
      workspaceId: input.workspaceId,
      priceId: input.priceId,
      error: input.error,
      ownerDiagnostic: input.ownerDiagnostic || input.error,
      code: input.code || null
    }
  });
}

function checkoutFailureResponse(input: {
  plan: PaidPlanKey;
  code:
    | StripePriceValidationCode
    | 'checkout_not_configured'
    | 'stripe_not_configured'
    | 'stripe_checkout_failed'
    | 'missing_checkout_url';
  status: number;
  priceEnvKey?: string;
  priceId?: string | null;
  detail?: string | null;
  stripeCode?: string | null;
  extra?: Record<string, unknown>;
  /** When true, return actionable ownerDiagnostic text in `error` (checkout callers are owner/admin). */
  useOwnerDiagnosticAsError?: boolean;
}) {
  const priceIdPreview = maskStripeId(input.priceId);
  const ownerDiagnostic = checkoutOwnerDiagnostic({
    plan: input.plan,
    code: input.code,
    priceEnvKey: input.priceEnvKey,
    priceIdPreview,
    detail: input.detail,
    stripeCode: input.stripeCode
  });

  return NextResponse.json(
    {
      error: input.useOwnerDiagnosticAsError
        ? ownerDiagnostic
        : checkoutPublicErrorMessage(input.plan),
      code: input.code,
      plan: input.plan,
      ownerDiagnostic,
      priceEnvKey: input.priceEnvKey || null,
      priceIdPreview,
      stripeCode: input.stripeCode || null,
      ...input.extra
    },
    { status: input.status }
  );
}

export async function POST(request: Request) {
  const stripe = getStripeClient();
  const secretKey = getStripeSecretKey();
  const stripeMode = stripeKeyModeLabel(stripeKeyMode(secretKey));

  if (!stripe) {
    logStripeBilling('checkout:not_configured', { reason: 'stripe_client_missing', stripeMode }, 'warn');
    return NextResponse.json(
      {
        error: 'Billing checkout is not configured correctly. Billing support has been notified.',
        code: 'stripe_not_configured',
        ownerDiagnostic: checkoutOwnerDiagnostic({ plan: 'enterprise', code: 'stripe_not_configured' })
      },
      { status: 503 }
    );
  }

  const supabase = await createServerSupabase();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    logStripeBilling('checkout:unauthenticated', {});
    return NextResponse.json({ error: 'Sign in to start checkout.', code: 'unauthorized' }, { status: 401 });
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
    refundPolicyAcknowledged?: boolean;
  };
  const plan = normalizePlan(body.plan);
  const refundPolicyAcknowledged = body.refundPolicyAcknowledged === true;
  const email = (profile?.email || user.email || '').trim().toLowerCase();

  logStripeBilling('checkout:request_received', {
    userId: user.id,
    planRequested: plan,
    refundPolicyAcknowledged,
    stripeMode
  });

  if (!isPaidCheckoutPlan(plan)) {
    logStripeBilling('checkout:invalid_plan', { userId: user.id, plan });
    return NextResponse.json({ error: 'Select a paid plan to checkout.', code: 'invalid_plan' }, { status: 400 });
  }

  if (!email) {
    logStripeBilling('checkout:missing_email', { userId: user.id, plan });
    return NextResponse.json({ error: 'Account email is required for checkout.', code: 'missing_email' }, { status: 400 });
  }

  const workspaceIdFromProfile = profile?.organization_id || '';
  const orgContext = await fetchOrganizationContextForUser(supabase, user.id);
  const workspaceId = workspaceIdFromProfile || orgContext?.organizationId || '';
  let ownerUserId = orgContext?.ownerUserId || user.id;
  if (workspaceId && !orgContext?.ownerUserId) {
    const { data: org } = await supabase
      .from('organizations')
      .select('owner_user_id')
      .eq('id', workspaceId)
      .maybeSingle();
    if (org?.owner_user_id) ownerUserId = org.owner_user_id;
  }

  const checkoutMethod = billingCheckoutMethod(plan);
  const priceId = resolveStripePriceId(plan);
  const priceEnvKey = stripePriceEnvKey(plan);
  const priceIdPreview = maskStripeId(priceId);

  logStripeBilling('checkout:price_resolution', {
    userId: user.id,
    plan,
    workspaceId: workspaceId || null,
    organizationId: workspaceId || null,
    ownerUserId,
    priceEnvKey,
    priceIdFound: Boolean(priceId),
    priceIdPreview,
    checkoutMethod: checkoutMethod || null,
    stripeMode
  });

  if (!checkoutMethod || !priceId) {
    const ownerDiagnostic = checkoutOwnerDiagnostic({
      plan,
      code: 'checkout_not_configured',
      priceEnvKey
    });
    logStripeBilling(
      'checkout:not_configured',
      {
        userId: user.id,
        plan,
        workspaceId: workspaceId || null,
        reason: 'missing_price_env',
        priceEnvKey,
        stripeMode
      },
      'warn'
    );
    await recordCheckoutFailure({
      email,
      userId: user.id,
      plan,
      workspaceId: workspaceId || null,
      priceId: null,
      error: checkoutPublicErrorMessage(plan),
      ownerDiagnostic,
      code: 'checkout_not_configured'
    });
    return checkoutFailureResponse({
      plan,
      code: 'checkout_not_configured',
      status: 503,
      priceEnvKey,
      useOwnerDiagnosticAsError: true
    });
  }

  const priceValidation = await validateStripeSubscriptionPriceForPlan(stripe, priceId, plan, {
    secretKey
  });

  logStripeBilling('checkout:price_validation', {
    userId: user.id,
    plan,
    workspaceId: workspaceId || null,
    priceEnvKey,
    priceIdPreview,
    stripeMode,
    validationOk: priceValidation.ok,
    validationCode: priceValidation.ok ? 'ok' : priceValidation.code,
    validationMessage: priceValidation.ok ? null : priceValidation.message,
    stripeCode: priceValidation.ok ? null : priceValidation.stripeCode || null
  });

  if (!priceValidation.ok) {
    const ownerDiagnostic = checkoutOwnerDiagnostic({
      plan,
      code: priceValidation.code,
      priceEnvKey,
      priceIdPreview: priceValidation.pricePreview,
      detail: priceValidation.message,
      stripeCode: priceValidation.stripeCode
    });
    logStripeBilling(
      'checkout:price_invalid',
      {
        userId: user.id,
        plan,
        priceIdPreview: priceValidation.pricePreview,
        workspaceId: workspaceId || null,
        error: priceValidation.message,
        code: priceValidation.code,
        stripeCode: priceValidation.stripeCode || null,
        stripeMode
      },
      'error'
    );
    await recordCheckoutFailure({
      email,
      userId: user.id,
      plan,
      workspaceId: workspaceId || null,
      priceId,
      error: checkoutPublicErrorMessage(plan),
      ownerDiagnostic,
      code: priceValidation.code
    });
    return checkoutFailureResponse({
      plan,
      code: priceValidation.code,
      status: 422,
      priceEnvKey,
      priceId,
      detail: priceValidation.message,
      stripeCode: priceValidation.stripeCode,
      useOwnerDiagnosticAsError: true
    });
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
        ownerUserId,
        email,
        organizationId: workspaceId || null,
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

  const returnPath = '/settings/billing?checkout=success&session_id={CHECKOUT_SESSION_ID}';
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
    app_url: appUrl(''),
    no_refund_policy: 'true',
    ...(refundPolicyAcknowledged ? { refund_policy_acknowledged: 'true' } : {})
  };

  const sessionParams: Stripe.Checkout.SessionCreateParams = {
    mode: 'subscription',
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: appUrl(returnPath),
    cancel_url: appUrl('/settings/billing?checkout=cancelled'),
    client_reference_id: `${ownerUserId}:${workspaceId || 'solo'}:${plan}`,
    metadata,
    subscription_data: { metadata },
    custom_text: {
      submit: { message: NO_REFUND_STRIPE_SUBMIT_MESSAGE }
    },
    ...checkoutPromotionParams()
  };

  if (customerId) {
    sessionParams.customer = customerId;
  } else {
    sessionParams.customer_email = email;
  }

  try {
    logStripeBilling('checkout:session_create_attempt', {
      userId: user.id,
      plan,
      priceIdPreview,
      workspaceId: workspaceId || null,
      organizationId: workspaceId || null,
      customerId: customerId || null,
      stripeMode,
      billingSource: metadata.billing_source
    });

    const session = await stripe.checkout.sessions.create(sessionParams);

    logStripeBilling('checkout:session_metadata', {
      sessionId: session.id,
      userId: user.id,
      ownerUserId,
      workspaceId: workspaceId || null,
      organizationId: workspaceId || null,
      email,
      plan,
      priceIdPreview,
      clientReferenceId: session.client_reference_id,
      stripeResponseUrl: session.url || null,
      checkoutHost: session.url ? new URL(session.url).hostname : null
    });

    logStripeBilling('checkout:session_created', {
      userId: user.id,
      plan,
      sessionId: session.id,
      customerId: customerId,
      priceIdPreview,
      workspaceId: workspaceId || null,
      stripeMode,
      checkoutHost: session.url ? new URL(session.url).hostname : null
    });

    if (!session.url || !isStripeCheckoutSessionUrl(session.url)) {
      const message = 'Stripe checkout session was created without a checkout.stripe.com redirect URL.';
      const ownerDiagnostic = checkoutOwnerDiagnostic({
        plan,
        code: 'stripe_checkout_failed',
        priceEnvKey,
        priceIdPreview,
        detail: message
      });
      await recordCheckoutFailure({
        email,
        userId: user.id,
        plan,
        workspaceId: workspaceId || null,
        priceId,
        error: checkoutPublicErrorMessage(plan),
        ownerDiagnostic,
        code: 'missing_checkout_url'
      });
      return checkoutFailureResponse({
        plan,
        code: 'missing_checkout_url',
        status: 502,
        priceEnvKey,
        priceId,
        detail: message,
        extra: { sessionId: session.id },
        useOwnerDiagnosticAsError: true
      });
    }

    return NextResponse.json({
      url: session.url,
      method: 'session',
      sessionId: session.id,
      plan,
      priceIdPreview
    });
  } catch (error) {
    const formatted = formatStripeError(error);
    const ownerDiagnostic = checkoutOwnerDiagnostic({
      plan,
      code: 'stripe_checkout_failed',
      priceEnvKey,
      priceIdPreview,
      detail: formatted.message,
      stripeCode: formatted.code
    });
    logStripeBilling(
      'checkout:session_create_failed',
      {
        userId: user.id,
        plan,
        priceIdPreview,
        workspaceId: workspaceId || null,
        error: formatted.message,
        stripeCode: formatted.code,
        stripeType: formatted.type,
        stripeStatus: formatted.statusCode,
        stripeMode
      },
      'error'
    );
    await recordCheckoutFailure({
      email,
      userId: user.id,
      plan,
      workspaceId: workspaceId || null,
      priceId,
      error: checkoutPublicErrorMessage(plan),
      ownerDiagnostic,
      code: formatted.code || 'stripe_checkout_failed'
    });
    return checkoutFailureResponse({
      plan,
      code: 'stripe_checkout_failed',
      status:
        formatted.statusCode && formatted.statusCode >= 400 && formatted.statusCode < 600
          ? formatted.statusCode
          : 502,
      priceEnvKey,
      priceId,
      detail: formatted.message,
      stripeCode: formatted.code,
      useOwnerDiagnosticAsError: true
    });
  }
}
