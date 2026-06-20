'use client';

import { useState } from 'react';
import { useTranslation } from '@/components/locale-provider';
import {
  billingCheckoutTargetForPlan,
  billingCheckoutTargetAvailable,
  type BillingCheckoutMethod
} from '@/lib/billing-plan-card';
import type { EverittosPlan } from '@/lib/everittos-plans';

type PlanCheckoutButtonProps = {
  plan: EverittosPlan;
  label: string;
  requireRefundAck?: boolean;
  className?: string;
  checkoutUrl?: string | null;
  priceId?: string | null;
  method?: BillingCheckoutMethod;
};

export function PlanCheckoutButton({
  plan,
  label,
  requireRefundAck = true,
  className = 'btn btn-primary',
  checkoutUrl: checkoutUrlProp,
  priceId: priceIdProp,
  method: methodProp
}: PlanCheckoutButtonProps) {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [acceptedRefundPolicy, setAcceptedRefundPolicy] = useState(false);

  const checkoutBlocked = requireRefundAck && !acceptedRefundPolicy;

  const baked = billingCheckoutTargetAvailable(plan) ? billingCheckoutTargetForPlan(plan) : null;
  const checkoutUrl = checkoutUrlProp ?? baked?.checkoutUrl ?? null;
  const priceId = priceIdProp ?? baked?.priceId ?? null;
  const method: BillingCheckoutMethod | null =
    methodProp ?? baked?.method ?? (priceId ? 'session' : checkoutUrl ? 'payment_link' : null);

  async function startCheckout() {
    if (checkoutBlocked) {
      setError(t('billing.noRefund.ackRequired'));
      return;
    }

    if (!method) {
      setError('Billing setup missing for this plan.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const res = await fetch('/api/stripe/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          plan,
          refundPolicyAcknowledged: requireRefundAck ? true : undefined
        })
      });
      const json = await res.json();

      if (!res.ok) {
        if (json.code === 'already_subscribed') {
          setError(json.error || t('billing.alreadySubscribedPortal'));
          window.location.href = json.redirect || '/settings/billing';
          return;
        }

        if (checkoutUrl && method !== 'session') {
          window.location.href = checkoutUrl;
          return;
        }

        setError(json.error || json.message || t('billing.promo.checkoutFailed'));
        return;
      }

      if (json.url) {
        window.location.href = json.url;
        return;
      }

      setError(t('billing.promo.checkoutFailed'));
    } catch {
      setError(t('billing.promo.checkoutFailed'));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="plan-checkout-button">
      {requireRefundAck ? (
        <label className="no-refund-checkout-ack">
          <input
            type="checkbox"
            checked={acceptedRefundPolicy}
            onChange={(e) => setAcceptedRefundPolicy(e.target.checked)}
          />
          <span>{t('billing.noRefund.checkoutAck')}</span>
        </label>
      ) : null}
      <button
        type="button"
        className={className}
        disabled={loading || checkoutBlocked}
        onClick={() => void startCheckout()}
      >
        {loading ? t('billing.promo.startingCheckout') : label}
      </button>
      {error ? (
        <p className="auth-message auth-message-error" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
