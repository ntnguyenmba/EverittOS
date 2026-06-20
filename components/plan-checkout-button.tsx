'use client';

import { useState } from 'react';
import { useTranslation } from '@/components/locale-provider';
import type { EverittosPlan } from '@/lib/everittos-plans';

type PlanCheckoutButtonProps = {
  plan: EverittosPlan;
  label: string;
  requireRefundAck?: boolean;
  className?: string;
  disabled?: boolean;
};

export function PlanCheckoutButton({
  plan,
  label,
  requireRefundAck = true,
  className = 'btn btn-primary',
  disabled = false
}: PlanCheckoutButtonProps) {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [acceptedRefundPolicy, setAcceptedRefundPolicy] = useState(false);

  const checkoutBlocked = requireRefundAck && !acceptedRefundPolicy;

  async function startCheckout() {
    if (checkoutBlocked) {
      setError(t('billing.noRefund.ackRequired'));
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
      const json = (await res.json()) as {
        url?: string;
        error?: string;
        code?: string;
        priceEnvKey?: string;
      };

      if (!res.ok) {
        if (json.code === 'already_subscribed') {
          setError(json.error || t('billing.alreadySubscribedPortal'));
          window.location.href = '/settings/billing';
          return;
        }

        setError(json.error || json.code || t('billing.promo.checkoutFailed'));
        return;
      }

      if (json.url) {
        window.location.href = json.url;
        return;
      }

      setError('Stripe checkout did not return a redirect URL.');
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : t('billing.promo.checkoutFailed'));
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
        disabled={loading || checkoutBlocked || disabled}
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
