import Stripe from 'stripe';

let stripeClient: Stripe | null = null;

export function getStripeSecretKey(): string | null {
  const key = (process.env.STRIPE_SECRET_KEY || '').trim();
  return key || null;
}

export function getStripeClient(): Stripe | null {
  const key = getStripeSecretKey();
  if (!key) return null;
  if (!stripeClient) {
    stripeClient = new Stripe(key);
  }
  return stripeClient;
}
