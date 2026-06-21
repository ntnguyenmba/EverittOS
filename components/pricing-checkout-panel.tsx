'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { PlanCheckoutButton } from '@/components/plan-checkout-button';
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
                'billing-plan-card',
                isSelected ? 'selected' : '',
                tier.featured ? 'featured-plan' : ''
              ]
                .filter(Boolean)
                .join(' ')}
            >
              <div className="billing-plan-card-body">
                <button type="button" className="pricing-plan-select" onClick={() => setPlan(tier.id)}>
                  <h3>{tier.name}</h3>
                  <p className="pricing-plan-price">{tier.priceLabel}</p>
                  <p className="muted">{tier.headline}</p>
                </button>
              </div>
              <div className="billing-plan-card-footer">
                <div className="billing-plan-card-cta">
                  {authenticated ? (
                    <PlanCheckoutButton
                      plan={tier.id}
                      label={checkout.buttonLabel}
                      className="btn btn-primary btn-block"
                    />
                  ) : (
                    <>
                      <div className="billing-plan-ack-spacer" aria-hidden="true" />
                      <Link className="btn btn-primary btn-block" href={signupHref(tier.id)}>
                        {checkout.buttonLabel}
                      </Link>
                    </>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <p className="muted pricing-checkout-note">{t('billing.promo.checkoutNote')}</p>
    </div>
  );
}
