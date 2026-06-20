import Stripe from 'stripe';
import { sanitizeBillingEnvValue } from '@/lib/billing-env';

let stripeClient: Stripe | null = null;

export function getStripeSecretKey(): string | null {
  const key = sanitizeBillingEnvValue(process.env.STRIPE_SECRET_KEY);
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
