'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { PlanCheckoutButton } from '@/components/plan-checkout-button';
import { NoRefundDisclosure } from '@/components/legal/no-refund-disclosure';
import { useTranslation } from '@/components/locale-provider';
import { billingCheckoutTargetForPlan } from '@/lib/billing-plan-card';
import { BILLING_PLANS } from '@/lib/billing-config';
import { normalizePlan, type EverittosPlan } from '@/lib/everittos-plans';

type PricingCheckoutPanelProps = {
  selectedPlan?: EverittosPlan;
  authenticated?: boolean;
  compact?: boolean;
};

export function PricingCheckoutPanel({
  selectedPlan = 'pro',
  authenticated = false,
  compact = false
}: PricingCheckoutPanelProps) {
  const { t } = useTranslation();
  const [plan, setPlan] = useState<EverittosPlan>(
    normalizePlan(selectedPlan) === 'free' ? 'pro' : normalizePlan(selectedPlan)
  );

  const tiers = useMemo(() => BILLING_PLANS.filter((tier) => tier.id !== 'free'), []);

  function signupHref(tierId: EverittosPlan): string {
    return `/signup?plan=${tierId}`;
  }

  return (
    <div className={compact ? 'pricing-checkout-panel compact' : 'pricing-checkout-panel'}>
      <NoRefundDisclosure variant="compact" className="pricing-checkout-policy" />

      <p className="muted billing-promo-stripe-note">
        Promo codes can be entered securely inside Stripe Checkout.
      </p>

      <div className={compact ? 'pricing-grid compact' : 'pricing-grid'}>
        {tiers.map((tier) => {
          const checkout = billingCheckoutTargetForPlan(tier.id as Exclude<EverittosPlan, 'free'>);
          const isSelected = tier.id === plan;
          return (
            <div
              key={tier.id}
              className={[
                'card',
                'pricing-plan-card',
                isSelected ? 'selected' : '',
                tier.featured ? 'featured-plan' : ''
              ]
                .filter(Boolean)
                .join(' ')}
            >
              <button type="button" className="pricing-plan-select" onClick={() => setPlan(tier.id)}>
                <h3>{tier.name}</h3>
                <p className="pricing-plan-price">{tier.priceLabel}</p>
                <p className="muted">{tier.headline}</p>
              </button>
              {authenticated ? (
                <PlanCheckoutButton
                  plan={tier.id}
                  label={checkout.buttonLabel}
                  checkoutUrl={checkout.checkoutUrl}
                  priceId={checkout.priceId}
                  method={checkout.method}
                />
              ) : (
                <Link className="btn btn-primary" href={signupHref(tier.id)}>
                  {checkout.buttonLabel}
                </Link>
              )}
            </div>
          );
        })}
      </div>

      <p className="muted pricing-checkout-note">{t('billing.promo.checkoutNote')}</p>
      <p className="muted pricing-checkout-note">{t('billing.noRefund.cancelNote')}</p>
    </div>
  );
}
