'use client';

import type { CSSProperties } from 'react';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { PlanCheckoutButton } from '@/components/plan-checkout-button';
import {
  BILLING_UI_BUILD_ID,
  billingPlanCardHint,
  resolveBillingPlanCardUi,
  type PaidPlanKey
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

const shellStyle: CSSProperties = {
  width: '100%',
  maxWidth: '100%',
  minWidth: 0,
  overflow: 'visible'
};

const introStyle: CSSProperties = {
  display: 'grid',
  gap: 6,
  margin: '0 0 18px',
  maxWidth: 760
};

const hiddenBuildStyle: CSSProperties = {
  position: 'absolute',
  width: 1,
  height: 1,
  overflow: 'hidden',
  opacity: 0,
  pointerEvents: 'none'
};

const gridStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 300px), 1fr))',
  gap: 18,
  width: '100%',
  minWidth: 0,
  alignItems: 'stretch'
};

const cardStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  minWidth: 0,
  minHeight: '100%',
  padding: 22,
  border: '1px solid rgba(37, 54, 74, 0.14)',
  borderRadius: 18,
  background: '#fff',
  boxShadow: '0 12px 32px rgba(37, 54, 74, 0.06)',
  overflow: 'hidden'
};

const mainStyle: CSSProperties = {
  display: 'flex',
  flex: '1 1 auto',
  minWidth: 0,
  flexDirection: 'column'
};

const badgeRowStyle: CSSProperties = {
  minHeight: 24,
  marginBottom: 8
};

const badgeStyle: CSSProperties = {
  display: 'inline-flex',
  width: 'fit-content',
  borderRadius: 999,
  border: '1px solid rgba(47, 95, 143, 0.18)',
  background: 'rgba(47, 95, 143, 0.07)',
  color: 'var(--accent)',
  padding: '3px 9px',
  fontSize: 11,
  fontWeight: 600,
  lineHeight: 1.35
};

const priceStyle: CSSProperties = {
  margin: '0 0 8px',
  color: 'var(--text)',
  fontSize: 22,
  fontWeight: 650,
  lineHeight: 1.2
};

const headlineStyle: CSSProperties = {
  margin: '0 0 14px',
  color: 'var(--muted)',
  fontSize: 13,
  lineHeight: 1.5
};

const featuresStyle: CSSProperties = {
  display: 'grid',
  gap: 9,
  margin: 0,
  padding: '0 0 0 18px',
  color: 'var(--text)',
  fontSize: 13,
  lineHeight: 1.45
};

const footerStyle: CSSProperties = {
  display: 'grid',
  gap: 10,
  marginTop: 18,
  paddingTop: 16,
  borderTop: '1px solid rgba(37, 54, 74, 0.1)'
};

const noteStyle: CSSProperties = {
  margin: 0,
  color: 'var(--muted)',
  fontSize: 13,
  lineHeight: 1.55,
  overflowWrap: 'anywhere'
};

const currentStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  minHeight: 44,
  margin: 0,
  borderRadius: 12,
  border: '1px solid rgba(37, 54, 74, 0.12)',
  background: 'rgba(37, 54, 74, 0.035)',
  color: 'var(--muted)',
  fontSize: 13,
  fontWeight: 600,
  lineHeight: 1.2
};

const footnotesStyle: CSSProperties = {
  display: 'grid',
  gap: 6,
  marginTop: 22,
  paddingTop: 16,
  borderTop: '1px solid rgba(37, 54, 74, 0.1)'
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
  const [checkoutAvailableByPlan, setCheckoutAvailableByPlan] = useState<Partial<Record<PaidPlanKey, boolean>>>({});

  useEffect(() => {
    let cancelled = false;

    async function loadCapabilities() {
      const res = await fetch('/api/stripe/capabilities', { cache: 'no-store' });
      const json = (await res.json().catch(() => ({}))) as {
        plans?: Partial<Record<PaidPlanKey, { checkoutAvailable?: boolean }>>;
      };
      if (cancelled || !json.plans) return;

      const next: Partial<Record<PaidPlanKey, boolean>> = {};
      for (const [plan, config] of Object.entries(json.plans)) {
        next[plan as PaidPlanKey] = Boolean(config?.checkoutAvailable);
      }
      setCheckoutAvailableByPlan(next);
    }

    void loadCapabilities();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <section className="billing-plans-grid-wrap" data-billing-build={BILLING_UI_BUILD_ID} style={shellStyle}>
      <div style={introStyle}>
        <p style={noteStyle}>{t('billing.planChangeIntro')}</p>
        <p style={noteStyle}>Choose a plan, accept the no-refund acknowledgment, then continue to Stripe Checkout.</p>
      </div>

      <p className="billing-build-marker" data-testid="billing-build-marker" style={hiddenBuildStyle}>
        Billing UI {BILLING_UI_BUILD_ID}
      </p>

      <div className="billing-plans-grid" style={gridStyle}>
        {BILLING_PLANS.map((tier) => {
          const ui = resolveBillingPlanCardUi({
            currentPlan: normalizedCurrent,
            targetPlan: tier.id,
            hasActiveSubscription: isFreeUser ? false : hasActiveSubscription,
            portalAvailable,
            checkoutAvailableByPlan
          });
          const isCurrent = ui.kind === 'current';
          const isHighlighted = highlightPlan === tier.id;
          const hint = billingPlanCardHint(ui);
          const emphasizedCardStyle =
            isCurrent || isHighlighted
              ? {
                  ...cardStyle,
                  borderColor: 'rgba(47, 95, 143, 0.36)',
                  boxShadow: '0 0 0 1px rgba(47, 95, 143, 0.16), 0 14px 34px rgba(37, 54, 74, 0.07)'
                }
              : cardStyle;

          return (
            <article
              key={tier.id}
              className={[
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
              style={emphasizedCardStyle}
            >
              <div className="billing-plan-card-body" style={mainStyle}>
                <div style={badgeRowStyle}>
                  {isCurrent ? <span style={badgeStyle}>{t('billing.currentPlanBadge')}</span> : null}
                  {tier.featured && !isCurrent ? <span style={badgeStyle}>Popular</span> : null}
                </div>
                <h3 style={{ margin: '0 0 8px', fontSize: 18, lineHeight: 1.25 }}>{tier.name}</h3>
                <p className="pricing-plan-price" style={priceStyle}>{tier.priceLabel}</p>
                <p className="billing-plan-headline" style={headlineStyle}>{tier.headline}</p>
                <ul className="billing-plan-features" style={featuresStyle}>
                  {tier.features.slice(0, 5).map((feature) => (
                    <li key={feature} style={{ margin: 0, overflowWrap: 'anywhere' }}>{feature}</li>
                  ))}
                </ul>
              </div>

              <div className="billing-plan-card-footer" style={footerStyle}>
                {ui.kind === 'current' ? (
                  <p className="billing-plan-current-label" style={currentStyle}>{t('billing.currentPlanBadge')}</p>
                ) : null}

                {ui.kind === 'checkout' ? (
                  <PlanCheckoutButton
                    plan={ui.plan}
                    label={ui.label}
                    disabled={!ui.checkoutAvailable}
                    className="btn btn-primary btn-block"
                  />
                ) : null}

                {ui.kind === 'unavailable' ? (
                  <p className="billing-plan-current-label" style={currentStyle}>
                    {ui.label}
                  </p>
                ) : null}

                {ui.kind === 'portal' && onOpenPortal ? (
                  <button
                    type="button"
                    className="btn btn-primary btn-block"
                    disabled={portalLoading}
                    onClick={onOpenPortal}
                  >
                    {portalLoading ? t('billing.openingPortal') : ui.label}
                  </button>
                ) : null}

                {ui.kind === 'downgrade_contact' ? (
                  <a className="btn btn-block" href={ui.href}>
                    {ui.label}
                  </a>
                ) : null}

                {hint ? <p className="billing-plan-note" style={noteStyle}>{hint}</p> : null}
              </div>
            </article>
          );
        })}
      </div>

      {!portalAvailable && hasActiveSubscription && !isFreeUser ? (
        <p className="billing-support-fallback">
          {t('billing.planChangesSupport')}{' '}
          <a href={supportMailtoHref('EverittOS billing')}>{SUPPORT_EMAIL}</a>
        </p>
      ) : null}

      <footer className="billing-plans-footnote-group" style={footnotesStyle}>
        <p className="billing-plans-footnote" style={noteStyle}>{t('billing.plansFootnote')}</p>
        <p className="billing-plans-footnote" style={noteStyle}>{t('billing.noRefund.cancelNote')}</p>
        <p className="billing-plans-footnote billing-legal-links" style={noteStyle}>
          <Link href="/terms">{t('legal.terms')}</Link> · <Link href="/privacy">{t('legal.privacy')}</Link> ·{' '}
          <Link href="/refund-policy">{t('legal.refundPolicy')}</Link>
        </p>
      </footer>
    </section>
  );
}
