'use client';

import Link from 'next/link';
import { PlanCheckoutButton } from '@/components/plan-checkout-button';
import { NoRefundDisclosure } from '@/components/legal/no-refund-disclosure';
import {
  BILLING_UI_BUILD_ID,
  billingPlanCardHint,
  resolveBillingPlanCardUi
} from '@/lib/billing-plan-card';
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
  const isFreeUser = normalizedCurrent === 'free';

  return (
    <div className="billing-plans-grid-wrap" data-billing-build={BILLING_UI_BUILD_ID}>
      <NoRefundDisclosure variant="card" className="billing-plans-policy" />

      <p className="muted billing-plan-change-intro">{t('billing.planChangeIntro')}</p>

      <p className="muted billing-promo-stripe-note">
        Promo codes can be entered securely inside Stripe Checkout.
      </p>

      <p className="muted billing-build-marker" data-testid="billing-build-marker">
        Billing UI {BILLING_UI_BUILD_ID}
      </p>

      <div className="billing-plans-grid pricing-grid">
        {BILLING_PLANS.map((tier) => {
          const ui = resolveBillingPlanCardUi({
            currentPlan: normalizedCurrent,
            targetPlan: tier.id,
            hasActiveSubscription: isFreeUser ? false : hasActiveSubscription,
            portalAvailable
          });
          const isCurrent = ui.kind === 'current';
          const isHighlighted = highlightPlan === tier.id;
          const hint = billingPlanCardHint(ui);

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
              data-plan-id={tier.id}
              data-plan-action={ui.kind}
            >
              <div className="billing-plan-card-body">
                {isCurrent ? <span className="billing-plan-badge">{t('billing.currentPlanBadge')}</span> : null}
                {tier.featured && !isCurrent ? (
                  <span className="billing-plan-badge billing-plan-badge-featured">Popular</span>
                ) : null}
                <h3>{tier.name}</h3>
                <p className="pricing-plan-price">{tier.priceLabel}</p>
                <p className="muted billing-plan-headline">{tier.headline}</p>
                <ul className="billing-plan-features">
                  {tier.features.slice(0, 5).map((feature) => (
                    <li key={feature}>{feature}</li>
                  ))}
                </ul>
              </div>

              <div className="billing-plan-card-footer">
                {ui.kind === 'current' ? (
                  <p className="billing-plan-current-label">{t('billing.currentPlanBadge')}</p>
                ) : (
                  <div className="billing-plan-card-cta">
                    {ui.kind === 'checkout' ? (
                      <PlanCheckoutButton
                        plan={ui.plan}
                        label={ui.label}
                        checkoutUrl={ui.checkoutUrl}
                        priceId={ui.priceId}
                        method={ui.method}
                        className="btn btn-primary btn-block"
                      />
                    ) : null}

                    {ui.kind === 'portal' && onOpenPortal ? (
                      <>
                        <div className="billing-plan-ack-spacer" aria-hidden="true" />
                        <button
                          type="button"
                          className="btn btn-primary btn-block"
                          disabled={portalLoading}
                          onClick={onOpenPortal}
                        >
                          {portalLoading ? t('billing.openingPortal') : ui.label}
                        </button>
                      </>
                    ) : null}

                    {ui.kind === 'downgrade_contact' ? (
                      <>
                        <div className="billing-plan-ack-spacer" aria-hidden="true" />
                        <a className="btn btn-block" href={ui.href}>
                          {ui.label}
                        </a>
                      </>
                    ) : null}
                  </div>
                )}

                {hint ? <p className="muted billing-plan-note">{hint}</p> : null}
              </div>
            </div>
          );
        })}
      </div>

      {!portalAvailable && hasActiveSubscription && !isFreeUser ? (
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
