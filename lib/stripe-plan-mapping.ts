import type Stripe from 'stripe';
import { normalizePlan, type EverittosPlan } from '@/lib/everittos-plans';
import {
  planFromKnownStripePriceId,
  planFromKnownStripeProductId
} from '@/lib/billing-config';
import { planFromStripePriceId } from '@/lib/stripe-prices';

const PAID_PLANS = ['pro', 'business', 'starter', 'growth', 'enterprise'] as const;

export function normalizeStripePlan(value: string | null | undefined): EverittosPlan | null {
  const raw = (value || '').trim().toLowerCase();
  if (!raw) return null;
  const normalized = normalizePlan(raw);
  if (normalized === 'free') return null;
  if (PAID_PLANS.includes(normalized as (typeof PAID_PLANS)[number])) return normalized;
  return null;
}

function productPlanMetadata(
  product: string | Stripe.Product | Stripe.DeletedProduct | null | undefined
): string | null {
  if (!product || typeof product === 'string') return null;
  if ('deleted' in product && product.deleted) return null;
  return (
    product.metadata?.plan ||
    product.metadata?.plan_key ||
    product.metadata?.planKey ||
    product.metadata?.tier ||
    null
  );
}

/**
 * Resolve an EverittOS plan only from identifiers or explicit metadata owned by
 * EverittOS. Never infer a plan from price alone because the Stripe account is
 * shared with other applications that may charge the same amount.
 */
export function planFromPrice(price: Stripe.Price | null | undefined): EverittosPlan | null {
  if (!price) return null;

  const productId = typeof price.product === 'string' ? price.product : price.product?.id;

  return (
    planFromStripePriceId(price.id) ||
    planFromKnownStripePriceId(price.id) ||
    planFromKnownStripeProductId(productId) ||
    normalizeStripePlan(price.metadata?.plan) ||
    normalizeStripePlan(price.metadata?.plan_key) ||
    normalizeStripePlan(price.metadata?.planKey) ||
    normalizeStripePlan(price.metadata?.tier) ||
    normalizeStripePlan(productPlanMetadata(price.product))
  );
}

export function planFromSubscription(sub: Stripe.Subscription): EverittosPlan | null {
  const direct =
    normalizeStripePlan(sub.metadata?.plan) ||
    normalizeStripePlan(sub.metadata?.planKey) ||
    normalizeStripePlan(sub.metadata?.plan_key) ||
    normalizeStripePlan(sub.metadata?.tier) ||
    normalizeStripePlan(sub.metadata?.selected_plan) ||
    normalizeStripePlan(sub.metadata?.product);
  if (direct) return direct;

  for (const item of sub.items.data) {
    const plan = planFromPrice(item.price);
    if (plan) return plan;
  }

  return null;
}

export function primaryStripePriceId(sub: Stripe.Subscription): string | null {
  const price = sub.items.data[0]?.price;
  if (!price) return null;
  return typeof price === 'string' ? price : price.id;
}

export async function planFromSession(
  stripe: Stripe,
  session: Stripe.Checkout.Session
): Promise<EverittosPlan | null> {
  const direct =
    normalizeStripePlan(session.metadata?.plan) ||
    normalizeStripePlan(session.metadata?.planKey) ||
    normalizeStripePlan(session.metadata?.plan_key) ||
    normalizeStripePlan(session.metadata?.tier) ||
    normalizeStripePlan(session.metadata?.selected_plan) ||
    normalizeStripePlan(session.client_reference_id);
  if (direct) return direct;

  try {
    const lineItems = await stripe.checkout.sessions.listLineItems(session.id, {
      limit: 5,
      expand: ['data.price.product']
    });

    for (const item of lineItems.data) {
      const plan = planFromPrice(item.price);
      if (plan) return plan;
    }
  } catch (error) {
    console.warn('[stripe-plan-mapping] Could not read checkout line items', error);
  }

  return null;
}

export function stripePriceIdFromSession(session: Stripe.Checkout.Session): string | null {
  return session.metadata?.price_id?.trim() || null;
}

export function planFromCheckoutSession(
  session: Stripe.Checkout.Session,
  lineItems?: Stripe.LineItem[] | null
): EverittosPlan | null {
  const direct =
    normalizeStripePlan(session.metadata?.plan) ||
    normalizeStripePlan(session.metadata?.planKey) ||
    normalizeStripePlan(session.metadata?.plan_key) ||
    normalizeStripePlan(session.metadata?.tier) ||
    normalizeStripePlan(session.metadata?.selected_plan) ||
    normalizeStripePlan(session.client_reference_id);
  if (direct) return direct;

  for (const item of lineItems || []) {
    const plan = planFromPrice(item.price);
    if (plan) return plan;
  }

  return null;
}
