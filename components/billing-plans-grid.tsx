'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { PlanCheckoutButton } from '@/components/plan-checkout-button';
import { NoRefundDisclosure } from '@/components/legal/no-refund-disclosure';
import { StripePromoCodeField } from '@/components/stripe-promo-code-field';
import { choosePlanButtonLabel, planCardAction } from '@/lib/billing-plan-actions';
import { EVERITTOS_PLANS, normalizePlan, type EverittosPlan } from '@/lib/everittos-plans';
import { SUPPORT_EMAIL, supportMailtoHref } from '@/lib/support';
import { useTranslation } from '@/components/locale-provider';
import type { PromoDiscountPreview } from '@/lib/stripe-promo';

type BillingPlansGridProps = {
  currentPlan: EverittosPlan;
  highlightPlan?: EverittosPlan;
};

export function BillingPlansGrid({ currentPlan, highlightPlan }: BillingPlansGridProps) {
  const { t } = useTranslation();
  const normalizedCurrent = normalizePlan(currentPlan);
  const paidPlans = useMemo(() => EVERITTOS_PLANS.filter((tier) => tier.id !== 'free'), []);
  const [selectedPromoPlan, setSelectedPromoPlan] = useState<EverittosPlan>(
    highlightPlan && highlightPlan !== 'free' ? highlightPlan : normalizedCurrent !== 'free' ? normalizedCurrent : 'pro'
  );
  const [promoCode, setPromoCode] = useState('');
  const [promoPreview, setPromoPreview] = useState<PromoDiscountPreview | null>(null);

  return (
    <div className="billing-plans-grid-wrap">
      <NoRefundDisclosure variant="card" className="billing-plans-policy" />

      <div className="settings-card billing-promo-card">
        <div className="billing-promo-card-head">
          <div>
            <h3>{t('billing.promo.label')}</h3>
            <p className="muted">Apply a promo code before choosing a paid plan.</p>
          </div>
          <label className="billing-promo-plan-select">
            <span className="muted">Preview for</span>
            <select
              value={selectedPromoPlan}
              onChange={(event) => {
                setSelectedPromoPlan(normalizePlan(event.target.value));
                setPromoPreview(null);
              }}
            >
              {paidPlans.map((tier) => (
                <option key={tier.id} value={tier.id}>
                  {tier.name}
                </option>
              ))}
            </select>
          </label>
        </div>
        <StripePromoCodeField
          plan={selectedPromoPlan}
          onValidated={(preview) => {
            setPromoPreview(preview);
            setPromoCode(preview?.code ?? '');
          }}
        />
      </div>

      <div className="billing-plans-grid pricing-grid">
        {EVERITTOS_PLANS.map((tier) => {
          const action = planCardAction(normalizedCurrent, tier.id);
          const isCurrent = action.type === 'current';
          const isHighlighted = highlightPlan === tier.id;
          const isPaidChoice = action.type === 'choose' && tier.id !== 'free';
          const promoAppliesToThisPlan = isPaidChoice && selectedPromoPlan === tier.id && promoPreview;

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
              <p className="pricing-plan-price">{tier.priceLabel}</p>
              {promoAppliesToThisPlan ? (
                <p className="promo-code-inline-price">
                  <span className="promo-code-price-original">{promoPreview.originalPriceLabel}</span>
                  <strong>{promoPreview.discountedPriceLabel}</strong>
                  <span className="muted"> / month</span>
                </p>
              ) : null}
              <p className="muted">{tier.headline}</p>
              <ul className="billing-plan-features">
                {tier.features.slice(0, 4).map((feature) => (
                  <li key={feature}>{feature}</li>
                ))}
              </ul>

              {action.type === 'current' ? <p className="billing-plan-current-label">{t('billing.currentPlanBadge')}</p> : null}

              {isPaidChoice ? (
                <PlanCheckoutButton
                  plan={action.plan}
                  label={action.label}
                  promoCode={promoAppliesToThisPlan ? promoCode : ''}
                  promoPreview={promoAppliesToThisPlan ? promoPreview : null}
                  className="btn btn-primary btn-block"
                />
              ) : null}

              {action.type === 'choose' && !isPaidChoice ? (
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

      <div className="billing-plans-footnote-group">
        <p className="muted billing-plans-footnote">{t('billing.plansFootnote')}</p>
        <p className="muted billing-plans-footnote">{t('billing.noRefund.cancelNote')}</p>
        <p className="muted billing-plans-footnote billing-legal-links">
          <Link href="/terms">{t('legal.terms')}</Link> · <Link href="/privacy">{t('legal.privacy')}</Link> ·{' '}
          <Link href="/refund-policy">{t('legal.refundPolicy')}</Link>
        </p>
      </div>
    </div>
  );
}

export { choosePlanButtonLabel };
