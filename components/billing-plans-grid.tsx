'use client';

import Link from 'next/link';
import { PlanCheckoutButton } from '@/components/plan-checkout-button';
import { choosePlanButtonLabel, planCardAction } from '@/lib/billing-plan-actions';
import { EVERITTOS_PLANS, EVERITTOS_STRIPE_LINKS, normalizePlan, type EverittosPlan } from '@/lib/everittos-plans';
import { SUPPORT_EMAIL, supportMailtoHref } from '@/lib/support';
import { useTranslation } from '@/components/locale-provider';

type BillingPlansGridProps = {
  currentPlan: EverittosPlan;
  highlightPlan?: EverittosPlan;
};

export function BillingPlansGrid({ currentPlan, highlightPlan }: BillingPlansGridProps) {
  const { t } = useTranslation();
  const normalizedCurrent = normalizePlan(currentPlan);
  const selfServePlanChanges = Object.keys(EVERITTOS_STRIPE_LINKS).length > 0;

  return (
    <div className="billing-plans-grid-wrap">
      <div className="billing-plans-grid pricing-grid">
        {EVERITTOS_PLANS.map((tier) => {
          const action = planCardAction(normalizedCurrent, tier.id);
          const isCurrent = action.type === 'current';
          const isHighlighted = highlightPlan === tier.id;
          const fallbackHref = EVERITTOS_STRIPE_LINKS[tier.id as keyof typeof EVERITTOS_STRIPE_LINKS] || tier.stripeLink || '';
          const isPaidChoice = action.type === 'choose' && tier.id !== 'free';

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
                  fallbackHref={fallbackHref}
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
      <p className="muted billing-plans-footnote">Discount and promotional codes can be entered during Stripe checkout.</p>
    </div>
  );
}

export { choosePlanButtonLabel };
