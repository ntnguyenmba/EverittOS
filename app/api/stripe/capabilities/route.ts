import { NextResponse } from 'next/server';
import {
  billingCheckoutMethod,
  billingPlanCheckoutTarget,
  PAID_BILLING_PLAN_ORDER
} from '@/lib/billing-config';
import { billingPlanStripeDiagnostics, stripeEnvironmentDiagnostics } from '@/lib/billing-diagnostics';
import { billingRuntimeDiagnostics } from '@/lib/billing-runtime';
import { getStripeClient } from '@/lib/stripe-server';
import type { EverittosPlan } from '@/lib/everittos-plans';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const env = stripeEnvironmentDiagnostics();
  const runtime = billingRuntimeDiagnostics();
  const stripe = getStripeClient();
  const planDiagnostics = await billingPlanStripeDiagnostics(stripe);
  const checkoutPlans = planDiagnostics.filter((row) => row.checkoutAvailable).map((row) => row.plan);

  return NextResponse.json({
    stripeConfigured: env.stripeSecretKeyConfigured,
    publishableKeyConfigured: env.stripePublishableKeyConfigured,
    webhookConfigured: env.stripeWebhookSecretConfigured,
    stripeKeyMode: env.stripeKeyMode,
    stripeKeyModeLabel: env.stripeKeyModeLabel,
    checkout: env.stripeSecretKeyConfigured && checkoutPlans.length > 0,
    portal: env.stripeSecretKeyConfigured,
    cancel: env.stripeSecretKeyConfigured,
    resume: env.stripeSecretKeyConfigured,
    checkoutPlans,
    apiCheckoutPlans: checkoutPlans,
    runtime,
    planDiagnostics,
    plans: PAID_BILLING_PLAN_ORDER.reduce(
      (acc, plan) => {
        const target = billingPlanCheckoutTarget(plan);
        const diagnostic = planDiagnostics.find((row) => row.plan === plan);
        acc[plan] = {
          checkoutAvailable: Boolean(diagnostic?.checkoutAvailable),
          checkoutMethod: billingCheckoutMethod(plan),
          priceIdConfigured: Boolean(target.priceId),
          priceIdPreview: target.priceId ? `${target.priceId.slice(0, 10)}…${target.priceId.slice(-4)}` : null,
          validationCode: diagnostic?.validationCode || null,
          validationMessage: diagnostic?.validationMessage || null,
          stripeValidated: diagnostic?.stripeValidated ?? false
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
          validationCode: string | null;
          validationMessage: string | null;
          stripeValidated: boolean;
        }
      >
    )
  });
}
