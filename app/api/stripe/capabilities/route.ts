import { NextResponse } from 'next/server';
import {
  billingCheckoutAvailable,
  billingCheckoutMethod,
  billingPlanCheckoutTarget,
  PAID_BILLING_PLAN_ORDER
} from '@/lib/billing-config';
import { billingPlanDiagnostics, stripeEnvironmentDiagnostics } from '@/lib/billing-diagnostics';
import type { EverittosPlan } from '@/lib/everittos-plans';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const env = stripeEnvironmentDiagnostics();
  const stripeConfigured = env.stripeSecretKeyConfigured;
  const checkoutPlans = PAID_BILLING_PLAN_ORDER.filter((plan) => billingCheckoutAvailable(plan));
  const planDiagnostics = billingPlanDiagnostics();

  return NextResponse.json({
    stripeConfigured,
    publishableKeyConfigured: env.stripePublishableKeyConfigured,
    webhookConfigured: env.stripeWebhookSecretConfigured,
    checkout: stripeConfigured && checkoutPlans.length > 0,
    portal: stripeConfigured,
    cancel: stripeConfigured,
    resume: stripeConfigured,
    checkoutPlans,
    apiCheckoutPlans: checkoutPlans,
    planDiagnostics,
    plans: PAID_BILLING_PLAN_ORDER.reduce(
      (acc, plan) => {
        const target = billingPlanCheckoutTarget(plan);
        acc[plan] = {
          checkoutAvailable: billingCheckoutAvailable(plan),
          checkoutMethod: billingCheckoutMethod(plan),
          priceIdConfigured: Boolean(target.priceId),
          priceIdPreview: target.priceId ? `${target.priceId.slice(0, 10)}…${target.priceId.slice(-4)}` : null
        };
        return acc;
      },
      {} as Record<
        EverittosPlan,
        {
          checkoutAvailable: boolean;
          checkoutMethod: ReturnType<typeof billingCheckoutMethod>;
          priceIdConfigured: boolean;
          priceIdPreview: string | null;
        }
      >
    )
  });
}
