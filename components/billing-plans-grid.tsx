'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { PlanCheckoutButton } from '@/components/plan-checkout-button';
import { choosePlanButtonLabel, planCardAction } from '@/lib/billing-plan-actions';
import { EVERITTOS_PLANS, EVERITTOS_STRIPE_LINKS, normalizePlan, type EverittosPlan } from '@/lib/everittos-plans';
import { SUPPORT_EMAIL, supportMailtoHref } from '@/lib/support';
import type { PromoDiscountPreview } from '@/lib/stripe-promo';
import { useTranslation } from '@/components/locale-provider';

type StripeCapabilities = {
  stripeConfigured: boolean;
  checkout: boolean;
  portal: boolean;
  cancel: boolean;
  resume: boolean;
  checkoutPlans: EverittosPlan[];
};

type BillingPlansGridProps = {
  currentPlan: EverittosPlan;
  highlightPlan?: EverittosPlan;
  /** Applied promo code passed to Stripe checkout */
  promoCode?: string;
  promoPreview?: PromoDiscountPreview | null;
};

export function BillingPlansGrid({
  currentPlan,
  highlightPlan,
  promoCode = '',
  promoPreview = null
}: BillingPlansGridProps) {
  const { t } = useTranslation();
  const normalizedCurrent = normalizePlan(currentPlan);
  const [capabilities, setCapabilities] = useState<StripeCapabilities | null>(null);

  useEffect(() => {
    fetch('/api/stripe/capabilities', { cache: 'no-store' })
      .then((res) => (res.ok ? res.json() : null))
      .then((json) => setCapabilities(json))
      .catch(() => setCapabilities(null));
  }, []);

  const checkoutEnabled = Boolean(capabilities?.checkout);
  const selfServePlanChanges = checkoutEnabled || Boolean(capabilities?.portal);
  const appliedPromoCode = promoPreview?.code || promoCode.trim();

  return (
    <div className="billing-plans-grid-wrap">
      <div className="billing-plans-grid pricing-grid">
        {EVERITTOS_PLANS.map((tier) => {
          const action = planCardAction(normalizedCurrent, tier.id);
          const isCurrent = action.type === 'current';
          const isHighlighted = highlightPlan === tier.id;
          const fallbackHref = EVERITTOS_STRIPE_LINKS[tier.id as keyof typeof EVERITTOS_STRIPE_LINKS];
          const canCheckoutThisPlan =
            checkoutEnabled && tier.id !== 'free' && (capabilities?.checkoutPlans || []).includes(tier.id);
          const showPromoPricing =
            promoPreview &&
            tier.id === (highlightPlan && highlightPlan !== 'free' ? highlightPlan : 'pro');

          return (
            <div
              key={tier.id}
              className={[
                'card',
                'pricing-plan-card',
                'billing-plan-card',
                isCurrent ? 'current-plan' : '',
                isHighlighted ? 'highlighted' : ''
              ]
                .filter(Boolean)
                .join(' ')}
            >
              {isCurrent ? <span className="billing-plan-badge">{t('billing.currentPlanBadge')}</span> : null}
              <h3>{tier.name}</h3>
              {showPromoPricing && promoPreview ? (
                <p className="pricing-plan-price">
                  <span className="promo-code-price-original">{promoPreview.originalPriceLabel}</span>{' '}
                  <strong>{promoPreview.discountedPriceLabel}</strong>
                  <span className="muted"> / mo</span>
                </p>
              ) : (
                <p className="pricing-plan-price">{tier.priceLabel}</p>
              )}
              <p className="muted">{tier.headline}</p>
              <ul className="billing-plan-features">
                {tier.features.slice(0, 4).map((feature) => (
                  <li key={feature}>{feature}</li>
                ))}
              </ul>

              {action.type === 'current' ? (
                <p className="billing-plan-current-label">{t('billing.currentPlanBadge')}</p>
              ) : null}

              {action.type === 'choose' && canCheckoutThisPlan ? (
                <PlanCheckoutButton
                  plan={action.plan}
                  label={action.label}
                  promoCode={appliedPromoCode}
                  promoPreview={promoPreview}
                  fallbackHref={fallbackHref}
                  className="btn btn-primary btn-block"
                />
              ) : null}

              {action.type === 'choose' && !canCheckoutThisPlan ? (
                <a className="btn btn-primary btn-block" href={supportMailtoHref(`EverittOS ${tier.name} plan`)}>
                  {t('billing.contactBillingSupport')}
                </a>
              ) : null}

              {action.type === 'contact' ? (
                <a className="btn btn-block" href={action.href}>
                  {action.label}
                </a>
              ) : null}

              {tier.id === 'free' && normalizedCurrent !== 'free' ? (
                <p className="muted billing-plan-note">{t('billing.downgradeSupportNote')}</p>
              ) : null}
            </div>
          );
        })}
      </div>

      {!selfServePlanChanges ? (
        <p className="billing-support-fallback">
          {t('billing.planChangesSupport')}{' '}
          <a href={supportMailtoHref('EverittOS billing')}>{SUPPORT_EMAIL}</a>
        </p>
      ) : null}

      <p className="muted billing-plans-footnote">
        {t('billing.plansFootnote')}{' '}
        <Link href="/terms">{t('legal.terms')}</Link> · <Link href="/privacy">{t('legal.privacy')}</Link>
      </p>
      <p className="muted billing-plans-footnote">{t('billing.promo.checkoutNote')}</p>
    </div>
  );
}

/** Exported for tests and reuse */
export { choosePlanButtonLabel };
