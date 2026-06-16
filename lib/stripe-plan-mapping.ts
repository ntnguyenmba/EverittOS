import type Stripe from 'stripe';
import { normalizePlan, type EverittosPlan } from '@/lib/everittos-plans';
import { planFromStripePriceId } from '@/lib/stripe-prices';

const PAID_PLANS = ['pro', 'business', 'growth', 'enterprise'] as const;

export function normalizeStripePlan(value: string | null | undefined): EverittosPlan | null {
  const raw = (value || '').trim().toLowerCase();
  if (!raw) return null;
  const normalized = normalizePlan(raw);
  if (normalized === 'free') return null;
  if (PAID_PLANS.includes(normalized as (typeof PAID_PLANS)[number])) return normalized;
  return null;
}

export function planFromAmount(amount: number | null | undefined): EverittosPlan | null {
  const cents = amount || 0;
  if (cents === 900 || cents === 9) return 'pro';
  if (cents === 3900 || cents === 39) return 'business';
  if (cents === 14900 || cents === 149) return 'growth';
  if (cents === 39900 || cents === 399) return 'growth';
  if (cents === 79900 || cents === 799) return 'enterprise';
  return null;
}

function productPlanMetadata(
  product: string | Stripe.Product | Stripe.DeletedProduct | null | undefined
): string | null {
  if (!product || typeof product === 'string') return null;
  if ('deleted' in product && product.deleted) return null;
  return product.metadata?.plan || null;
}

export function planFromPrice(price: Stripe.Price | null | undefined): EverittosPlan | null {
  if (!price) return null;

  return (
    planFromStripePriceId(price.id) ||
    normalizeStripePlan(price.metadata?.plan) ||
    normalizeStripePlan(productPlanMetadata(price.product)) ||
    planFromAmount(price.unit_amount)
  );
}

export function planFromSubscription(sub: Stripe.Subscription): EverittosPlan | null {
  const direct =
    normalizeStripePlan(sub.metadata?.plan) ||
    normalizeStripePlan(sub.metadata?.planKey) ||
    normalizeStripePlan(sub.metadata?.selected_plan);
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
    normalizeStripePlan(session.metadata?.selected_plan) ||
    normalizeStripePlan(session.client_reference_id) ||
    planFromAmount(session.amount_subtotal) ||
    planFromAmount(session.amount_total);
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
