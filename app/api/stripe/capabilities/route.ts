import { NextResponse } from 'next/server';
import {
  billingCheckoutAvailable,
  billingCheckoutMethod,
  PAID_BILLING_PLAN_ORDER
} from '@/lib/billing-config';
import type { EverittosPlan } from '@/lib/everittos-plans';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const stripeConfigured = Boolean(process.env.STRIPE_SECRET_KEY?.trim());
  const checkoutPlans = PAID_BILLING_PLAN_ORDER.filter((plan) => billingCheckoutAvailable(plan));
  const sessionCheckoutPlans = PAID_BILLING_PLAN_ORDER.filter(
    (plan) => billingCheckoutMethod(plan) === 'session'
  );
  const paymentLinkPlans = PAID_BILLING_PLAN_ORDER.filter(
    (plan) => billingCheckoutMethod(plan) === 'payment_link'
  );

  return NextResponse.json({
    stripeConfigured,
    checkout: stripeConfigured && checkoutPlans.length > 0,
    paymentLinks: paymentLinkPlans.length > 0,
    portal: stripeConfigured,
    cancel: stripeConfigured,
    resume: stripeConfigured,
    checkoutPlans,
    apiCheckoutPlans: sessionCheckoutPlans,
    paymentLinkPlans,
    plans: PAID_BILLING_PLAN_ORDER.reduce(
      (acc, plan) => {
        acc[plan] = {
          checkoutAvailable: billingCheckoutAvailable(plan),
          checkoutMethod: billingCheckoutMethod(plan)
        };
        return acc;
      },
      {} as Record<
        EverittosPlan,
        { checkoutAvailable: boolean; checkoutMethod: ReturnType<typeof billingCheckoutMethod> }
      >
    )
  });
}
