import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { createAdminSupabase } from '@/lib/supabase-admin';
import { sanitizeBillingEnvValue } from '@/lib/billing-env';
import { POST as handleEverittOSWebhook } from '../webhook/route';

export const runtime = 'nodejs';

type ReRootPlan = 'monthly' | 'yearly' | 'report';
type ReRootStatus = 'active' | 'trialing' | 'past_due' | 'canceled' | 'expired' | 'refunded' | 'inactive';

function normalizeReRootPlan(value: string | null | undefined): ReRootPlan | null {
  const plan = String(value || '')
    .trim()
    .toLowerCase();
  if (plan === 'annual' || plan === 'yearly') return 'yearly';
  if (plan === 'monthly') return 'monthly';
  if (plan === 'report' || plan === 'plan') return 'report';
  return null;
}

function reRootPriceIds(): Set<string> {
  return new Set(
    [
      sanitizeBillingEnvValue(process.env.REROOT_STRIPE_PRICE_REPORT),
      sanitizeBillingEnvValue(process.env.REROOT_STRIPE_PRICE_MONTHLY),
      sanitizeBillingEnvValue(process.env.REROOT_STRIPE_PRICE_YEARLY)
    ].filter(Boolean) as string[]
  );
}

function reRootProductIds(): Set<string> {
  return new Set(
    [
      sanitizeBillingEnvValue(process.env.REROOT_STRIPE_PRODUCT_REPORT),
      sanitizeBillingEnvValue(process.env.REROOT_STRIPE_PRODUCT_MONTHLY),
      sanitizeBillingEnvValue(process.env.REROOT_STRIPE_PRODUCT_YEARLY)
    ].filter(Boolean) as string[]
  );
}

function planFromPriceOrProduct(priceId: string | null, productId: string | null): ReRootPlan | null {
  const price = sanitizeBillingEnvValue(priceId || '') || '';
  const product = sanitizeBillingEnvValue(productId || '') || '';
  if (price && price === sanitizeBillingEnvValue(process.env.REROOT_STRIPE_PRICE_YEARLY)) return 'yearly';
  if (price && price === sanitizeBillingEnvValue(process.env.REROOT_STRIPE_PRICE_MONTHLY)) return 'monthly';
  if (price && price === sanitizeBillingEnvValue(process.env.REROOT_STRIPE_PRICE_REPORT)) return 'report';
  if (product && product === sanitizeBillingEnvValue(process.env.REROOT_STRIPE_PRODUCT_YEARLY)) return 'yearly';
  if (product && product === sanitizeBillingEnvValue(process.env.REROOT_STRIPE_PRODUCT_MONTHLY)) return 'monthly';
  if (product && product === sanitizeBillingEnvValue(process.env.REROOT_STRIPE_PRODUCT_REPORT)) return 'report';
  return null;
}

function isReRootEvent(event: Stripe.Event): boolean {
  const prices = reRootPriceIds();
  const products = reRootProductIds();
  if (!prices.size && !products.size) return false;

  const obj = event.data.object as {
    metadata?: Stripe.Metadata | null;
    lines?: { data?: Array<{ price?: { id?: string; product?: string | { id?: string } } }> };
    items?: { data?: Array<{ price?: { id?: string; product?: string | { id?: string } } }> };
    display_items?: unknown;
  };

  if (String(obj.metadata?.product || '').toLowerCase() === 'reroot') return true;
  if (normalizeReRootPlan(obj.metadata?.plan)) return true;

  const candidates: Array<{ id?: string; product?: string | { id?: string } }> = [];
  for (const line of obj.lines?.data || []) {
    if (line.price) candidates.push(line.price);
  }
  for (const item of obj.items?.data || []) {
    if (item.price) candidates.push(item.price);
  }

  for (const price of candidates) {
    if (price.id && prices.has(price.id)) return true;
    const productId = typeof price.product === 'string' ? price.product : price.product?.id;
    if (productId && products.has(productId)) return true;
  }

  return false;
}

function mapSubscriptionStatus(status: string | null | undefined): ReRootStatus {
  switch (String(status || '').toLowerCase()) {
    case 'active':
      return 'active';
    case 'trialing':
      return 'trialing';
    case 'past_due':
      return 'past_due';
    case 'canceled':
    case 'cancelled':
      return 'canceled';
    case 'unpaid':
    case 'incomplete_expired':
      return 'expired';
    default:
      return 'inactive';
  }
}

async function syncReRootEntitlement(input: {
  email: string | null;
  userId: string | null;
  plan: ReRootPlan;
  status: ReRootStatus;
  premiumUntil: string | null;
}): Promise<void> {
  const admin = createAdminSupabase();
  if (!admin) return;

  const grantsAccess = input.status === 'active' || input.status === 'trialing';
  const patch = {
    reroot_report_access: grantsAccess && (input.plan === 'report' || input.plan === 'monthly' || input.plan === 'yearly'),
    reroot_premium_until: grantsAccess ? input.premiumUntil : null,
    updated_at: new Date().toISOString()
  };

  if (input.userId) {
    await admin.from('profiles').update(patch).eq('id', input.userId);
    return;
  }

  if (input.email) {
    await admin.from('profiles').update(patch).ilike('email', input.email.trim().toLowerCase());
  }
}

async function handleReRootEvent(stripe: Stripe, event: Stripe.Event): Promise<NextResponse> {
  let plan: ReRootPlan | null = null;
  let status: ReRootStatus = 'inactive';
  let email: string | null = null;
  let userId: string | null = null;
  let premiumUntil: string | null = null;

  if (event.type.startsWith('customer.subscription.')) {
    const sub = event.data.object as Stripe.Subscription;
    const price = sub.items.data[0]?.price;
    const productId = typeof price?.product === 'string' ? price.product : price?.product?.id || null;
    plan =
      planFromPriceOrProduct(price?.id || null, productId) ||
      normalizeReRootPlan(sub.metadata?.plan) ||
      'monthly';
    status = mapSubscriptionStatus(sub.status);
    userId = sub.metadata?.user_id || sub.metadata?.userId || null;
    premiumUntil = sub.current_period_end ? new Date(sub.current_period_end * 1000).toISOString() : null;
    if (typeof sub.customer === 'string') {
      const customer = await stripe.customers.retrieve(sub.customer);
      if (!('deleted' in customer)) email = customer.email || null;
    }
  } else if (event.type === 'checkout.session.completed') {
    const session = event.data.object as Stripe.Checkout.Session;
    plan = normalizeReRootPlan(session.metadata?.plan) || 'report';
    status = 'active';
    email = session.customer_details?.email || session.customer_email || null;
    userId = session.metadata?.user_id || session.metadata?.userId || null;
    if (session.mode === 'payment') {
      // One-time report purchase: grant access without a long premium window unless metadata provides one.
      premiumUntil = session.metadata?.premium_until || null;
    }
  } else if (event.type === 'charge.refunded' || event.type === 'invoice.payment_failed') {
    status = event.type === 'charge.refunded' ? 'refunded' : 'past_due';
    plan = 'monthly';
  }

  if (plan) {
    await syncReRootEntitlement({ email, userId, plan, status, premiumUntil });
  }

  return NextResponse.json({ received: true, product: 'reroot' });
}

/**
 * Dual-purpose Stripe webhook router.
 * ReRoot price/product IDs are synced to profile ReRoot fields.
 * All other events are forwarded to the EverittOS Stripe webhook handler.
 */
export async function POST(request: Request) {
  const stripeKey = process.env.STRIPE_SECRET_KEY;
  const webhookSecret =
    process.env.STRIPE_ROUTER_WEBHOOK_SECRET ||
    process.env.REROOT_STRIPE_WEBHOOK_SECRET ||
    process.env.STRIPE_WEBHOOK_SECRET;

  if (!stripeKey || !webhookSecret) {
    return NextResponse.json({ error: 'Stripe webhook is not configured.' }, { status: 503 });
  }

  const stripe = new Stripe(stripeKey);
  const signature = request.headers.get('stripe-signature');
  if (!signature) {
    return NextResponse.json({ error: 'Missing Stripe signature.' }, { status: 400 });
  }

  const rawBody = await request.text();
  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
  } catch (error) {
    return NextResponse.json(
      { error: `Webhook signature verification failed: ${(error as Error).message}` },
      { status: 400 }
    );
  }

  if (isReRootEvent(event)) {
    try {
      return await handleReRootEvent(stripe, event);
    } catch (error) {
      console.error('REROOT_STRIPE_ROUTER_FAILED', (error as Error).message);
      return NextResponse.json({ error: 'Unable to process ReRoot event.' }, { status: 500 });
    }
  }

  // Rebuild a Request with the raw body for the EverittOS webhook handler.
  const forwarded = new Request(request.url.replace(/\/router$/, '/webhook'), {
    method: 'POST',
    headers: request.headers,
    body: rawBody
  });
  return handleEverittOSWebhook(forwarded);
}
