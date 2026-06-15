import { NextResponse } from 'next/server';
import { isPaidCheckoutPlan, stripePriceIdForPlan } from '@/lib/stripe-prices';
import type { EverittosPlan } from '@/lib/everittos-plans';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const PAID_PLANS: EverittosPlan[] = ['pro', 'business', 'operations', 'growth', 'enterprise'];

export async function GET() {
  const stripeConfigured = Boolean(process.env.STRIPE_SECRET_KEY?.trim());
  const apiCheckoutPlans = PAID_PLANS.filter((plan) => isPaidCheckoutPlan(plan) && Boolean(stripePriceIdForPlan(plan)));

  return NextResponse.json({
    stripeConfigured,
    checkout: stripeConfigured && apiCheckoutPlans.length > 0,
    paymentLinks: false,
    portal: stripeConfigured,
    cancel: stripeConfigured,
    resume: stripeConfigured,
    checkoutPlans: apiCheckoutPlans,
    apiCheckoutPlans
  });
}
