import { NextResponse } from 'next/server';
import { isPaidCheckoutPlan, stripePriceIdForPlan } from '@/lib/stripe-prices';
import { stripePaymentLinkPlans, stripePaymentLinksConfigured } from '@/lib/stripe-payment-link';
import type { EverittosPlan } from '@/lib/everittos-plans';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const PAID_PLANS: EverittosPlan[] = ['pro', 'business', 'operations', 'growth', 'enterprise'];

export async function GET() {
  const paymentLinksReady = stripePaymentLinksConfigured();
  const stripeConfigured = Boolean(process.env.STRIPE_SECRET_KEY?.trim());
  const apiCheckoutPlans = PAID_PLANS.filter((plan) => isPaidCheckoutPlan(plan) && Boolean(stripePriceIdForPlan(plan)));
  const paymentLinkPlans = paymentLinksReady ? stripePaymentLinkPlans() : [];
  const checkoutPlans = paymentLinksReady ? paymentLinkPlans : apiCheckoutPlans;

  return NextResponse.json({
    stripeConfigured: paymentLinksReady || stripeConfigured,
    checkout: paymentLinksReady || (stripeConfigured && apiCheckoutPlans.length > 0),
    paymentLinks: paymentLinksReady,
    portal: stripeConfigured,
    cancel: stripeConfigured,
    resume: stripeConfigured,
    checkoutPlans,
    paymentLinkPlans,
    apiCheckoutPlans
  });
}
