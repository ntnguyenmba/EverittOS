'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { PlanCheckoutButton } from '@/components/plan-checkout-button';
import { StripePromoCodeField } from '@/components/stripe-promo-code-field';
import { useTranslation } from '@/components/locale-provider';
import {
  EVERITTOS_PLANS,
  EVERITTOS_STRIPE_LINKS,
  normalizePlan,
  type EverittosPlan,
  type PlanDefinition
} from '@/lib/everittos-plans';
import type { PromoDiscountPreview } from '@/lib/stripe-promo';

type PricingCheckoutPanelProps = {
  selectedPlan?: EverittosPlan;
  initialPromoCode?: string;
  authenticated?: boolean;
  compact?: boolean;
};

export function PricingCheckoutPanel({
  selectedPlan = 'pro',
  initialPromoCode = '',
  authenticated = false,
  compact = false
}: PricingCheckoutPanelProps) {
  const { t } = useTranslation();
  const [plan, setPlan] = useState<EverittosPlan>(normalizePlan(selectedPlan) === 'free' ? 'pro' : normalizePlan(selectedPlan));
  const [promoCode, setPromoCode] = useState(initialPromoCode);
  const [promoPreview, setPromoPreview] = useState<PromoDiscountPreview | null>(null);

  const tiers = useMemo(() => EVERITTOS_PLANS.filter((tier) => tier.id !== 'free'), []);

  function signupHref(tier: PlanDefinition): string {
    const params = new URLSearchParams({ plan: tier.id });
    if (promoCode.trim()) params.set('promo', promoCode.trim().toUpperCase());
    return `/signup?${params.toString()}`;
  }

  return (
    <div className={compact ? 'pricing-checkout-panel compact' : 'pricing-checkout-panel'}>
      <StripePromoCodeField
        plan={plan}
        initialCode={initialPromoCode}
        onValidated={(preview) => {
          setPromoPreview(preview);
          setPromoCode(preview?.code ?? '');
        }}
      />

      <div className={compact ? 'pricing-grid compact' : 'pricing-grid'}>
        {tiers.map((tier) => {
          const isSelected = tier.id === plan;
          const fallbackHref = EVERITTOS_STRIPE_LINKS[tier.id as keyof typeof EVERITTOS_STRIPE_LINKS];
          return (
            <div key={tier.id} className={isSelected ? 'card pricing-plan-card selected' : 'card pricing-plan-card'}>
              <button type="button" className="pricing-plan-select" onClick={() => setPlan(tier.id)}>
                <h3>{tier.name}</h3>
                <p className="pricing-plan-price">{tier.priceLabel}</p>
                <p className="muted">{tier.headline}</p>
              </button>
              {isSelected && promoPreview ? (
                <p className="promo-code-inline-price">
                  <span className="promo-code-price-original">{promoPreview.originalPriceLabel}</span>
                  <strong>{promoPreview.discountedPriceLabel}</strong>
                  <span className="muted"> / month</span>
                </p>
              ) : null}
              {authenticated ? (
                <PlanCheckoutButton
                  plan={tier.id}
                  label={tier.buttonLabel}
                  promoCode={isSelected ? promoCode : ''}
                  promoPreview={isSelected ? promoPreview : null}
                  fallbackHref={fallbackHref}
                />
              ) : (
                <Link className="btn btn-primary" href={signupHref(tier)}>
                  {tier.buttonLabel}
                </Link>
              )}
            </div>
          );
        })}
      </div>

      <p className="muted pricing-checkout-note">{t('billing.promo.checkoutNote')}</p>
    </div>
  );
}
