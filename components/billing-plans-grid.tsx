'use client';

import Link from 'next/link';
import { PlanCheckoutButton } from '@/components/plan-checkout-button';
import { NoRefundDisclosure } from '@/components/legal/no-refund-disclosure';
import { planCardAction, planChangeHint } from '@/lib/billing-plan-actions';
import { BILLING_PLANS } from '@/lib/billing-config';
import { normalizePlan, type EverittosPlan } from '@/lib/everittos-plans';
import { SUPPORT_EMAIL, supportMailtoHref } from '@/lib/support';
import { useTranslation } from '@/components/locale-provider';

type BillingPlansGridProps = {
  currentPlan: EverittosPlan;
  highlightPlan?: EverittosPlan;
  hasActiveSubscription?: boolean;
  portalAvailable?: boolean;
  onOpenPortal?: () => void;
  portalLoading?: boolean;
};

export function BillingPlansGrid({
  currentPlan,
  highlightPlan,
  hasActiveSubscription = false,
  portalAvailable = false,
  onOpenPortal,
  portalLoading = false
}: BillingPlansGridProps) {
  const { t } = useTranslation();
  const normalizedCurrent = normalizePlan(currentPlan);

  return (
    <div className="billing-plans-grid-wrap">
      <NoRefundDisclosure variant="card" className="billing-plans-policy" />

      <p className="muted billing-plan-change-intro">{t('billing.planChangeIntro')}</p>

      <p className="muted billing-promo-stripe-note">
        Promo codes can be entered securely inside Stripe Checkout.
      </p>

      <div className="billing-plans-grid pricing-grid">
        {BILLING_PLANS.map((tier) => {
          const action = planCardAction(normalizedCurrent, tier.id, {
            hasActiveSubscription,
            portalAvailable
          });
          const isCurrent = action.type === 'current';
          const isHighlighted = highlightPlan === tier.id;
          const isCheckout = action.type === 'checkout';
          const hint = planChangeHint(action);

          return (
            <div
              key={tier.id}
              className={[
                'card',
                'pricing-plan-card',
                'billing-plan-card',
                isCurrent ? 'current-plan' : '',
                isHighlighted ? 'highlighted' : '',
                tier.featured ? 'featured-plan' : ''
              ]
                .filter(Boolean)
                .join(' ')}
            >
              {isCurrent ? <span className="billing-plan-badge">{t('billing.currentPlanBadge')}</span> : null}
              {tier.featured && !isCurrent ? <span className="billing-plan-badge billing-plan-badge-featured">Popular</span> : null}
              <h3>{tier.name}</h3>
              <p className="pricing-plan-price">{tier.priceLabel}</p>
              <p className="muted billing-plan-headline">{tier.headline}</p>
              <ul className="billing-plan-features">
                {tier.features.slice(0, 5).map((feature) => (
                  <li key={feature}>{feature}</li>
                ))}
              </ul>

              {action.type === 'current' ? (
                <p className="billing-plan-current-label">{t('billing.currentPlanBadge')}</p>
              ) : null}

              {isCheckout ? (
                <PlanCheckoutButton
                  plan={action.plan}
                  label={action.label}
                  checkoutUrl={action.checkoutUrl}
                  priceId={action.priceId}
                  method={action.method}
                  className="btn btn-primary btn-block"
                />
              ) : null}

              {action.type === 'portal' && onOpenPortal ? (
                <button type="button" className="btn btn-primary btn-block" disabled={portalLoading} onClick={onOpenPortal}>
                  {portalLoading ? t('billing.openingPortal') : action.label}
                </button>
              ) : null}

              {action.type === 'unavailable' ? (
                <button type="button" className="btn btn-block" disabled>
                  {action.label}
                </button>
              ) : null}

              {action.type === 'contact' ? (
                <a className="btn btn-block" href={action.href}>
                  {t('billing.contactBillingSupport')}
                </a>
              ) : null}

              {hint ? <p className="muted billing-plan-note">{hint}</p> : null}

              {tier.id === 'free' && normalizedCurrent !== 'free' && action.type === 'contact' ? (
                <p className="muted billing-plan-note">{t('billing.downgradeSupportNote')}</p>
              ) : null}
            </div>
          );
        })}
      </div>

      {!portalAvailable && hasActiveSubscription ? (
        <p className="billing-support-fallback">
          {t('billing.planChangesSupport')}{' '}
          <a href={supportMailtoHref('EverittOS billing')}>{SUPPORT_EMAIL}</a>
        </p>
      ) : null}

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
